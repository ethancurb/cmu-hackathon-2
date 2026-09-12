import { describe, expect, test } from 'vitest';
import { CriteriaSchema, SEED_CRITERIA, validateSnapshot } from '../../src/domain/schema.js';
import { home2400, syntheticSnapshot } from '../fixtures/homes.js';

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

  test('builds synthetic snapshots with evidence scoped to each fact', () => {
    expect(validateSnapshot(syntheticSnapshot([home2400()])).homes).toHaveLength(1);
  });

  test('rejects evidence that points at an undeclared source', () => {
    const snapshot = syntheticSnapshot([home2400()]);
    snapshot.evidence[0]!.sourceId = 'test:missing-source';
    expect(() => validateSnapshot(snapshot)).toThrow('evidence references missing source');
  });
});
