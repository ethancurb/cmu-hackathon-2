import { describe, expect, test } from 'vitest';
import { reconcileHomes } from '../../src/domain/reconcile.js';
import { home2400 } from '../fixtures/homes.js';

describe('reconcileHomes', () => {
  test('keeps same-address offers with distinct units as separate homes', () => {
    const unitA = home2400({ id: 'test:home:a', offerKey: 'test:offer:a', unitLabel: { ...home2400().unitLabel, value: 'A' } });
    const unitB = home2400({ id: 'test:home:b', offerKey: 'test:offer:b', unitLabel: { ...home2400().unitLabel, value: 'B' } });
    expect(reconcileHomes([unitA], [unitB]).map((home) => home.id)).toEqual(['test:home:a', 'test:home:b']);
  });
});
