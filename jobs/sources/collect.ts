import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { Criteria, Evidence, Fact, Home, ResearchScope, SourceEntry, SourceRun, UtilityName } from '../../src/domain/schema.js';
import { SOURCE_REGISTRY, type RegisteredSource } from './registry.js';
import { fetchPublicPage } from './public-page.js';
import { parseCmu } from './cmu.js';
import { parseLobos } from './lobos.js';
import { parseReinhold } from './manager-page.js';
import type { EvidenceRow, ObservedListing, ParseResult } from './types.js';

export type SourceRunObservation = {
  sourceId: string; status: 'fetched' | 'imported' | 'failed' | 'blocked'; method: string; startedAt: string; completedAt: string;
  urlsAttempted: string[]; pagesFetched: number; observations: number; importedHomeIds: string[]; duplicateObservations: number; queryDescription: string; bounds: string; error: string | null;
};

export type CollectedSources = {
  homes: Home[];
  evidence: Evidence[];
  sources: SourceEntry[];
  sourceRuns: SourceRun[];
  researchScopes: ResearchScope[];
  observations: ObservedListing[];
  captures: Array<{ sourceId: string; url: string; fetchedAt: string; captureHash: string; bytes: number }>;
  warnings: string[];
};

function parserFor(source: RegisteredSource): ((capture: Parameters<typeof parseCmu>[0]) => ParseResult) | null {
  if (source.adapter === 'cmu') return parseCmu;
  if (source.adapter === 'lobos') return parseLobos;
  if (source.adapter === 'reinhold') return parseReinhold;
  return null;
}

function canonicalFact<T>(observed: { value: T | null; state: 'sourced' | 'unknown' | 'conflicting'; evidenceIds: string[] }, evidence: EvidenceRow[]): Fact<T> {
  const observedAt = observed.evidenceIds.map((id) => evidence.find((item) => item.id === id)?.observedAt).find(Boolean) ?? null;
  return { value: observed.value, state: observed.state, evidenceIds: observed.evidenceIds, method: null, observedAt };
}

function canonicalUnknown<T>(): Fact<T> { return { value: null, state: 'unknown', evidenceIds: [], method: null, observedAt: null }; }

const UTILITY_NAMES: UtilityName[] = ['electricity', 'gas', 'water_sewer', 'trash', 'internet', 'other'];

function toHome(observed: ObservedListing, allEvidence: EvidenceRow[]): Home {
  const evidence = allEvidence.filter((item) => observed.evidence.some((candidate) => candidate.id === item.id));
  const mapFact = <T>(fact: { value: T | null; state: 'sourced' | 'unknown' | 'conflicting'; evidenceIds: string[] }) => canonicalFact(fact, evidence);
  const utilities = UTILITY_NAMES.map((name) => {
    const sourceUtility = observed.utilities.find((utility) => utility.name === name);
    const ids = sourceUtility?.evidenceIds ?? [];
    const inclusion = sourceUtility ? canonicalFact({ value: sourceUtility.inclusion, state: sourceUtility.inclusion ? 'sourced' : 'unknown', evidenceIds: ids }, evidence) : canonicalUnknown<'included' | 'separate' | 'partial'>();
    return { name, inclusion, chargeIds: [], terms: canonicalUnknown<string>(), applicable: sourceUtility ? canonicalFact({ value: true, state: 'sourced', evidenceIds: ids }, evidence) : canonicalUnknown<boolean>() };
  });
  const title = mapFact(observed.title); const address = mapFact(observed.address); const unitLabel = mapFact(observed.unitLabel);
  return {
    id: observed.id, buildingKey: observed.buildingKey, offerKey: observed.offerKey, floorPlanKey: observed.floorPlanKey, scope: observed.scope, sourceListingIds: [observed.sourceId], primaryUrl: observed.url, lastObservedAt: observed.evidence[0]?.observedAt ?? new Date().toISOString(),
    title, address, unitLabel, coordinate: canonicalUnknown(), propertyType: mapFact(observed.propertyType), bedrooms: mapFact(observed.bedrooms), bathrooms: mapFact(observed.bathrooms), fullBaths: mapFact(observed.fullBaths), halfBaths: mapFact(observed.halfBaths),
    rent: { basis: observed.rent.basis, period: observed.rent.period, amount: mapFact(observed.rent.amount), upperAmount: mapFact(observed.rent.upperAmount), kind: observed.rent.kind, semantics: observed.rent.semantics }, charges: [], utilities,
    concessions: canonicalUnknown(), availability: mapFact(observed.availability), leaseTerms: canonicalUnknown(), listingStatus: 'observed', amenities: [], reviews: [], nearby: [], transit: [], routeIds: [], photo: null,
  };
}

async function fetchOne(source: RegisteredSource, signal: AbortSignal, onProgress: (message: string) => void): Promise<{ source: RegisteredSource; result: ParseResult; run: SourceRunObservation } | { source: RegisteredSource; run: SourceRunObservation; error: Error }> {
  const startedAt = new Date().toISOString(); onProgress(`Fetching ${source.name}`);
  try {
    const capture = await fetchPublicPage(source.url, signal); const parser = parserFor(source); if (!parser) throw new Error('No parser registered');
    const result = parser(capture); const completedAt = new Date().toISOString();
    return { source, result, run: { sourceId: source.id, status: 'fetched', method: 'bounded public HTTPS fetch + source-specific Cheerio parser', startedAt, completedAt, urlsAttempted: [source.url], pagesFetched: 1, observations: result.listings.length, importedHomeIds: result.listings.map((listing) => listing.id), duplicateObservations: 0, queryDescription: 'Pittsburgh public inventory / property page; no portal credentials', bounds: '15s request timeout; 12MiB response limit; max two concurrent requests', error: result.warnings.length ? result.warnings.join('; ') : null } };
  } catch (error) {
    const completedAt = new Date().toISOString(); const err = error instanceof Error ? error : new Error(String(error));
    return { source, error: err, run: { sourceId: source.id, status: /denied|403|429|blocked/i.test(err.message) ? 'blocked' : 'failed', method: 'bounded public HTTPS fetch', startedAt, completedAt, urlsAttempted: [source.url], pagesFetched: 0, observations: 0, importedHomeIds: [], duplicateObservations: 0, queryDescription: 'Pittsburgh public inventory / property page', bounds: '15s request timeout; 12MiB response limit', error: err.message } };
  }
}

/**
 * Fetches only registered, public source pages and returns source-facing observations.
 * Root's discovery wrapper adapts these observations to canonical Home/Evidence records.
 */
export async function collectSources(criteria: Criteria, onProgress: (message: string) => void, signal: AbortSignal): Promise<CollectedSources> {
  const selected = SOURCE_REGISTRY.filter((source) => source.accessMode === 'public_page' && parserFor(source));
  const allListings: ObservedListing[] = []; const evidence: EvidenceRow[] = []; const runs: SourceRunObservation[] = []; const captures: CollectedSources['captures'] = []; const warnings: string[] = [];
  const rawDir = path.join(process.cwd(), 'data', 'raw'); await mkdir(rawDir, { recursive: true });
  for (let index = 0; index < selected.length; index += 2) {
    if (signal.aborted) throw new Error('Source collection cancelled');
    const batch = await Promise.all(selected.slice(index, index + 2).map((source) => fetchOne(source, signal, onProgress)));
    for (const item of batch) {
      runs.push(item.run);
      if ('error' in item) { warnings.push(`${item.source.name}: ${item.error.message}`); continue; }
      allListings.push(...item.result.listings); item.result.listings.forEach((listing) => evidence.push(...listing.evidence)); warnings.push(...item.result.warnings);
      const capture = item.result.captures[0]; captures.push({ sourceId: capture.sourceId, url: capture.url, fetchedAt: capture.fetchedAt, captureHash: capture.captureHash, bytes: Buffer.byteLength(capture.html) });
      const fileName = `${capture.sourceId}-${capture.fetchedAt.replace(/[:.]/g, '-')}.html`; await writeFile(path.join(rawDir, fileName), capture.html, 'utf8');
    }
  }
  const unique = new Map<string, ObservedListing>(); let duplicates = 0;
  for (const listing of allListings) { const key = `${listing.sourceId}|${listing.scopeKey}`; if (unique.has(key)) duplicates++; else unique.set(key, listing); }
  for (const run of runs) run.duplicateObservations += duplicates;
  const observationPath = path.join(process.cwd(), 'data', 'seed', 'observations.json'); await mkdir(path.dirname(observationPath), { recursive: true });
  const observations = [...unique.values()]; const canonicalEvidence = evidence.filter((item, index, items) => items.findIndex((candidate) => candidate.id === item.id) === index) as Evidence[];
  const canonicalHomes = observations.map((observation) => toHome(observation, canonicalEvidence));
  const sourceRuns = runs.map((run) => ({ ...run, status: run.status === 'fetched' ? 'imported' as const : run.status, importedHomeIds: run.status === 'fetched' ? observations.filter((observation) => observation.sourceId === run.sourceId).map((observation) => observation.id) : [] }));
  const researchScopes: ResearchScope[] = [{ marketKey: 'pittsburgh|pa|US', areas: [{ label: 'Pittsburgh', center: null, radiusMeters: null }], destinationVersion: 'osm-node-1704796692-v1', scenarioMaxWalkSeconds: 1200, queriedBedrooms: [criteria?.bedrooms ?? 2], queriedMinBathrooms: criteria?.minBathrooms ?? 2, queriedMaxWholeRent: 240000, queriedPropertyTypes: ['house', 'apartment'], checkedAt: new Date().toISOString(), queryCount: selected.length, limitReasons: ['public pages only', 'source terms/access limits', 'bounded page size/time'] }];
  const sources: SourceEntry[] = SOURCE_REGISTRY.map(({ adapter: _adapter, ...source }) => source);
  const scopedRuns: SourceRun[] = sourceRuns.map((run) => ({ ...run, scope: researchScopes[0] }));
  const collectedAt = new Date().toISOString();
  await writeFile(observationPath, JSON.stringify({ schemaVersion: 1, collectedAt, criteria: { market: criteria?.market ?? 'pittsburgh' }, homes: canonicalHomes, observations, evidence: canonicalEvidence, sources, sourceRuns: scopedRuns, researchScopes, captures, warnings }, null, 2), 'utf8');
  onProgress(`Collected ${unique.size} unique source observations across ${runs.filter((run) => run.pagesFetched > 0).length} public organizations`);
  return { homes: canonicalHomes, observations, evidence: canonicalEvidence, sources, sourceRuns: scopedRuns, researchScopes, captures, warnings };
}

export const collectObservedSources = collectSources;
