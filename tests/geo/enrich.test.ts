import { describe, expect, test, vi } from 'vitest';
import { enrichRoutes, enrichSnapshot, supportsPrt } from '../../jobs/geo/enrich.js';
import { SEED_CRITERIA } from '../../src/domain/schema.js';
import { home2400, matchingRoute, syntheticSnapshot } from '../fixtures/homes.js';

describe('enrichRoutes', () => {
  test('routes only placed homes and preserves an unplaced lead without fabricating an origin', async () => {
    const placed = home2400({ routeIds: ['route:obsolete'] });
    const unplaced = home2400({ id: 'test:home:unplaced', coordinate: { value: null, state: 'unknown', evidenceIds: [], method: null, observedAt: null }, routeIds: [] });
    const router = vi.fn().mockResolvedValue({
      id: 'route:actual', origin: placed.coordinate.value, destinationId: SEED_CRITERIA.destination.id, destinationVersion: SEED_CRITERIA.destination.version,
      requestedDestination: SEED_CRITERIA.destination.coordinate, snappedOrigin: placed.coordinate.value, snappedDestination: SEED_CRITERIA.destination.coordinate,
      status: 'ok', durationSeconds: 999.9, distanceMeters: 700, geometry: { type: 'LineString', coordinates: [[-79.95, 40.443], [-79.9445593, 40.4440338]] }, provider: 'test', profile: 'foot', computedAt: '2026-09-12T09:00:00.000Z', errorCode: null,
    });
    const result = await enrichRoutes(syntheticSnapshot([placed, unplaced], [matchingRoute({ id: 'route:obsolete' })]), SEED_CRITERIA.destination, new AbortController().signal, { route: router });

    expect(router).toHaveBeenCalledTimes(1);
    expect(result.routes).toHaveLength(2);
    expect(result.homes.find((home) => home.id === placed.id)?.routeIds).toEqual(['route:actual']);
    expect(result.homes.find((home) => home.id === unplaced.id)?.routeIds).toEqual([]);
  });

  test('propagates an aborted transit request instead of publishing an incomplete snapshot', async () => {
    const controller = new AbortController();
    controller.abort(new DOMException('Stopped', 'AbortError'));
    await expect(enrichSnapshot(syntheticSnapshot([], []), SEED_CRITERIA, controller.signal, undefined, { loadGtfs: async () => { throw controller.signal.reason; } })).rejects.toThrow('Stopped');
  });

  test('does not attach Pittsburgh-only transit context to an out-of-market destination', async () => {
    const criteria = { ...SEED_CRITERIA, market: { label: 'Chicago', region: 'IL', country: 'US' as const }, destination: { ...SEED_CRITERIA.destination, coordinate: { lat: 41.878, lon: -87.63 } } };
    const loadGtfs = vi.fn(); const messages: string[] = [];
    const result = await enrichSnapshot(syntheticSnapshot([], []), criteria, new AbortController().signal, (message) => messages.push(message), { loadGtfs, queryOsm: async () => [] });
    expect(supportsPrt(criteria)).toBe(false);
    expect(loadGtfs).not.toHaveBeenCalled();
    expect(result.homes).toEqual([]);
    expect(messages.join(' ')).toContain('unsupported outside Pittsburgh');
  });

  test('drops transit for an old destination when GTFS refresh fails', async () => {
    const criteria = { ...SEED_CRITERIA, destination: { ...SEED_CRITERIA.destination, id: 'destination:alternate', version: 'alternate-v1', label: 'Alternate campus point' } };
    const home = home2400({ transit: [{ originStopId: 'old-stop', originStopName: 'Old stop', distanceMeters: 40, distanceBasis: 'straight_line', routeShortName: '61A', headsign: 'CMU', destinationStopId: 'gates-stop', servesDestination: true, serviceDate: '2026-09-14', window: '08:00–09:00', feedVersion: 'feed-old', evidenceIds: [], destinationId: SEED_CRITERIA.destination.id, destinationVersion: SEED_CRITERIA.destination.version }] });
    const result = await enrichSnapshot(syntheticSnapshot([home]), criteria, new AbortController().signal, undefined, {
      route: async () => matchingRoute({ destinationId: criteria.destination.id, destinationVersion: criteria.destination.version, requestedDestination: criteria.destination.coordinate, snappedDestination: criteria.destination.coordinate }),
      loadGtfs: async () => { throw new Error('GTFS unavailable'); }, queryOsm: async () => [],
    });
    expect(result.homes[0]?.transit).toEqual([]);
  });

  test('keeps exact-destination transit when a same-destination GTFS refresh fails', async () => {
    const context = { originStopId: 'current-stop', originStopName: 'Current stop', distanceMeters: 40, distanceBasis: 'straight_line' as const, routeShortName: '61A', headsign: 'CMU', destinationStopId: 'gates-stop', servesDestination: true, serviceDate: '2026-09-14', window: '08:00–09:00', feedVersion: 'feed-current', evidenceIds: [], destinationId: SEED_CRITERIA.destination.id, destinationVersion: SEED_CRITERIA.destination.version };
    const home = home2400({ transit: [context] });
    const result = await enrichSnapshot(syntheticSnapshot([home]), SEED_CRITERIA, new AbortController().signal, undefined, {
      route: async () => matchingRoute(), loadGtfs: async () => { throw new Error('GTFS unavailable'); }, queryOsm: async () => [],
    });
    expect(result.homes[0]?.transit).toEqual([context]);
  });
});
