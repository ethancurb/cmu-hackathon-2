import { describe, expect, test } from 'vitest';
import { CriteriaSchema, SEED_CRITERIA } from '../../src/domain/schema.js';

describe('criteria contract', () => {
  test('rejects an incoherent equal-share allocation', () => {
    expect(CriteriaSchema.safeParse({
      ...SEED_CRITERIA,
      allocation: { occupants: 2, kind: 'equal', personalShareBps: 9000 },
    }).success).toBe(false);
  });

  test('preserves the confirmed rent-only personal cap in cents', () => {
    expect(CriteriaSchema.parse(SEED_CRITERIA).personalRentCap).toBe(120000);
  });
});
