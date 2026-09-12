import { describe, expect, test } from 'vitest';
import { reconcileHomes } from '../../src/domain/reconcile.js';
import { home2400 } from '../fixtures/homes.js';

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
});
