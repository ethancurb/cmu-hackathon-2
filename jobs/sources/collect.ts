import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { Criteria, Evidence, Fact, Home, ResearchScope, SourceEntry, SourceRun, UtilityName } from '../../src/domain/schema.js';
import { SOURCE_REGISTRY, type RegisteredSource } from './registry.js';
import { fetchPublicPage } from './public-page.js';
import { parseCmu, type CmuParseOptions } from './cmu.js';
import { parseLobos, parseLobosDetail } from './lobos.js';
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

function parserFor(source: RegisteredSource, criteria?: Criteria): ((capture: Parameters<typeof parseCmu>[0]) => ParseResult) | null {
  if (source.adapter === 'cmu') {
    const options: CmuParseOptions = criteria ? { destination: criteria.destination.coordinate, bedrooms: criteria.bedrooms, minBathrooms: criteria.minBathrooms, matchingLimit: 12, nearMissLimit: 8 } : {};
    return (capture) => parseCmu(capture, options);
  }
  if (source.adapter === 'lobos') return parseLobos;
  if (source.adapter === 'reinhold') return parseReinhold;
  return null;
}

function canonicalFact<T>(observed: { value: T | null; state: 'sourced' | 'unknown' | 'conflicting'; evidenceIds: string[] }, evidence: EvidenceRow[]): Fact<T> {
  const observedAt = observed.evidenceIds.map((id) => evidence.find((item) => item.id === id)?.observedAt).find(Boolean) ?? null;
  return { value: observed.value, state: observed.state, evidenceIds: observed.evidenceIds, method: null, observedAt };
}

function canonicalUnknown<T>(): Fact<T> { return { value: null, state: 'unknown', evidenceIds: [], method: null, observedAt: null }; }

function canonicalDerived<T>(observed: { value: T | null; evidenceIds: string[] }, evidence: EvidenceRow[], method: string): Fact<T> {
  const observedAt = observed.evidenceIds.map((id) => evidence.find((item) => item.id === id)?.observedAt).find(Boolean) ?? null;
  return { value: observed.value, state: 'derived', evidenceIds: observed.evidenceIds, method, observedAt };
}

function canonicalAmenityKey(label: string): string {
  const value = label.toLowerCase();
  if (/washer\s*(?:&|and)\s*dryer|in[- ]unit laundry|laundry hookup/.test(value)) return 'laundry_in_unit';
  if (/laundry\s*(?:room|on[- ]site)|on[- ]site laundry/.test(value)) return 'laundry_on_site';
  if (/parking|garage/.test(value)) return 'parking';
  if (/pets?\s*allowed|cat friendly|dog friendly|pet friendly/.test(value)) return 'pets_allowed';
  if (/step[- ]free|wheelchair accessible|accessible entrance/.test(value)) return 'step_free_access';
  if (/air conditioning|\bac\b/.test(value)) return 'air_conditioning';
  if (/balcony|deck|patio|yard|outdoor space/.test(value)) return 'outdoor_space';
  return `context_${value.replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '') || 'amenity'}`;
}

const UTILITY_NAMES: UtilityName[] = ['electricity', 'gas', 'water_sewer', 'trash', 'internet', 'other'];

export function toHome(observed: ObservedListing, allEvidence: EvidenceRow[]): Home {
  const evidence = allEvidence.filter((item) => observed.evidence.some((candidate) => candidate.id === item.id));
  const mapFact = <T>(fact: { value: T | null; state: 'sourced' | 'unknown' | 'conflicting'; evidenceIds: string[] }) => canonicalFact(fact, evidence);
  const utilities = UTILITY_NAMES.map((name) => {
    const sourceUtility = observed.utilities.find((utility) => utility.name === name);
    const ids = sourceUtility?.evidenceIds ?? [];
    const inclusion = sourceUtility?.inclusion ? canonicalFact({ value: sourceUtility.inclusion, state: 'sourced', evidenceIds: ids }, evidence) : canonicalUnknown<'included' | 'separate' | 'partial'>();
    const terms = sourceUtility?.terms ? (sourceUtility.appliesToAllUnits ? canonicalFact({ value: sourceUtility.terms, state: 'sourced', evidenceIds: ids }, evidence) : canonicalDerived({ value: sourceUtility.terms, evidenceIds: ids }, evidence, 'property-level utility label; offer applicability is unknown')) : canonicalUnknown<string>();
    const applicable = sourceUtility?.appliesToAllUnits ? canonicalFact({ value: true, state: 'sourced', evidenceIds: ids }, evidence) : canonicalUnknown<boolean>();
    return { name, inclusion, chargeIds: [], terms, applicable };
  });
  const title = mapFact(observed.title); const address = mapFact(observed.address); const unitLabel = mapFact(observed.unitLabel);
  const concessions = observed.concessions ? (observed.concessionsScope === 'building' ? canonicalDerived(observed.concessions, evidence, 'property-level concession; offer applicability is unknown') : mapFact(observed.concessions)) : canonicalUnknown<string>();
  const leaseTerms = observed.leaseTerms ? (observed.leaseTermsScope === 'building' ? canonicalDerived(observed.leaseTerms, evidence, 'property-level lease text; offer applicability is unknown') : mapFact(observed.leaseTerms)) : canonicalUnknown<string>();
  return {
    id: observed.id, buildingKey: observed.buildingKey, offerKey: observed.offerKey, floorPlanKey: observed.floorPlanKey, scope: observed.scope, sourceListingIds: [observed.sourceId], primaryUrl: observed.url, lastObservedAt: observed.evidence[0]?.observedAt ?? new Date().toISOString(),
    title, address, unitLabel, coordinate: observed.coordinate ? mapFact(observed.coordinate) : canonicalUnknown(), propertyType: mapFact(observed.propertyType), bedrooms: mapFact(observed.bedrooms), bathrooms: mapFact(observed.bathrooms), fullBaths: mapFact(observed.fullBaths), halfBaths: mapFact(observed.halfBaths),
    rent: { basis: observed.rent.basis, period: observed.rent.period, amount: mapFact(observed.rent.amount), upperAmount: mapFact(observed.rent.upperAmount), kind: observed.rent.kind, semantics: observed.rent.semantics }, charges: [], utilities,
    concessions, availability: mapFact(observed.availability), leaseTerms, listingStatus: 'observed', amenities: observed.amenities.map((amenity) => {
      const scope = amenity.scope ?? 'building'; const explicit = amenity.applicability !== 'unknown';
      const fact: Fact<boolean> = amenity.value === null ? canonicalUnknown<boolean>() : explicit ? canonicalFact({ value: amenity.value, state: 'sourced', evidenceIds: amenity.evidenceIds }, evidence) : canonicalDerived<boolean>({ value: null, evidenceIds: amenity.evidenceIds }, evidence, 'property-level amenity; floorplan applicability is unknown');
      return { key: canonicalAmenityKey(amenity.label), label: amenity.label, fact, scope };
    }), reviews: [], nearby: [], transit: [], routeIds: [], photo: observed.photo ?? null,
  };
}

async function fetchOne(source: RegisteredSource, criteria: Criteria, signal: AbortSignal, onProgress: (message: string) => void): Promise<{ source: RegisteredSource; result: ParseResult; run: SourceRunObservation } | { source: RegisteredSource; run: SourceRunObservation; error: Error }> {
  const startedAt = new Date().toISOString(); onProgress(`Fetching ${source.name}`);
  try {
    const capture = await fetchPublicPage(source.url, signal); const parser = parserFor(source, criteria); if (!parser) throw new Error('No parser registered');
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
  const selected = SOURCE_REGISTRY.filter((source) => source.accessMode === 'public_page' && parserFor(source, criteria));
  const allListings: ObservedListing[] = []; const evidence: EvidenceRow[] = []; const runs: SourceRunObservation[] = []; const captures: CollectedSources['captures'] = []; const warnings: string[] = [];
  const rawDir = path.join(process.cwd(), 'data', 'raw'); await mkdir(rawDir, { recursive: true });
  for (let index = 0; index < selected.length; index += 2) {
    if (signal.aborted) throw new Error('Source collection cancelled');
    const batch = await Promise.all(selected.slice(index, index + 2).map((source) => fetchOne(source, criteria, signal, onProgress)));
    for (const item of batch) {
      runs.push(item.run);
      if ('error' in item) { warnings.push(`${item.source.name}: ${item.error.message}`); continue; }
      allListings.push(...item.result.listings); item.result.listings.forEach((listing) => evidence.push(...listing.evidence)); warnings.push(...item.result.warnings);
      // The public Lobos index exposes card-level leads. Recheck one current Shadyside
      // unit detail so the seed contains a unit-scoped rent/layout observation too.
      if (item.source.id === 'lobos-management') {
        const detailUrl = 'https://lobosmanagement.com/units/bentley-apartments-021-a-03/';
        try {
          const detailCapture = await fetchPublicPage(detailUrl, signal);
          const detail = parseLobosDetail(detailCapture);
          allListings.push(...detail.listings); detail.listings.forEach((listing) => evidence.push(...listing.evidence)); warnings.push(...detail.warnings);
          item.run.pagesFetched += 1; item.run.urlsAttempted.push(detailUrl); item.run.observations += detail.listings.length;
          captures.push({ sourceId: detailCapture.sourceId, url: detailCapture.url, fetchedAt: detailCapture.fetchedAt, captureHash: detailCapture.captureHash, bytes: Buffer.byteLength(detailCapture.html) });
          const detailFileName = `${detailCapture.sourceId}-detail-${detailCapture.fetchedAt.replace(/[:.]/g, '-')}.html`; await writeFile(path.join(rawDir, detailFileName), detailCapture.html, 'utf8');
        } catch (error) { warnings.push(`Lobos targeted Shadyside detail: ${error instanceof Error ? error.message : String(error)}`); }
      }
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
  const researchScopes: ResearchScope[] = [{ marketKey: `${criteria.market.label.toLowerCase().split('/')[0].trim()}|${criteria.market.region.toLowerCase()}|${criteria.market.country}`, areas: [{ label: criteria.market.label, center: null, radiusMeters: null }], destinationVersion: criteria.destination.version, scenarioMaxWalkSeconds: criteria.maxWalkSeconds, queriedBedrooms: null, queriedMinBathrooms: null, queriedMaxWholeRent: null, queriedPropertyTypes: null, checkedAt: new Date().toISOString(), queryCount: selected.length, limitReasons: ['public pages were fetched without source-side criteria filters', 'source terms/access limits', 'bounded page size/time'] }];
  const sources: SourceEntry[] = SOURCE_REGISTRY.map(({ adapter: _adapter, ...source }) => source);
  const scopedRuns: SourceRun[] = sourceRuns.map((run) => ({ ...run, scope: researchScopes[0] }));
  const collectedAt = new Date().toISOString();
  await writeFile(observationPath, JSON.stringify({ schemaVersion: 1, collectedAt, criteria: { market: criteria?.market ?? 'pittsburgh' }, homes: canonicalHomes, observations, evidence: canonicalEvidence, sources, sourceRuns: scopedRuns, researchScopes, captures, warnings }, null, 2), 'utf8');
  onProgress(`Collected ${unique.size} unique source observations across ${runs.filter((run) => run.pagesFetched > 0).length} public organizations`);
  return { homes: canonicalHomes, observations, evidence: canonicalEvidence, sources, sourceRuns: scopedRuns, researchScopes, captures, warnings };
}

export const collectObservedSources = collectSources;
