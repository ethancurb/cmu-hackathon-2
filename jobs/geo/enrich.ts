import { createHash } from 'node:crypto';
import type { Criteria, Destination, Evidence, Home, Snapshot, SourceEntry, WalkRoute } from '../../src/domain/schema.js';
import { isCoordinates } from './coordinates.js';
import { queryOsmEssentials, nearbyForHome, OSM_ATTRIBUTION } from './nearby.js';
import { cacheCompactGtfs, compactGtfsForPoints, loadPrtGtfs, findTransitContexts, PRT_ATTRIBUTION, type GtfsFeed } from './transit.js';
import { routeFoot, type FootRouteOptions } from './walk.js';

type Progress = (message: string) => void;
export type RouteEnrichmentOptions = { route?: (origin: Home['coordinate']['value'] & {}, destination: Destination, signal: AbortSignal) => Promise<WalkRoute> } & FootRouteOptions;
export type SnapshotEnrichmentOptions = RouteEnrichmentOptions & { loadGtfs?: (signal: AbortSignal) => Promise<GtfsFeed>; queryOsm?: (center: Destination['coordinate'], signal: AbortSignal) => ReturnType<typeof queryOsmEssentials>; now?: () => Date };
const hash = (value: string) => createHash('sha256').update(value).digest('hex').slice(0, 20);
const source = (id: string, family: string, name: string, url: string, limitation: string | null): SourceEntry => ({ id, family, name, url, accessMode: 'public_page', limitation });
const upsert = <T extends { id: string }>(items: T[], item: T) => items.some((existing) => existing.id === item.id) ? items : [...items, item];
const replaceRoute = (routes: WalkRoute[], route: WalkRoute) => [...routes.filter((existing) => existing.id !== route.id), route];
const currentDateNewYork = (now: Date) => {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(now);
  const get = (type: string) => parts.find((part) => part.type === type)?.value;
  return `${get('year')}-${get('month')}-${get('day')}`;
};
const evidence = (id: string, sourceId: string, url: string, version: string, excerpt: string): Evidence => ({ id, sourceId, url, observedAt: new Date().toISOString(), channel: 'dataset', captureHash: hash(version), scopeKey: `dataset:${id}`, scopeKind: 'dataset', appliesToAllUnits: true, excerpt, locator: version });

export async function enrichRoutes(snapshot: Snapshot, destination: Destination, signal: AbortSignal, options: RouteEnrichmentOptions = {}): Promise<Snapshot> {
  const footSource = source('geo:fossgis-foot', 'OpenStreetMap', 'FOSSGIS routed-foot', 'https://routing.openstreetmap.de/about.html', 'Public community foot-routing service; at most one request per second and no service-level guarantee.');
  let routes = snapshot.routes;
  const homes: Home[] = [];
  const router = options.route ?? ((origin, activeDestination, activeSignal) => routeFoot(origin, activeDestination, activeSignal, options));
  for (const home of snapshot.homes) {
    if (!isCoordinates(home.coordinate.value)) { homes.push(home); continue; }
    const priorRouteIdsForDestination = new Set(routes.filter((candidate) => candidate.destinationId === destination.id && candidate.destinationVersion === destination.version).map((candidate) => candidate.id));
    const route = await router(home.coordinate.value, destination, signal);
    routes = replaceRoute(routes, route);
    homes.push({ ...home, routeIds: [...new Set([...home.routeIds.filter((id) => !priorRouteIdsForDestination.has(id)), route.id])] });
  }
  return { ...snapshot, homes, routes, sources: upsert(snapshot.sources, footSource) };
}

export async function enrichSnapshot(snapshot: Snapshot, criteria: Criteria, signal: AbortSignal, onProgress?: Progress, options: SnapshotEnrichmentOptions = {}): Promise<Snapshot> {
  const placed = snapshot.homes.filter((home) => isCoordinates(home.coordinate.value)).length;
  onProgress?.(`Routing ${placed} placed homes to ${criteria.destination.label}.`);
  let enriched = await enrichRoutes(snapshot, criteria.destination, signal, options);
  const now = options.now ?? (() => new Date());
  try {
    onProgress?.('Loading official PRT schedule context.');
    const downloadedFeed = await (options.loadGtfs ?? loadPrtGtfs)(signal);
    const feed = compactGtfsForPoints(downloadedFeed, [criteria.destination.coordinate, ...enriched.homes.flatMap((home) => isCoordinates(home.coordinate.value) ? [home.coordinate.value] : [])]);
    await cacheCompactGtfs(feed, [criteria.destination.coordinate, ...enriched.homes.flatMap((home) => isCoordinates(home.coordinate.value) ? [home.coordinate.value] : [])]).catch(() => undefined);
    const sourceEntry = source('geo:prt', 'Pittsburgh Regional Transit', 'Official PRT GTFS', 'https://www.rideprt.org/developerresources/GTFS.zip', PRT_ATTRIBUTION);
    const evidenceId = `evidence:prt:${hash(feed.version)}`;
    const contextEvidence = evidence(evidenceId, sourceEntry.id, sourceEntry.url, feed.version, PRT_ATTRIBUTION);
    const serviceDate = currentDateNewYork(now());
    enriched = { ...enriched, sources: upsert(enriched.sources, sourceEntry), evidence: upsert(enriched.evidence, contextEvidence), homes: enriched.homes.map((home) => isCoordinates(home.coordinate.value) ? { ...home, transit: findTransitContexts(home.coordinate.value, criteria.destination.coordinate, feed, serviceDate, evidenceId) } : home) };
  } catch (error) {
    if (signal.aborted) throw error;
    onProgress?.(`Transit context unavailable: ${error instanceof Error ? error.message : 'unknown error'}.`);
  }
  try {
    onProgress?.('Querying nearby OSM essentials once for the active research area.');
    const places = await (options.queryOsm ?? queryOsmEssentials)(criteria.destination.coordinate, signal);
    const sourceEntry = source('geo:openstreetmap', 'OpenStreetMap', 'OpenStreetMap essentials', 'https://www.openstreetmap.org/', OSM_ATTRIBUTION);
    const evidenceId = `evidence:osm:${hash(`${criteria.destination.coordinate.lat}|${criteria.destination.coordinate.lon}`)}`;
    const contextEvidence = evidence(evidenceId, sourceEntry.id, 'https://overpass-api.de/api/interpreter', criteria.destination.version, OSM_ATTRIBUTION);
    enriched = { ...enriched, sources: upsert(enriched.sources, sourceEntry), evidence: upsert(enriched.evidence, contextEvidence), homes: enriched.homes.map((home) => isCoordinates(home.coordinate.value) ? { ...home, nearby: nearbyForHome(home.coordinate.value, places, evidenceId) } : home) };
  } catch (error) {
    if (signal.aborted) throw error;
    onProgress?.(`Nearby essentials unavailable: ${error instanceof Error ? error.message : 'unknown error'}.`);
  }
  return enriched;
}
