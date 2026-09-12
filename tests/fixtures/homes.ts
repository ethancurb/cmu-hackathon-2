import type { Fact, Home, Snapshot, WalkRoute } from '../../src/domain/schema.js';
import { SEED_CRITERIA } from '../../src/domain/schema.js';

const at = '2026-09-12T09:00:00.000Z';
const evidenceId = (scopeKey: string) => `test:evidence:${encodeURIComponent(scopeKey)}`;
const sourced = <T>(value: T, scopeKey = 'test:offer:2400'): Fact<T> => ({ value, state: 'sourced', evidenceIds: [evidenceId(scopeKey)], method: null, observedAt: at });
const unknown = <T>(): Fact<T> => ({ value: null, state: 'unknown', evidenceIds: [], method: null, observedAt: null });

export const matchingRoute = (changes: Partial<WalkRoute> = {}): WalkRoute => ({
  id: 'test:route:home-2400', origin: { lat: 40.443, lon: -79.95 }, destinationId: SEED_CRITERIA.destination.id,
  destinationVersion: SEED_CRITERIA.destination.version, requestedDestination: SEED_CRITERIA.destination.coordinate,
  snappedOrigin: { lat: 40.443, lon: -79.95 }, snappedDestination: SEED_CRITERIA.destination.coordinate,
  status: 'ok', durationSeconds: 1200, distanceMeters: 900, geometry: { type: 'LineString', coordinates: [[-79.95, 40.443], [-79.9445593, 40.4440338]] }, provider: 'test-router', profile: 'foot', computedAt: at, errorCode: null,
  ...changes,
});

export const home2400 = (changes: Partial<Home> = {}): Home => ({
  id: 'test:home:2400', buildingKey: 'test:building:2400', offerKey: 'test:offer:2400', floorPlanKey: 'test:floorplan:2br', scope: 'unit', sourceListingIds: ['test:listing:2400'], primaryUrl: 'https://example.test/homes/2400', lastObservedAt: at,
  title: sourced('Synthetic $2,400 home', 'test:building:2400'), address: sourced('100 Test Street', 'test:building:2400'), unitLabel: sourced('Unit 2A'), coordinate: sourced({ lat: 40.443, lon: -79.95 }, 'test:building:2400'), propertyType: sourced('apartment', 'test:building:2400'),
  bedrooms: sourced(2, 'test:floorplan:2br'), bathrooms: sourced(2, 'test:floorplan:2br'), fullBaths: unknown(), halfBaths: unknown(),
  rent: { basis: 'whole_unit', period: 'month', amount: sourced(240000), upperAmount: unknown(), kind: 'exact', semantics: 'base_rent' },
  charges: [{ id: 'test:charge:twenty', label: 'Resident fee', amount: sourced(2000), cadence: 'monthly', allocation: 'per_person', required: sourced(true), refundable: sourced(false) }],
  utilities: [
    { name: 'electricity', inclusion: unknown(), chargeIds: [], terms: unknown(), applicable: unknown() },
    { name: 'water_sewer', inclusion: sourced('included'), chargeIds: [], terms: unknown(), applicable: sourced(true) },
  ],
  concessions: unknown(), availability: unknown(), leaseTerms: unknown(), listingStatus: 'observed', amenities: [], reviews: [], nearby: [], transit: [], routeIds: ['test:route:home-2400'], photo: null,
  ...changes,
});

export const syntheticSnapshot = (homes: Home[], routes: WalkRoute[] = [matchingRoute()]): Snapshot => {
  const scopeKeys = new Set(homes.flatMap((home) => [home.buildingKey, home.offerKey, ...(home.floorPlanKey ? [home.floorPlanKey] : [])]));
  return {
  schemaVersion: 1, id: 'test:snapshot:1', createdAt: at, discoveryMarket: SEED_CRITERIA.market, searchDescription: 'Synthetic test inventory only',
  researchScopes: [{ marketKey: 'pittsburgh|pa|us', areas: [], queriedBedrooms: [2], queriedMinBathrooms: 2, queriedMaxWholeRent: 240000, queriedPropertyTypes: ['house', 'apartment'], destinationVersion: SEED_CRITERIA.destination.version, scenarioMaxWalkSeconds: 1200, checkedAt: at, queryCount: 1, limitReasons: ['synthetic fixture'] }],
  homes, evidence: [...scopeKeys].map((scopeKey) => ({ id: evidenceId(scopeKey), sourceId: 'test:source', url: 'https://example.test/evidence', observedAt: at, channel: 'page' as const, captureHash: 'test-hash', scopeKey, scopeKind: scopeKey.includes(':building:') ? 'building' as const : scopeKey.includes(':floorplan:') ? 'floor_plan' as const : 'offer' as const, appliesToAllUnits: scopeKey.includes(':building:'), excerpt: 'Synthetic fixture evidence', locator: 'test:row' })),
  routes, sources: [{ id: 'test:source', family: 'test', name: 'Synthetic source', url: 'https://example.test', accessMode: 'public_page', limitation: 'Synthetic fixture only' }], sourceRuns: [],
  };
};
