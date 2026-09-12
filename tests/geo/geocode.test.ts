import { describe, expect, test, vi } from 'vitest';
import { findDestinations, manualDestination } from '../../jobs/geo/geocode.js';
import { SEED_CRITERIA } from '../../src/domain/schema.js';

describe('destination lookup', () => {
  test('only geocodes an explicit submit and caches the result', async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify([{ place_id: 42, display_name: '5000 Forbes Ave, Pittsburgh', lat: '40.444', lon: '-79.944' }]), { status: 200 }));
    const options = { fetch: fetcher, cacheDirectory: `/private/tmp/geo-geocode-${process.pid}-${Date.now()}`, retryDelayMs: 0 };
    const first = await findDestinations('5000 Forbes Ave', SEED_CRITERIA.market, new AbortController().signal, options);
    const second = await findDestinations('5000 Forbes Ave', SEED_CRITERIA.market, new AbortController().signal, options);
    expect(first[0]?.coordinate).toEqual({ lat: 40.444, lon: -79.944 });
    expect(second).toEqual(first);
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  test('creates a valid manual-coordinate destination without pretending it was geocoded', () => {
    expect(manualDestination('My pinned destination', { lat: 40.44, lon: -79.94 }).caveat).toContain('Manual map pin');
  });

  test('returns no candidates when a submit lookup is unavailable so the caller can offer a manual pin', async () => {
    const fetcher = vi.fn().mockRejectedValue(new Error('offline'));
    await expect(findDestinations('5000 Forbes Ave', SEED_CRITERIA.market, new AbortController().signal, { fetch: fetcher, cacheDirectory: `/private/tmp/geo-geocode-failure-${process.pid}-${Date.now()}`, retryDelayMs: 0 })).resolves.toEqual([]);
  });
});
