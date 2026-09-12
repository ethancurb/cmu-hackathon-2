import { describe, expect, test } from 'vitest';
import {
  buildDigest, coreCloseness, digestHome, eligibleForNicheGroup, homesWithoutJudgeableData,
  rankByCoreCloseness, usableAssessments, withinTolerance,
} from '../../src/domain/niche.js';
import { evaluateHome } from '../../src/domain/matching.js';
import { SEED_CRITERIA } from '../../src/domain/schema.js';
import type { NicheAssessment } from '../../src/domain/schema.js';
import { home2400, matchingRoute, syntheticSnapshot } from '../fixtures/homes.js';

const rent = (value: number, id: string) => home2400({ id, rent: { ...home2400().rent, amount: { ...home2400().rent.amount, value } } });
const verdict = (homeId: string, changes: Partial<NicheAssessment> = {}): NicheAssessment => ({
  homeId, matches: true, confidence: 'strong', reason: 'Synthetic verdict', provenance: 'listing_data', citedPlaceIds: [], mitigates: null, ...changes,
});
const evaluate = (homes: ReturnType<typeof home2400>[], routes = [matchingRoute()]) => {
  const snapshot = syntheticSnapshot(homes, routes);
  return { snapshot, results: homes.map((home) => evaluateHome(home, SEED_CRITERIA, snapshot.routes)) };
};

describe('withinTolerance', () => {
  test('admits a rent overage inside 10% and rejects one beyond it', () => {
    expect(withinTolerance({ key: 'personal_rent', outcome: 'fail', required: 120000, actual: 120750, delta: null, unit: null, evidenceIds: [] })).toBe(true);
    expect(withinTolerance({ key: 'personal_rent', outcome: 'fail', required: 120000, actual: 140000, delta: null, unit: null, evidenceIds: [] })).toBe(false);
  });

  test('admits one bathroom below the requirement but not two', () => {
    expect(withinTolerance({ key: 'bathrooms', outcome: 'fail', required: 2, actual: 1, delta: null, unit: 'bathrooms', evidenceIds: [] })).toBe(true);
    expect(withinTolerance({ key: 'bathrooms', outcome: 'fail', required: 3, actual: 1, delta: null, unit: 'bathrooms', evidenceIds: [] })).toBe(false);
  });

  test('rejects a failed dial no tolerance entry covers', () => {
    expect(withinTolerance({ key: 'bedrooms', outcome: 'fail', required: 2, actual: 1, delta: null, unit: 'bedrooms', evidenceIds: [] })).toBe(false);
    expect(withinTolerance({ key: 'property_type', outcome: 'fail', required: 'house, apartment', actual: 'room', delta: null, unit: null, evidenceIds: [] })).toBe(false);
  });

  test('treats an unknown constraint as tolerable because it is not a failure', () => {
    expect(withinTolerance({ key: 'walk', outcome: 'unknown', required: 1200, actual: null, delta: null, unit: 'seconds', evidenceIds: [] })).toBe(true);
  });
});

describe('coreCloseness', () => {
  test('ranks by failed-dial count before overage size', () => {
    const { results } = evaluate([rent(240000, 'test:clean'), rent(600000, 'test:dear')]);
    expect(coreCloseness(results[0]!).failedDials).toBe(0);
    expect(coreCloseness(results[1]!).failedDials).toBe(1);
  });

  test('scores a $7.50 overage below a $168 overage', () => {
    const { results } = evaluate([rent(241500, 'test:almost'), rent(273600, 'test:further')]);
    expect(coreCloseness(results[0]!).overage).toBeLessThan(coreCloseness(results[1]!).overage);
  });
});

describe('rankByCoreCloseness', () => {
  test('orders the group by closeness and keeps a passing home first', () => {
    const homes = [rent(252000, 'test:far'), rent(240000, 'test:exact'), rent(241500, 'test:almost')];
    const { snapshot, results } = evaluate(homes);
    const ranked = rankByCoreCloseness(homes.map((home) => verdict(home.id)), results, snapshot);
    expect(ranked.map((entry) => entry.homeId)).toEqual(['test:exact', 'test:almost', 'test:far']);
  });

  test('drops a home whose overage exceeds the declared tolerance', () => {
    // $2,736 whole-home is $1,368 each against a $1,200 cap — 14%, outside the 10% band.
    const homes = [rent(273600, 'test:beyond')];
    const { snapshot, results } = evaluate(homes);
    expect(eligibleForNicheGroup(results[0]!)).toBe(false);
    expect(rankByCoreCloseness([verdict('test:beyond')], results, snapshot)).toEqual([]);
  });

  test('excludes a non-matching verdict and a home outside tolerance', () => {
    const homes = [rent(240000, 'test:no'), rent(600000, 'test:dear')];
    const { snapshot, results } = evaluate(homes);
    const ranked = rankByCoreCloseness([verdict('test:no', { matches: false }), verdict('test:dear')], results, snapshot);
    expect(ranked).toEqual([]);
  });

  test('places a strong match above a partial one at equal closeness', () => {
    const homes = [rent(240000, 'test:partial'), rent(240000, 'test:strong')];
    const { snapshot, results } = evaluate(homes);
    const ranked = rankByCoreCloseness([verdict('test:partial', { confidence: 'partial' }), verdict('test:strong')], results, snapshot);
    expect(ranked.map((entry) => entry.homeId)).toEqual(['test:strong', 'test:partial']);
  });

  test('never reports a fit the deterministic engine did not', () => {
    const homes = [rent(241500, 'test:almost')];
    const { snapshot, results } = evaluate(homes);
    const ranked = rankByCoreCloseness([verdict('test:almost', { mitigates: { constraintKey: 'personal_rent', reason: 'Cheaper groceries next door' } })], results, snapshot);
    expect(ranked[0]!.result.fit).toBe('near_match');
    expect(ranked[0]!.result.constraints.find((constraint) => constraint.key === 'personal_rent')?.outcome).toBe('fail');
  });
});

describe('usableAssessments', () => {
  test('drops a verdict citing a place the home does not carry', () => {
    const { snapshot } = evaluate([home2400({ id: 'test:home:2400' })]);
    expect(usableAssessments([verdict('test:home:2400', { citedPlaceIds: ['osm:node:999'] })], snapshot)).toEqual([]);
  });

  test('drops a verdict for a home the snapshot does not contain', () => {
    const { snapshot } = evaluate([home2400({ id: 'test:home:2400' })]);
    expect(usableAssessments([verdict('test:ghost')], snapshot)).toEqual([]);
  });
});

describe('buildDigest', () => {
  const withContext = home2400({
    id: 'test:home:context',
    amenities: [
      { key: 'context_dishwasher', label: 'Dishwasher', fact: { value: true, state: 'sourced', evidenceIds: [], method: null, observedAt: null }, scope: 'unit' },
      { key: 'context_sauna', label: 'Sauna', fact: { value: false, state: 'sourced', evidenceIds: [], method: null, observedAt: null }, scope: 'building' },
    ],
    nearby: [{ id: 'osm:node:1', name: 'Fudi Asian Mart', category: 'supermarket', coordinate: { lat: 40.44, lon: -79.95 }, distanceMeters: 228.7, distanceBasis: 'straight_line', walkSeconds: null, evidenceIds: [] }],
    transit: [
      { originStopId: 's1', originStopName: 'Fifth Ave', distanceMeters: 80, distanceBasis: 'straight_line', routeShortName: '61C', headsign: 'Downtown', destinationStopId: 's9', servesDestination: true, serviceDate: '2026-09-12', window: '08:00-10:00', feedVersion: 'v1', evidenceIds: [] },
      { originStopId: 's2', originStopName: 'Fifth Ave', distanceMeters: 80, distanceBasis: 'straight_line', routeShortName: '61C', headsign: 'Oakland', destinationStopId: null, servesDestination: false, serviceDate: '2026-09-12', window: '08:00-10:00', feedVersion: 'v1', evidenceIds: [] },
    ],
  });

  test('keeps only amenities the source confirmed true', () => {
    expect(digestHome(withContext).amenities).toEqual(['context_dishwasher']);
  });

  test('carries the place name, because the category alone cannot answer the query', () => {
    const [place] = digestHome(withContext).nearby;
    expect(place).toMatchObject({ name: 'Fudi Asian Mart', category: 'supermarket', metres: 229 });
  });

  test('deduplicates transit routes', () => {
    expect(digestHome(withContext).transit).toEqual([{ route: '61C', servesDestination: true }]);
  });

  test('omits rent and walk so the model cannot second-guess a core dial', () => {
    expect(JSON.stringify(digestHome(withContext))).not.toContain('240000');
    expect(digestHome(withContext)).not.toHaveProperty('rent');
  });

  test('counts homes with nothing to judge', () => {
    const bare = home2400({ id: 'test:bare', coordinate: { value: null, state: 'unknown', evidenceIds: [], method: null, observedAt: null } });
    expect(homesWithoutJudgeableData(buildDigest(syntheticSnapshot([bare])))).toBe(1);
    expect(homesWithoutJudgeableData(buildDigest(syntheticSnapshot([withContext])))).toBe(0);
  });
});
