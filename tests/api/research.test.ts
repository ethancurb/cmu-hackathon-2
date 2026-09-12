import { describe, expect, it } from 'vitest';
import { SEED_CRITERIA } from '../../src/config/seed.js';
import { home2400, syntheticSnapshot } from '../fixtures/homes.js';
import { appendLeads, attachDestination } from '../../server/research.js';
import { carryForward } from '../../server/workflows.js';

describe('lead research provenance', () => {
  it('preserves the Gates mapping observation date across later snapshots', () => {
    const snapshot = { ...syntheticSnapshot([]), createdAt: '2026-09-13T12:00:00.000Z' };
    const attached = attachDestination(snapshot, SEED_CRITERIA.destination);
    expect(attached.evidence.find(item => item.id === SEED_CRITERIA.destination.evidenceIds[0])?.observedAt).toBe('2026-09-12T08:16:00.000Z');
  });
  it('uses a corrected source coordinate and drops context tied to the previous location', () => {
    const old = home2400();
    old.routeIds = ['test:old-location-route'];
    const fresh = structuredClone(old);
    fresh.coordinate = { ...fresh.coordinate, value: { lat: 40.44706, lon: -79.95092 } };
    fresh.routeIds = [];
    const merged = carryForward(syntheticSnapshot([old]), syntheticSnapshot([fresh]));
    expect(merged.homes[0]?.coordinate.value).toEqual(fresh.coordinate.value);
    expect(merged.homes[0]?.routeIds).toEqual([]);
  });
  it('uses the surveyed portal identity for an unverified portal lead', () => {
    const snapshot = appendLeads(syntheticSnapshot([]), {
      queries: ['two bedroom Pittsburgh'],
      leads: [{ title: 'Portal lead', address: null, url: 'https://www.zillow.com/homedetails/example', excerpt: 'A search lead only', sourceName: 'Zillow' }],
      limitations: ['Search-index lead'], observedAt: '2026-09-12T10:00:00.000Z', captureHash: 'lead-capture',
    }, SEED_CRITERIA);
    expect(snapshot.homes[0]?.sourceListingIds).toEqual(['zillow']);
    expect(snapshot.evidence[0]?.sourceId).toBe('zillow');
    expect(snapshot.sources.find(source => source.id === 'zillow')?.accessMode).toBe('link_only');
    expect(snapshot.sourceRuns.find(run => run.sourceId === 'zillow')?.status).toBe('queried');
  });
});
