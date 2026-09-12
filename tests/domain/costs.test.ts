import { describe, expect, test } from 'vitest';
import { computeCosts, personalRentWithinCap } from '../../src/domain/costs.js';
import { SEED_CRITERIA } from '../../src/domain/schema.js';
import { home2400 } from '../fixtures/homes.js';

describe('computeCosts', () => {
  test('allocates exact whole-home rent and per-person recurring fees without treating unknown electricity as zero', () => {
    const cost = computeCosts(home2400(), SEED_CRITERIA);
    expect(cost.personalBaseRent).toBe(120000);
    expect(cost.knownPersonalRecurring).toBe(122000);
    expect(cost.unknownItems).toContainEqual({ key: 'electricity', reason: 'Utility inclusion is not stated.' });
  });

  test('does not qualify assumed rent or add optional fees to mandatory costs', () => {
    const base = home2400();
    const home = home2400({
      rent: { ...base.rent, amount: { ...base.rent.amount, state: 'assumed', evidenceIds: [], method: 'title guess' } },
      charges: [...base.charges, { ...base.charges[0]!, id: 'test:charge:optional', required: { ...base.charges[0]!.required, value: false } }],
    });
    const cost = computeCosts(home, SEED_CRITERIA);
    expect(personalRentWithinCap(home, SEED_CRITERIA)).toBeNull();
    expect(cost.personalBaseRent).toBeNull();
    expect(cost.unknownItems).toContainEqual(expect.objectContaining({ key: 'base_rent' }));
    expect(cost.unknownItems.some((item) => item.key === 'charge:test:charge:optional')).toBe(false);
  });

  test('does not invent unlisted other utility bills or bill inapplicable utilities', () => {
    const base = home2400();
    const notApplicable = { ...base.utilities[0]!.applicable, value: false };
    const unknown = { value: null, state: 'unknown' as const, evidenceIds: [], method: null, observedAt: null };
    const home = home2400({ utilities: [
      { name: 'other', inclusion: unknown, chargeIds: [], terms: unknown, applicable: notApplicable },
      { name: 'gas', inclusion: unknown, chargeIds: [], terms: unknown, applicable: notApplicable },
    ] });
    expect(computeCosts(home, SEED_CRITERIA).unknownItems.map((item) => item.key)).not.toEqual(expect.arrayContaining(['other', 'gas']));
  });

  test('keeps undisclosed mandatory fees unresolved when no fee evidence is present', () => {
    const cost = computeCosts(home2400({ charges: [] }), SEED_CRITERIA);
    expect(cost.unknownItems).toContainEqual(expect.objectContaining({ key: 'mandatory_fees' }));
    expect(cost.completeness).toBe('known_components_only');
  });
});
