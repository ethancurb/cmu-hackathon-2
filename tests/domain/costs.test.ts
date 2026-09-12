import { describe, expect, test } from 'vitest';
import { computeCosts } from '../../src/domain/costs.js';
import { SEED_CRITERIA } from '../../src/domain/schema.js';
import { home2400 } from '../fixtures/homes.js';

describe('computeCosts', () => {
  test('allocates exact whole-home rent and per-person recurring fees without treating unknown electricity as zero', () => {
    const cost = computeCosts(home2400(), SEED_CRITERIA);
    expect(cost.personalBaseRent).toBe(120000);
    expect(cost.knownPersonalRecurring).toBe(122000);
    expect(cost.unknownItems).toContainEqual({ key: 'electricity', reason: 'Utility inclusion is not stated.' });
  });
});
