import { describe, expect, test } from 'vitest';
import { needsDiscovery } from '../../src/domain/coverage.js';
import { SEED_CRITERIA } from '../../src/domain/schema.js';
import { syntheticSnapshot } from '../fixtures/homes.js';

const scope = syntheticSnapshot([]).researchScopes;
describe('needsDiscovery', () => {
  test('reuses an unchanged supported scope', () => expect(needsDiscovery(SEED_CRITERIA, scope)).toEqual({ needed: false, reason: null }));
  test('requests discovery for a larger whole-home ceiling than queried', () => expect(needsDiscovery({ ...SEED_CRITERIA, personalRentCap: 130000 }, scope).needed).toBe(true));
  test('requests discovery when destination version changes', () => expect(needsDiscovery({ ...SEED_CRITERIA, destination: { ...SEED_CRITERIA.destination, version: 'new-destination' } }, scope).needed).toBe(true));
  test('requests discovery for a new city', () => expect(needsDiscovery({ ...SEED_CRITERIA, market: { ...SEED_CRITERIA.market, label: 'Cleveland' } }, scope).needed).toBe(true));
});
