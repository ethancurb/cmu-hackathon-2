import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { WalkRouteSchema, type Coordinates, type Destination, type WalkRoute } from '../../src/domain/schema.js';
import { isCoordinates, metresBetween } from './coordinates.js';

const PROVIDER = 'https://routing.openstreetmap.de/routed-foot';
const CACHE_ROOT = join(process.cwd(), 'data', 'cache', 'geo', 'routes');
let lastRequestAt = 0;

type OsrmWaypoint = { location?: unknown };
type OsrmResponse = {
  code?: unknown;
  waypoints?: OsrmWaypoint[];
  routes?: Array<{ duration?: unknown; distance?: unknown; geometry?: { type?: unknown; coordinates?: unknown }; legs?: Array<{ steps?: Array<{ mode?: unknown }> }> }>;
};

export type FootRouteOptions = {
  fetch?: typeof fetch;
  cacheDirectory?: string;
  retryDelayMs?: number;
  timeoutMs?: number;
  now?: () => Date;
};

const routeId = (origin: Coordinates, destination: Destination) => `route:foot:${createHash('sha256').update(`${origin.lat},${origin.lon}|${destination.id}|${destination.version}|${destination.coordinate.lat},${destination.coordinate.lon}`).digest('hex').slice(0, 20)}`;
const cachePath = (origin: Coordinates, destination: Destination, directory: string) => join(directory, `${routeId(origin, destination).replaceAll(':', '-')}.json`);
const sleep = (ms: number, signal: AbortSignal) => new Promise<void>((resolve, reject) => {
  if (signal.aborted) { reject(signal.reason ?? new DOMException('Aborted', 'AbortError')); return; }
  const timeout = setTimeout(resolve, ms);
  signal.addEventListener('abort', () => { clearTimeout(timeout); reject(signal.reason ?? new DOMException('Aborted', 'AbortError')); }, { once: true });
});

const unavailable = (origin: Coordinates, destination: Destination, errorCode: string, now: () => Date): WalkRoute => ({
  id: routeId(origin, destination), origin, destinationId: destination.id, destinationVersion: destination.version,
  requestedDestination: destination.coordinate, snappedOrigin: null, snappedDestination: null, status: 'unavailable',
  durationSeconds: null, distanceMeters: null, geometry: null, provider: PROVIDER, profile: 'foot', computedAt: now().toISOString(), errorCode,
});

const asCoordinate = (value: unknown): Coordinates | null => {
  if (!Array.isArray(value) || value.length !== 2 || typeof value[0] !== 'number' || typeof value[1] !== 'number') return null;
  const coordinate = { lon: value[0], lat: value[1] };
  return isCoordinates(coordinate) ? coordinate : null;
};

const validLine = (value: unknown): [number, number][] | null => {
  if (!Array.isArray(value) || value.length < 2) return null;
  const coordinates = value.map((point) => asCoordinate(point));
  return coordinates.every((point) => point !== null) ? coordinates.map((point) => [point!.lon, point!.lat]) : null;
};
const sameCoordinate = (a: Coordinates, b: Coordinates) => a.lat === b.lat && a.lon === b.lon;
const validCachedRoute = (cached: { route?: unknown; raw?: OsrmResponse }, origin: Coordinates, destination: Destination): cached is { route: WalkRoute; raw: OsrmResponse } => {
  const parsed = WalkRouteSchema.safeParse(cached.route);
  if (!parsed.success) return false;
  const candidate = parsed.data;
  const steps = cached.raw?.routes?.[0]?.legs?.flatMap((leg) => leg.steps ?? []) ?? [];
  const verifiedFootSteps = steps.length > 0 && steps.every((step) => step.mode === 'walking');
  return candidate.id === routeId(origin, destination) && sameCoordinate(candidate.origin, origin) && candidate.destinationId === destination.id && candidate.destinationVersion === destination.version && sameCoordinate(candidate.requestedDestination, destination.coordinate) && candidate.profile === 'foot' && (candidate.status !== 'ok' || verifiedFootSteps);
};

async function respectRateLimit(signal: AbortSignal): Promise<void> {
  const delay = Math.max(0, 1_000 - (Date.now() - lastRequestAt));
  if (delay) await sleep(delay, signal);
  lastRequestAt = Date.now();
}

export async function routeFoot(origin: Coordinates, destination: Destination, signal: AbortSignal, options: FootRouteOptions = {}): Promise<WalkRoute> {
  const now = options.now ?? (() => new Date());
  if (!isCoordinates(origin) || !isCoordinates(destination.coordinate)) return unavailable(origin, destination, 'INVALID_COORDINATES', now);
  const directory = options.cacheDirectory ?? CACHE_ROOT;
  const path = cachePath(origin, destination, directory);
  try {
    const cached = JSON.parse(await readFile(path, 'utf8')) as { route?: unknown; raw?: OsrmResponse };
    if (validCachedRoute(cached, origin, destination)) return cached.route;
  } catch { /* cache miss */ }

  const coordinates = `${origin.lon},${origin.lat};${destination.coordinate.lon},${destination.coordinate.lat}`;
  const url = new URL(`${PROVIDER}/route/v1/driving/${coordinates}`);
  url.search = new URLSearchParams({ overview: 'full', geometries: 'geojson', steps: 'true' }).toString();
  const fetcher = options.fetch ?? fetch;
  let response: Response | null = null;
  let errorCode: string | null = null;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      await respectRateLimit(signal);
      const requestSignal = AbortSignal.any([signal, AbortSignal.timeout(options.timeoutMs ?? 15_000)]);
      response = await fetcher(url, { signal: requestSignal, headers: { 'User-Agent': 'AddressHousingHackathon/0.1 (local demo)' } });
      if (response.ok) break;
      errorCode = `HTTP_${response.status}`;
      if (response.status < 500 && response.status !== 429) break;
    } catch (error) {
      if (signal.aborted) throw error;
      errorCode = 'NETWORK_ERROR';
    }
    if (attempt === 0) await sleep(options.retryDelayMs ?? 1_000, signal);
  }
  if (!response?.ok) return unavailable(origin, destination, errorCode ?? 'ROUTER_UNAVAILABLE', now);

  let raw: OsrmResponse;
  try { raw = await response.json() as OsrmResponse; } catch { return unavailable(origin, destination, 'INVALID_RESPONSE', now); }
  const first = raw.routes?.[0];
  const snappedOrigin = asCoordinate(raw.waypoints?.[0]?.location);
  const snappedDestination = asCoordinate(raw.waypoints?.[1]?.location);
  const geometry = first?.geometry?.type === 'LineString' ? validLine(first.geometry.coordinates) : null;
  const durationSeconds = typeof first?.duration === 'number' && Number.isFinite(first.duration) && first.duration >= 0 ? first.duration : null;
  const distanceMeters = typeof first?.distance === 'number' && Number.isFinite(first.distance) && first.distance >= 0 ? first.distance : null;
  if (raw.code !== 'Ok' || !durationSeconds && durationSeconds !== 0 || distanceMeters === null || !geometry || !snappedOrigin || !snappedDestination) {
    return unavailable(origin, destination, 'INVALID_RESPONSE', now);
  }
  const steps = first?.legs?.flatMap((leg) => leg.steps ?? []) ?? [];
  const missingStepMode = steps.length === 0;
  const unexpectedMode = steps.some((step) => step.mode !== 'walking');
  const snapTooFar = metresBetween(origin, snappedOrigin) > 75 || metresBetween(destination.coordinate, snappedDestination) > 75;
  const route: WalkRoute = {
    id: routeId(origin, destination), origin, destinationId: destination.id, destinationVersion: destination.version,
    requestedDestination: destination.coordinate, snappedOrigin, snappedDestination,
    status: missingStepMode || unexpectedMode || snapTooFar ? 'needs_review' : 'ok', durationSeconds, distanceMeters,
    geometry: { type: 'LineString', coordinates: geometry }, provider: PROVIDER, profile: 'foot', computedAt: now().toISOString(),
    errorCode: missingStepMode ? 'MISSING_STEP_MODE' : unexpectedMode ? 'UNEXPECTED_STEP_MODE' : snapTooFar ? 'SNAP_TOO_FAR' : null,
  };
  try {
    await mkdir(directory, { recursive: true });
    await writeFile(path, JSON.stringify({ route, raw, cachedAt: now().toISOString() }), 'utf8');
  } catch { /* a cache failure cannot discard a valid route */ }
  return route;
}
