import { describe, expect, test, vi } from 'vitest';
import { SEED_CRITERIA } from '../../src/domain/schema.js';
import { routeFoot } from '../../jobs/geo/walk.js';

const origin = { lat: 40.44185, lon: -79.94965 };
let cacheNumber = 0;
const cacheDirectory = () => `/private/tmp/geo-walk-test-${process.pid}-${cacheNumber++}`;

const response = (overrides: Record<string, unknown> = {}) => ({
  code: 'Ok',
  waypoints: [
    { location: [origin.lon, origin.lat] },
    { location: [SEED_CRITERIA.destination.coordinate.lon, SEED_CRITERIA.destination.coordinate.lat] },
  ],
  routes: [{
    duration: 1200.1,
    distance: 760.4,
    geometry: { type: 'LineString', coordinates: [[origin.lon, origin.lat], [SEED_CRITERIA.destination.coordinate.lon, SEED_CRITERIA.destination.coordinate.lat]] },
    legs: [{ steps: [{ mode: 'walking' }] }],
  }],
  ...overrides,
});

describe('routeFoot', () => {
  test('preserves raw seconds and GeoJSON lon/lat coordinates from the foot endpoint', async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify(response()), { status: 200 }));
    const route = await routeFoot(origin, SEED_CRITERIA.destination, new AbortController().signal, { fetch: fetcher, cacheDirectory: cacheDirectory() });

    expect(route.status).toBe('ok');
    expect(route.durationSeconds).toBe(1200.1);
    expect(route.geometry?.coordinates[0]).toEqual([origin.lon, origin.lat]);
    expect(fetcher.mock.calls[0]?.[0].toString()).toContain('/routed-foot/route/v1/driving/-79.94965,40.44185;-79.9445593,40.4440338');
  });

  test('marks a route unavailable when either OSRM snap exceeds 75 metres', async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify(response({ waypoints: [
      { location: [-79.960, 40.44185] },
      { location: [SEED_CRITERIA.destination.coordinate.lon, SEED_CRITERIA.destination.coordinate.lat] },
    ] })), { status: 200 }));

    const route = await routeFoot(origin, SEED_CRITERIA.destination, new AbortController().signal, { fetch: fetcher, cacheDirectory: cacheDirectory() });
    expect(route).toMatchObject({ status: 'needs_review', errorCode: 'SNAP_TOO_FAR', durationSeconds: 1200.1 });
  });

  test('returns an unavailable route rather than throwing when the router is unavailable', async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response('down', { status: 503 }));
    const route = await routeFoot(origin, SEED_CRITERIA.destination, new AbortController().signal, { fetch: fetcher, cacheDirectory: cacheDirectory(), retryDelayMs: 0 });
    expect(route).toMatchObject({ status: 'unavailable', errorCode: 'HTTP_503', geometry: null });
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  test('bounds a hanging router request with its timeout', async () => {
    const fetcher: typeof fetch = (_input, init) => new Promise<Response>((_resolve, reject) => init?.signal?.addEventListener('abort', () => reject(new DOMException('Timed out', 'AbortError')), { once: true }));
    const route = await routeFoot(origin, SEED_CRITERIA.destination, new AbortController().signal, { fetch: fetcher, cacheDirectory: cacheDirectory(), retryDelayMs: 0, timeoutMs: 1 });
    expect(route).toMatchObject({ status: 'unavailable', errorCode: 'NETWORK_ERROR' });
  });

  test('does not treat an empty steps array as verified foot travel', async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify(response({ routes: [{ ...response().routes[0], legs: [{ steps: [] }] }] })), { status: 200 }));
    const route = await routeFoot(origin, SEED_CRITERIA.destination, new AbortController().signal, { fetch: fetcher, cacheDirectory: cacheDirectory() });
    expect(route).toMatchObject({ status: 'needs_review', errorCode: 'MISSING_STEP_MODE' });
  });

  test('does not reuse a cached route when a destination coordinate changes under the same version', async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify(response()), { status: 200 }));
    const directory = cacheDirectory();
    await routeFoot(origin, SEED_CRITERIA.destination, new AbortController().signal, { fetch: fetcher, cacheDirectory: directory });
    await routeFoot(origin, { ...SEED_CRITERIA.destination, coordinate: { lat: 40.4441, lon: -79.9445 } }, new AbortController().signal, { fetch: fetcher, cacheDirectory: directory });
    expect(fetcher).toHaveBeenCalledTimes(2);
  });
});
