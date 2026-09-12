import { describe, expect, it } from 'vitest';
import { SEED_CRITERIA } from '../../src/config/seed.js';
import { home2400, syntheticSnapshot } from '../fixtures/homes.js';
import { mergeImportedSnapshot } from '../../server/workflows.js';

describe('explicit listing imports', () => {
  it('does not relabel old-market inventory when importing into another market', () => {
    const previous = syntheticSnapshot([home2400()]);
    const fresh = { ...syntheticSnapshot([home2400({ id: 'ny-home' })]), id: 'ny-import', discoveryMarket: { label: 'New York', region: 'NY', country: 'US' as const } };
    const result = mergeImportedSnapshot(previous, fresh);
    expect(result.discoveryMarket).toEqual(fresh.discoveryMarket);
    expect(result.homes.map(home => home.id)).toEqual(['ny-home']);
    expect(result.routes).toEqual(fresh.routes);
  });

  it('keeps location and active transit context when a same-market import replaces a unit', () => {
    const transit = [{ originStopId: 'stop', originStopName: 'Stop', distanceMeters: 20, distanceBasis: 'straight_line' as const, routeShortName: '61A', headsign: 'CMU', destinationStopId: 'gates', servesDestination: true, serviceDate: '2026-09-14', window: '08:00–09:00', feedVersion: 'feed', evidenceIds: [], destinationId: SEED_CRITERIA.destination.id, destinationVersion: SEED_CRITERIA.destination.version }];
    const previousHome = home2400({ transit, nearby: [{ id: 'nearby', name: 'Cafe', category: 'cafe', coordinate: { lat: 40.443, lon: -79.95 }, distanceMeters: 50, distanceBasis: 'straight_line', walkSeconds: null, evidenceIds: [] }] });
    const importedHome = home2400({ coordinate: { value: null, state: 'unknown', evidenceIds: [], method: null, observedAt: null }, transit: [], nearby: [], routeIds: [] });
    const result = mergeImportedSnapshot(syntheticSnapshot([previousHome]), syntheticSnapshot([importedHome]));
    expect(result.homes[0]?.coordinate).toEqual(previousHome.coordinate);
    expect(result.homes[0]?.transit).toEqual(transit);
    expect(result.homes[0]?.routeIds).toEqual(previousHome.routeIds);
  });

  it('does not retain geographic context when a same-address replacement has moved coordinates', () => {
    const previousHome = home2400({ transit: [{ originStopId: 'stop', originStopName: 'Stop', distanceMeters: 20, distanceBasis: 'straight_line', routeShortName: '61A', headsign: 'CMU', destinationStopId: 'gates', servesDestination: true, serviceDate: '2026-09-14', window: '08:00–09:00', feedVersion: 'feed', evidenceIds: [], destinationId: SEED_CRITERIA.destination.id, destinationVersion: SEED_CRITERIA.destination.version }] });
    const moved = home2400({ coordinate: { value: { lat: 40.45, lon: -79.94 }, state: 'sourced', evidenceIds: ['test:evidence:building'], method: null, observedAt: '2026-09-12T09:00:00.000Z' }, transit: [], nearby: [], routeIds: [] });
    const result = mergeImportedSnapshot(syntheticSnapshot([previousHome]), syntheticSnapshot([moved]));
    expect(result.homes[0]?.coordinate).toEqual(moved.coordinate);
    expect(result.homes[0]?.transit).toEqual([]);
    expect(result.homes[0]?.nearby).toEqual([]);
    expect(result.homes[0]?.routeIds).toEqual([]);
  });
});
