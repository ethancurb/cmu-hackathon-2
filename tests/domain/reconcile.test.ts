import { describe, expect, test } from 'vitest';
import { diffSnapshots, reconcileHomes } from '../../src/domain/reconcile.js';
import { home2400, syntheticSnapshot } from '../fixtures/homes.js';

describe('reconcileHomes', () => {
  test('keeps same-address offers with distinct units as separate homes', () => {
    const unitA = home2400({ id: 'test:home:a', offerKey: 'test:offer:a', unitLabel: { ...home2400().unitLabel, value: 'A' } });
    const unitB = home2400({ id: 'test:home:b', offerKey: 'test:offer:b', unitLabel: { ...home2400().unitLabel, value: 'B' } });
    expect(reconcileHomes([unitA], [unitB]).map((home) => home.id)).toEqual(['test:home:a', 'test:home:b']);
  });

  test('does not merge a per-room offer into a whole-unit offer at the same building', () => {
    const wholeUnit = home2400({ id: 'test:home:whole', offerKey: 'test:offer:whole' });
    const room = home2400({ id: 'test:home:room', offerKey: 'test:offer:room', scope: 'room', rent: { ...home2400().rent, basis: 'per_room', amount: { ...home2400().rent.amount, value: 120000 } } });
    expect(reconcileHomes([wholeUnit], [room])).toHaveLength(2);
  });

  test('retains a previously observed offer when a later source run omits it', () => {
    expect(reconcileHomes([home2400()], []).map((home) => home.id)).toEqual(['test:home:2400']);
  });

  test('preserves conflicting duplicate observations and source provenance', () => {
    const previous = home2400({ sourceListingIds: ['test:listing:old'] });
    const incoming = home2400({ id: 'test:home:new-observation', sourceListingIds: ['test:listing:new'], lastObservedAt: '2026-09-12T10:00:00.000Z', rent: { ...home2400().rent, amount: { ...home2400().rent.amount, value: 230000 } } });
    expect(reconcileHomes([previous], [incoming]).map((home) => home.id)).toEqual([previous.id, incoming.id]);
  });

  test('ignores timestamp-only refreshes while retaining material changes', () => {
    const before = syntheticSnapshot([home2400()]);
    const same = home2400({ lastObservedAt: '2026-09-12T10:00:00.000Z', bedrooms: { ...home2400().bedrooms, observedAt: '2026-09-12T10:00:00.000Z' } });
    const changed = home2400({ rent: { ...home2400().rent, amount: { ...home2400().rent.amount, value: 239000 } } });
    expect(diffSnapshots(before, syntheticSnapshot([same])).changedIds).toEqual([]);
    expect(diffSnapshots(before, syntheticSnapshot([changed])).changedIds).toEqual([changed.id]);
  });

  test('treats fact state and evidence provenance as material refresh changes', () => {
    const before = syntheticSnapshot([home2400()]);
    const home = home2400({ bedrooms: { ...home2400().bedrooms, state: 'derived', method: 'declared conversion', evidenceIds: ['test:evidence:derived'] } });
    expect(diffSnapshots(before, syntheticSnapshot([home])).changedIds).toEqual([home.id]);
  });
});
