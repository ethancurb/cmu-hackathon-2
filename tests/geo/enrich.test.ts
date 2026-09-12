import { describe, expect, test, vi } from 'vitest';
import { enrichRoutes, enrichSnapshot } from '../../jobs/geo/enrich.js';
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
});
