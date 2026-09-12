import { describe, expect, test } from 'vitest';
import { evaluateHome } from '../../src/domain/matching.js';
import { SEED_CRITERIA } from '../../src/domain/schema.js';
import { home2400, matchingRoute } from '../fixtures/homes.js';

describe('evaluateHome', () => {
  test('matches rent-only criteria while retaining an unknown utility as a readiness concern', () => {
    const result = evaluateHome(home2400(), SEED_CRITERIA, [matchingRoute()]);
    expect(result.fit).toBe('matches');
    expect(result.cost.unknownItems.some((item) => item.key === 'electricity')).toBe(true);
  });

  test('fails a one-cent over-budget whole-home rent using an exact ratio', () => {
    const result = evaluateHome(home2400({ rent: { ...home2400().rent, amount: { ...home2400().rent.amount, value: 240001 } } }), SEED_CRITERIA, [matchingRoute()]);
    expect(result.constraints.find((constraint) => constraint.key === 'personal_rent')?.outcome).toBe('fail');
  });

  test('fails an advertised 1.5 bathroom layout', () => {
    const result = evaluateHome(home2400({ bathrooms: { ...home2400().bathrooms, value: 1.5 } }), SEED_CRITERIA, [matchingRoute()]);
    expect(result.constraints.find((constraint) => constraint.key === 'bathrooms')?.outcome).toBe('fail');
  });

  test('fails a 1200.1-second route rather than rounding it down', () => {
    const result = evaluateHome(home2400(), SEED_CRITERIA, [matchingRoute({ durationSeconds: 1200.1 })]);
    expect(result.constraints.find((constraint) => constraint.key === 'walk')?.outcome).toBe('fail');
  });

  test('treats assumed hard facts as unknown rather than matches', () => {
    const base = home2400();
    const result = evaluateHome(home2400({ bedrooms: { ...base.bedrooms, state: 'assumed', evidenceIds: [], method: 'title guess' } }), SEED_CRITERIA, [matchingRoute()]);
    expect(result.constraints.find((constraint) => constraint.key === 'bedrooms')?.outcome).toBe('unknown');
    expect(result.fit).toBe('needs_verification');
  });

  test('uses the newest usable foot route for the requested destination coordinates', () => {
    const older = matchingRoute({ id: 'test:route:unavailable', status: 'unavailable', durationSeconds: null, distanceMeters: null, geometry: null, snappedOrigin: null, snappedDestination: null, computedAt: '2026-09-12T08:00:00.000Z' });
    const newer = matchingRoute({ id: 'test:route:usable', computedAt: '2026-09-12T10:00:00.000Z' });
    const result = evaluateHome(home2400({ routeIds: [older.id, newer.id] }), SEED_CRITERIA, [older, newer]);
    expect(result.routeId).toBe(newer.id);
    expect(result.constraints.find((constraint) => constraint.key === 'walk')?.outcome).toBe('pass');
  });

  test('asks about unknown bathrooms before secondary utility questions', () => {
    const base = home2400();
    const result = evaluateHome(home2400({ bathrooms: { ...base.bathrooms, value: null, state: 'unknown', evidenceIds: [], method: null, observedAt: null } }), SEED_CRITERIA, [matchingRoute()]);
    expect(result.questions.map((question) => question.key).indexOf('hard:bathrooms')).toBeLessThan(result.questions.map((question) => question.key).indexOf('cost:electricity'));
  });
});
