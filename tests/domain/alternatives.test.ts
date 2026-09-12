import { describe, expect, test } from 'vitest';
import { suggestAlternatives } from '../../src/domain/alternatives.js';
import { SEED_CRITERIA } from '../../src/domain/schema.js';
import { home2400, matchingRoute, syntheticSnapshot } from '../fixtures/homes.js';

describe('suggestAlternatives', () => {
  test('reports only an actual newly matched home after the smallest rent relaxation', () => {
    const expensive = home2400({ id: 'test:home:over', rent: { ...home2400().rent, amount: { ...home2400().rent.amount, value: 240002 } } });
    const alternatives = suggestAlternatives(syntheticSnapshot([expensive]), SEED_CRITERIA);
    expect(alternatives.some((alternative) => alternative.newlyMatchedIds.includes('test:home:over') && alternative.patch.personalRentCap === 120001)).toBe(true);
  });

  test('keeps one alternative from each meaningful sacrifice group', () => {
    const expensive = home2400({ id: 'test:home:expensive', rent: { ...home2400().rent, amount: { ...home2400().rent.amount, value: 250000 } } });
    const bath = home2400({ id: 'test:home:bath', bathrooms: { ...home2400().bathrooms, value: 1.5 } });
    const walk = home2400({ id: 'test:home:walk', routeIds: ['test:route:long'] });
    const longRoute = matchingRoute({ id: 'test:route:long', durationSeconds: 1400 });
    const alternatives = suggestAlternatives(syntheticSnapshot([expensive, bath, walk], [matchingRoute(), longRoute]), SEED_CRITERIA);
    expect(alternatives.map((alternative) => alternative.changed[0]!.key)).toEqual(expect.arrayContaining(['personalRentCap', 'minBathrooms', 'maxWalkSeconds']));
  });
});
