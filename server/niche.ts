/**
 * Niche assessment: the model half. One bounded Grok call per (query, snapshot),
 * cached on disk so the rehearsed demo path never waits on the network.
 *
 * The model answers only "does this home satisfy the renter's request"; eligibility and
 * ranking stay in src/domain/niche.ts. A failure here degrades to an explained empty
 * result — it never throws into the search flow and never touches the snapshot store.
 */

import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { z } from 'zod';
import type { NicheAssessment, NicheResult, Snapshot } from '../src/domain/schema.js';
import { NicheResultSchema } from '../src/domain/schema.js';
import { buildDigest, homesWithoutJudgeableData } from '../src/domain/niche.js';

const CACHE_ROOT = join(process.cwd(), 'data', 'cache', 'niche');
const DEFAULT_TIMEOUT_MS = 45_000;
const MAX_TIMEOUT_MS = 45_000;
const CACHE_VERSION = 'niche-evidence-v4-low-effort';

/** What the model must return. Mirrors NicheAssessmentSchema minus homeId-keyed extras. */
const ModelOutputSchema = z.object({
  assessments: z.array(z.object({
    homeId: z.string().min(1),
    matches: z.boolean(),
    confidence: z.enum(['strong', 'partial']),
    reason: z.string().min(1).max(400),
    provenance: z.enum(['listing_data', 'model_assessment']),
    citedPlaceIds: z.array(z.string()),
    citedAmenityKeys: z.array(z.string()).default([]),
    mitigates: z.object({ constraintKey: z.string().min(1), reason: z.string().min(1).max(400) }).nullable(),
  })),
}).strict();

/** JSON Schema handed to Grok's structured outputs so nothing is parsed out of prose. */
const RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    assessments: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          homeId: { type: 'string' },
          matches: { type: 'boolean' },
          confidence: { type: 'string', enum: ['strong', 'partial'] },
          reason: { type: 'string', maxLength: 400 },
          provenance: { type: 'string', enum: ['listing_data', 'model_assessment'] },
          citedPlaceIds: { type: 'array', items: { type: 'string' } },
          citedAmenityKeys: { type: 'array', items: { type: 'string' } },
          mitigates: {
            anyOf: [
              { type: 'null' },
              {
                type: 'object',
                properties: { constraintKey: { type: 'string' }, reason: { type: 'string', maxLength: 400 } },
                required: ['constraintKey', 'reason'],
                additionalProperties: false,
              },
            ],
          },
        },
        required: ['homeId', 'matches', 'confidence', 'reason', 'provenance', 'citedPlaceIds', 'citedAmenityKeys', 'mitigates'],
        additionalProperties: false,
      },
    },
  },
  required: ['assessments'],
  additionalProperties: false,
} as const;

const SYSTEM_PROMPT = `You assess rental homes against one plain-language request from a renter.
You receive a JSON digest of homes: nearby places (name, category, straight-line metres),
transit routes (and whether they reach the renter's destination), amenity keys, coordinates,
and layout. Judge ONLY the renter's niche request. Never judge rent, walking time, bedrooms,
or any requirement the application already checks.

Rules:
- Return one assessment per home that MATCHES the request. Omit homes that do not match or
  that you cannot judge. Never invent places, amenities, or transit the digest does not list.
- provenance is "listing_data" when the judgement rests on digest entries; cite the nearby
  place ids in citedPlaceIds or exact amenity keys in citedAmenityKeys. Use "model_assessment"
  when it rests on your own knowledge of the area (e.g. geography near the coordinates);
  then both citation arrays are empty.
- confidence is "strong" for a direct satisfaction of the request, "partial" when you are
  stretching (a related cuisine, an adjacent category). The reason string is shown to the
  renter verbatim - one plain sentence, name the place or fact it rests on, and for partial
  matches say what the stretch is.
- mitigates: if the home also carries a fact that plausibly compensates for a shortfall in
  one of the application's own checks, name that check ("walk", "personal_rent", "bathrooms")
  and why - e.g. a transit route serving the destination mitigates "walk". Otherwise null.
  This is context for the renter, not a verdict; the application never changes its checks.`;

export type NicheOptions = {
  destinationVersion?: string;
  apiKey?: string;
  apiUrl?: string;
  model?: string;
  fetch?: typeof fetch;
  timeoutMs?: number;
  cacheDirectory?: string;
  now?: () => Date;
};

const degraded = (query: string, snapshot: Snapshot, reason: string, model: string, now: Date, destinationVersion?: string): NicheResult => ({
  query, snapshotId: snapshot.id, assessments: [], model, generatedAt: now.toISOString(),
  degraded: reason, homesWithoutData: homesWithoutJudgeableData(buildDigest(snapshot, destinationVersion)),
});

export const nicheCacheKey = (query: string, snapshotId: string, context: { digest?: unknown; model?: string; destinationVersion?: string } = {}): string =>
  createHash('sha256').update(JSON.stringify([CACHE_VERSION, query.trim().toLowerCase(), snapshotId, context.model, context.destinationVersion, context.digest])).digest('hex').slice(0, 24);

export async function assessNiche(snapshot: Snapshot, query: string, signal: AbortSignal, options: NicheOptions = {}): Promise<NicheResult> {
  const now = (options.now ?? (() => new Date()))();
  const model = options.model ?? process.env.XAI_MODEL ?? 'grok-4.6';
  const cacheDirectory = options.cacheDirectory ?? CACHE_ROOT;
  const digest = buildDigest(snapshot, options.destinationVersion);
  const cachePath = join(cacheDirectory, `${nicheCacheKey(query, snapshot.id, { digest, model, destinationVersion: options.destinationVersion })}.json`);

  try {
    const cached = NicheResultSchema.parse(JSON.parse(await readFile(cachePath, 'utf8')));
    if (cached.query.trim().toLowerCase() === query.trim().toLowerCase() && cached.snapshotId === snapshot.id && !cached.degraded) return cached;
  } catch { /* cache miss */ }

  const apiKey = options.apiKey ?? process.env.XAI_API_KEY;
  if (!apiKey) return degraded(query, snapshot, 'The niche assistant is not configured in this session (no API key). Saved results and core filters remain fully usable.', model, now, options.destinationVersion);

  const body = {
    model,
    reasoning_effort: 'low',
    max_tokens: 4096,
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: `Renter's request: ${JSON.stringify(query)}\n\nHomes:\n${JSON.stringify(digest)}` },
    ],
    response_format: { type: 'json_schema', json_schema: { name: 'niche_assessments', strict: true, schema: RESPONSE_SCHEMA } },
    temperature: 0.2,
  };

  try {
    const response = await (options.fetch ?? fetch)(options.apiUrl ?? process.env.XAI_API_URL ?? 'https://api.x.ai/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify(body),
      signal: AbortSignal.any([signal, AbortSignal.timeout(Math.min(options.timeoutMs ?? DEFAULT_TIMEOUT_MS, MAX_TIMEOUT_MS))]),
    });
    if (!response.ok) return degraded(query, snapshot, `The niche assistant is unavailable right now (HTTP ${response.status}). Core filters remain fully usable.`, model, now, options.destinationVersion);
    const payload = await response.json() as { choices?: { message?: { content?: string } }[] };
    const content = payload.choices?.[0]?.message?.content;
    if (typeof content !== 'string') return degraded(query, snapshot, 'The niche assistant returned no usable answer. Core filters remain fully usable.', model, now, options.destinationVersion);

    const parsed = ModelOutputSchema.safeParse(JSON.parse(content));
    if (!parsed.success) return degraded(query, snapshot, 'The niche assistant answered in an unexpected shape and its answer was discarded. Core filters remain fully usable.', model, now, options.destinationVersion);

    // Only matching verdicts for homes this snapshot actually contains; one per home.
    const homes = new Map(digest.map((home) => [home.id, home]));
    const seen = new Set<string>();
    const assessments = parsed.data.assessments.flatMap<NicheAssessment>((assessment) => {
      const home = homes.get(assessment.homeId);
      if (!assessment.matches || !home || seen.has(assessment.homeId)) return [];
      const cited = assessment.citedPlaceIds.map((id) => home.nearby.find((place) => place.id === id));
      if (cited.some((place) => !place) || assessment.citedAmenityKeys.some((key) => !home.amenities.includes(key))) return [];
      seen.add(assessment.homeId);
      const places = cited.filter((place): place is NonNullable<typeof place> => Boolean(place));
      const details = [
        ...places.map((place) => `${place.name} (${place.category}, ${place.metres} m straight-line)`),
        ...assessment.citedAmenityKeys.map((key) => `listed amenity ${key.replaceAll('_', ' ')}`),
      ];
      const explanation = `AI interpretation: ${assessment.reason}`;
      if (assessment.provenance === 'listing_data' && details.length) {
        const context = ` Saved context: ${details.join('; ').slice(0, 140)}. Verify whether it meets your request.`;
        return [{ homeId: assessment.homeId, matches: true, confidence: assessment.confidence,
          provenance: 'listing_data' as const, citedPlaceIds: [...new Set(assessment.citedPlaceIds)],
          reason: `${explanation.slice(0, 400 - context.length)}${context}`,
          mitigates: null }];
      }
      return [{ homeId: assessment.homeId, matches: true, confidence: 'partial' as const, provenance: 'model_assessment' as const,
        citedPlaceIds: [], reason: explanation.slice(0, 400), mitigates: null }];
    });

    const result: NicheResult = {
      query, snapshotId: snapshot.id, assessments, model, generatedAt: now.toISOString(),
      degraded: null, homesWithoutData: homesWithoutJudgeableData(digest),
    };
    try { await mkdir(cacheDirectory, { recursive: true }); await writeFile(cachePath, JSON.stringify(result), 'utf8'); } catch { /* cache is optional */ }
    return result;
  } catch (error) {
    if (signal.aborted) throw error; // the caller cancelled; nothing to respond to
    if (error instanceof Error && error.name === 'TimeoutError') return degraded(query, snapshot, 'The niche assistant took too long and was stopped. Core filters remain fully usable.', model, now, options.destinationVersion);
    return degraded(query, snapshot, 'The niche assistant could not be reached. Core filters remain fully usable.', model, now, options.destinationVersion);
  }
}
