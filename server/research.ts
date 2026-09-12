import { createHash, randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import type { Criteria, Destination, Evidence, Fact, Home, ResearchScope, Snapshot, SourceEntry } from '../src/domain/schema.js';
import { SEED_CRITERIA, validateSnapshot } from '../src/domain/schema.js';
import { findDestinations, geocodeEvidence } from '../jobs/geo/geocode.js';
import { metresBetween } from '../jobs/geo/coordinates.js';
import type { CollectedSources } from '../jobs/sources/collect.js';
import type { DiscoveryLeads } from './cli.js';

export const marketKey = (market: Criteria['market']) => `${market.label.split('/')[0]!.trim()}|${market.region}|${market.country}`.toLowerCase();
export const newSnapshotId = () => `research-${new Date().toISOString().replace(/\D/g, '').slice(0, 14)}-${randomUUID().slice(0, 8)}`;
export const uniqueById = <T extends { id: string }>(items: T[]): T[] => [...new Map(items.map(item => [item.id, item])).values()];
const hash = (value: string) => createHash('sha256').update(value).digest('hex').slice(0, 20);
export const unknown = <T>(): Fact<T> => ({ value: null, state: 'unknown', evidenceIds: [], observedAt: null, method: null });

export function researchScope(criteria: Criteria, checkedAt: string): ResearchScope {
  return { marketKey: marketKey(criteria.market), areas: [{ label: criteria.market.label, center: criteria.destination.coordinate, radiusMeters: null }], queriedBedrooms: null, queriedMinBathrooms: null, queriedMaxWholeRent: null, queriedPropertyTypes: null, destinationVersion: criteria.destination.version, scenarioMaxWalkSeconds: criteria.maxWalkSeconds, checkedAt, queryCount: 0, limitReasons: ['Bounded selected-source research; not an exhaustive inventory.'] };
}

export function attachDestination(snapshot: Snapshot, destination: Destination): Snapshot {
  let source: SourceEntry;
  let item: Evidence;
  if (destination.id === SEED_CRITERIA.destination.id) {
    source = { id: 'geo:gates-entrance', name: 'Gates Hillman mapped entrance', family: 'OpenStreetMap', url: 'https://www.openstreetmap.org/node/1704796692', accessMode: 'public_page', limitation: 'Mapped entrance; access has not been physically verified.' };
    item = { id: destination.evidenceIds[0]!, sourceId: source.id, url: source.url, observedAt: snapshot.createdAt, channel: 'dataset', captureHash: hash(destination.version), scopeKey: `dataset:${destination.id}`, scopeKind: 'dataset', appliesToAllUnits: true, excerpt: 'OSM node 1704796692: mapped Gates Hillman entrance at 40.4440338, -79.9445593.', locator: 'OSM node 1704796692' };
  } else if (/pin|manual|custom/i.test(destination.id + destination.version)) {
    source = { id: 'geo:map-selection', name: 'Your map selection', family: 'User selection', url: 'https://www.openstreetmap.org/', accessMode: 'link_only', limitation: 'User-selected point, not a verified entrance.' };
    item = { id: destination.evidenceIds[0]!, sourceId: source.id, url: `https://www.openstreetmap.org/?mlat=${destination.coordinate.lat}&mlon=${destination.coordinate.lon}`, observedAt: snapshot.createdAt, channel: 'user_import', captureHash: hash(JSON.stringify(destination)), scopeKey: `dataset:${destination.id}`, scopeKind: 'dataset', appliesToAllUnits: true, excerpt: `${destination.label}: user selected ${destination.coordinate.lat}, ${destination.coordinate.lon}`, locator: 'Explicit map selection' };
  } else ({ source, evidence: item } = geocodeEvidence(destination, snapshot.createdAt));
  const scopes = snapshot.researchScopes.some(scope => scope.destinationVersion === destination.version) ? snapshot.researchScopes : [...snapshot.researchScopes, { ...researchScope({ ...SEED_CRITERIA, market: snapshot.discoveryMarket, destination }, snapshot.createdAt), queriedBedrooms: [], limitReasons: ['Destination routed; additional housing discovery has not yet been performed.'] }];
  return { ...snapshot, sources: uniqueById([...snapshot.sources, source]), evidence: uniqueById([...snapshot.evidence, item]), researchScopes: scopes };
}

export function snapshotFromCollection(collected: Pick<CollectedSources, 'homes' | 'evidence' | 'sources' | 'sourceRuns' | 'researchScopes'>, criteria: Criteria, createdAt = new Date().toISOString()): Snapshot {
  return attachDestination({ schemaVersion: 1, id: newSnapshotId(), createdAt, discoveryMarket: criteria.market, searchDescription: `Selected public rental sources around ${criteria.destination.label}; all price and utility gaps retained.`, homes: collected.homes, evidence: collected.evidence, routes: [], sources: collected.sources, sourceRuns: collected.sourceRuns, researchScopes: collected.researchScopes }, criteria.destination);
}

export async function savedSeed(): Promise<Snapshot> {
  try { return validateSnapshot(JSON.parse(await readFile(path.join(process.cwd(), 'data', 'seed', 'cmu.json'), 'utf8'))); }
  catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error; }
  const collected = JSON.parse(await readFile(path.join(process.cwd(), 'data', 'seed', 'observations.json'), 'utf8')) as CollectedSources & { collectedAt: string };
  return validateSnapshot(snapshotFromCollection(collected, SEED_CRITERIA, collected.collectedAt));
}

/** Address geocodes are derivations, never fabricated source coordinates or surveyed entrances. */
export async function placeHomes(snapshot: Snapshot, criteria: Criteria, signal: AbortSignal, progress: (message: string) => void): Promise<Snapshot> {
  const homes: Home[] = []; const evidence = [...snapshot.evidence]; const sources = [...snapshot.sources];
  const market = { ...criteria.market, label: criteria.market.label.split('/')[0]!.trim() };
  for (const home of snapshot.homes) {
    signal.throwIfAborted();
    if (home.coordinate.value || !home.address.value) { homes.push(home); continue; }
    progress(`Locating ${home.address.value}.`);
    try {
      const candidates = await findDestinations(home.address.value, market, signal);
      const streetNumber = home.address.value.match(/^\s*(\d+)\b/)?.[1];
      const addressWords = home.address.value.toLowerCase().split(/[,\s]+/).filter(word => word.length > 3 && !['avenue', 'street', 'pittsburgh', 'road', 'drive', 'boulevard'].includes(word));
      const candidate = candidates.find(point => (!streetNumber || new RegExp(`\\b${streetNumber}\\b`).test(point.label)) && addressWords.some(word => point.label.toLowerCase().includes(word)) && metresBetween(point.coordinate, criteria.destination.coordinate) < 40_000);
      if (!candidate) { homes.push(home); continue; }
      const capture = geocodeEvidence(candidate);
      const item = { ...capture.evidence, id: `geocode:${home.id}:${hash(candidate.version)}`, scopeKey: home.buildingKey, scopeKind: 'building' as const, appliesToAllUnits: true, excerpt: `${home.address.value} → ${candidate.label}; ${candidate.coordinate.lat}, ${candidate.coordinate.lon}` };
      evidence.push(item); sources.push(capture.source);
      homes.push({ ...home, coordinate: { value: candidate.coordinate, state: 'derived', evidenceIds: [item.id], method: 'Nominatim address geocode; matched street number/name, not a surveyed building entrance.', observedAt: item.observedAt } });
    } catch (error) { if (signal.aborted) throw error; homes.push(home); progress(`Address location unavailable for ${home.address.value}; retained as an unplaced lead.`); }
  }
  return { ...snapshot, homes, evidence: uniqueById(evidence), sources: uniqueById(sources) };
}

export function appendLeads(snapshot: Snapshot, discovery: DiscoveryLeads, criteria: Criteria): Snapshot {
  const homes = [...snapshot.homes], evidence = [...snapshot.evidence], sources = [...snapshot.sources], runs = [...snapshot.sourceRuns];
  const scope = { ...researchScope(criteria, discovery.observedAt), queriedBedrooms: [criteria.bedrooms], queriedMinBathrooms: criteria.minBathrooms, queryCount: discovery.queries.length, limitReasons: ['Web search leads only; page/unit details are unverified.', ...discovery.limitations] };
  const bySource = new Map<string, { ids: string[]; urls: string[] }>();
  for (const lead of discovery.leads) {
    if (homes.some(home => home.primaryUrl.replace(/\/$/, '') === lead.url.replace(/\/$/, ''))) continue;
    const domain = new URL(lead.url).hostname.replace(/^www\./, '');
    const id = `lead-${hash(lead.url)}`, sourceId = `index:${domain}`, offerKey = `offer:${id}`, buildingKey = `building:${hash(lead.address ?? lead.url)}`;
    const item: Evidence = { id: `evidence:${id}:${discovery.captureHash.slice(0, 8)}`, sourceId, url: lead.url, observedAt: discovery.observedAt, channel: 'search_index', captureHash: discovery.captureHash, scopeKey: buildingKey, scopeKind: 'building', appliesToAllUnits: false, excerpt: lead.excerpt, locator: 'Model-organized web search lead; page details require verification.' };
    const proposed = <T>(value: T | null): Fact<T> => value === null ? unknown<T>() : ({ value, state: 'assumed', evidenceIds: [item.id], method: 'Unverified web-search lead organized by the research worker.', observedAt: discovery.observedAt });
    const home: Home = { id, buildingKey, offerKey, floorPlanKey: null, scope: 'building', sourceListingIds: [sourceId], primaryUrl: lead.url, lastObservedAt: discovery.observedAt, title: proposed(lead.title), address: proposed(lead.address), unitLabel: unknown(), coordinate: unknown(), propertyType: unknown(), bedrooms: unknown(), bathrooms: unknown(), fullBaths: unknown(), halfBaths: unknown(), rent: { basis: 'unknown', period: 'unknown', amount: unknown(), upperAmount: unknown(), kind: 'unknown', semantics: 'advertised_unspecified' }, charges: [], utilities: [], concessions: unknown(), availability: unknown(), leaseTerms: unknown(), listingStatus: 'observed', amenities: [], reviews: [], nearby: [], transit: [], routeIds: [], photo: null };
    homes.push(home); evidence.push(item);
    sources.push({ id: sourceId, name: lead.sourceName, family: domain, url: `https://${domain}/`, accessMode: 'index_leads', limitation: 'Search lead only; no verified unit price, layout, or availability imported.' });
    const group = bySource.get(sourceId) ?? { ids: [], urls: [] }; group.ids.push(id); group.urls.push(lead.url); bySource.set(sourceId, group);
  }
  for (const [sourceId, group] of bySource) runs.push({ sourceId, status: 'queried', method: 'Bounded Claude WebSearch lead discovery', startedAt: discovery.observedAt, completedAt: discovery.observedAt, urlsAttempted: group.urls, pagesFetched: 0, observations: group.ids.length, importedHomeIds: group.ids, duplicateObservations: 0, queryDescription: discovery.queries.join('; '), bounds: '105 seconds; at most 6 worker turns; 10 requested leads; hard facts remain unverified.', scope, error: null });
  return { ...snapshot, homes, evidence: uniqueById(evidence), sources: uniqueById(sources), sourceRuns: runs, researchScopes: [...snapshot.researchScopes, scope] };
}
