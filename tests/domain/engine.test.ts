import { describe, expect, test } from 'vitest';
import { evaluateSearch } from '../../src/domain/engine.js';
import { SEED_CRITERIA } from '../../src/domain/schema.js';
import { home2400, syntheticSnapshot } from '../fixtures/homes.js';

describe('evaluateSearch', () => {
  test('does not evaluate Pittsburgh inventory as an option in a different market', () => {
    const criteria = { ...SEED_CRITERIA, market: { label: 'Cleveland', region: 'OH', country: 'US' as const } };
    const result = evaluateSearch(syntheticSnapshot([home2400()]), criteria, 'test:request:cleveland');
    expect(result.results).toEqual([]);
    expect(result.alternatives).toEqual([]);
    expect(result.discoveryNeeded).toBe(true);
  });
});
