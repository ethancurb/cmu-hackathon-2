import { describe, expect, test } from 'vitest';
import { suggestAlternatives } from '../../src/domain/alternatives.js';
import { SEED_CRITERIA } from '../../src/domain/schema.js';
import { home2400, syntheticSnapshot } from '../fixtures/homes.js';

describe('suggestAlternatives', () => {
  test('reports only an actual newly matched home after the smallest rent relaxation', () => {
    const expensive = home2400({ id: 'test:home:over', rent: { ...home2400().rent, amount: { ...home2400().rent.amount, value: 240002 } } });
    const alternatives = suggestAlternatives(syntheticSnapshot([expensive]), SEED_CRITERIA);
    expect(alternatives.some((alternative) => alternative.newlyMatchedIds.includes('test:home:over') && alternative.patch.personalRentCap === 120001)).toBe(true);
  });
});
