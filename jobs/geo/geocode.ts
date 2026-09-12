import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { Criteria, Coordinates, Destination, Evidence, SourceEntry } from '../../src/domain/schema.js';
import { isCoordinates } from './coordinates.js';

const NOMINATIM_URL = 'https://nominatim.openstreetmap.org/search';
const NOMINATIM_SOURCE_ID = 'geo:nominatim';
const CACHE_ROOT = join(process.cwd(), 'data', 'cache', 'geo', 'geocode');
let lastRequestAt = 0;

export type GeocodeOptions = { fetch?: typeof fetch; cacheDirectory?: string; retryDelayMs?: number; timeoutMs?: number; now?: () => Date };
type NominatimPlace = { place_id?: unknown; display_name?: unknown; lat?: unknown; lon?: unknown };
type CachedGeocode = { retrievedAt: string; places: NominatimPlace[] };
const observations = new Map<string, string>();
const hash = (value: string) => createHash('sha256').update(value).digest('hex').slice(0, 20);
const sleep = (ms: number, signal: AbortSignal) => new Promise<void>((resolve, reject) => {
  if (signal.aborted) { reject(signal.reason ?? new DOMException('Aborted', 'AbortError')); return; }
  const timeout = setTimeout(resolve, ms);
  signal.addEventListener('abort', () => { clearTimeout(timeout); reject(signal.reason ?? new DOMException('Aborted', 'AbortError')); }, { once: true });
});
const waitForNominatim = async (signal: AbortSignal) => {
  const wait = Math.max(0, 1_000 - (Date.now() - lastRequestAt));
  if (wait) await sleep(wait, signal);
  lastRequestAt = Date.now();
};

const destinationFrom = (label: string, coordinate: Coordinates, version: string, caveat: string): Destination => ({ id: `destination:${hash(`${label}|${coordinate.lat}|${coordinate.lon}`)}`, version, label, coordinate, evidenceIds: [`evidence:geocode:${hash(version)}`], caveat });

export function manualDestination(label: string, coordinate: Coordinates): Destination {
  if (!isCoordinates(coordinate)) throw new Error('INVALID_DESTINATION_COORDINATES');
  return destinationFrom(label, coordinate, `manual:${hash(`${coordinate.lat}|${coordinate.lon}`)}`, 'Manual map pin; verify this mapped destination before relying on route qualification.');
}

export async function findDestinations(query: string, market: Criteria['market'], signal: AbortSignal, options: GeocodeOptions = {}): Promise<Destination[]> {
  const normalized = query.trim();
  if (!normalized) return [];
  const cacheDirectory = options.cacheDirectory ?? CACHE_ROOT;
  const cacheFile = join(cacheDirectory, `${hash(`${normalized}|${market.label}|${market.region}|${market.country}`)}.json`);
  let cached: CachedGeocode;
  try {
    const candidate = JSON.parse(await readFile(cacheFile, 'utf8')) as Partial<CachedGeocode>;
    if (typeof candidate.retrievedAt !== 'string' || !Array.isArray(candidate.places)) throw new Error('INVALID_GEOCODE_CACHE');
    cached = { retrievedAt: candidate.retrievedAt, places: candidate.places as NominatimPlace[] };
  } catch {
    const url = new URL(NOMINATIM_URL);
    url.search = new URLSearchParams({ q: `${normalized}, ${market.label}, ${market.region}, ${market.country}`, format: 'jsonv2', limit: '5', addressdetails: '1' }).toString();
    const fetcher = options.fetch ?? fetch;
    let response: Response | null = null;
    for (let attempt = 0; attempt < 2; attempt += 1) {
      await waitForNominatim(signal);
      try {
        response = await fetcher(url, { signal: AbortSignal.any([signal, AbortSignal.timeout(options.timeoutMs ?? 15_000)]), headers: { 'User-Agent': 'AddressHousingHackathon/0.1 (local demo)' } });
      } catch (error) {
        if (signal.aborted) throw error;
        if (attempt === 0) await sleep(options.retryDelayMs ?? 1_000, signal);
        continue;
      }
      if (response.ok || response.status < 500) break;
      if (attempt === 0) await sleep(options.retryDelayMs ?? 1_000, signal);
    }
    if (!response?.ok) return [];
    const candidate = await response.json();
    if (!Array.isArray(candidate)) return [];
    cached = { retrievedAt: (options.now ?? (() => new Date()))().toISOString(), places: candidate as NominatimPlace[] };
    try { await mkdir(cacheDirectory, { recursive: true }); await writeFile(cacheFile, JSON.stringify(cached), 'utf8'); } catch { /* cache is optional */ }
  }
  return cached.places.flatMap((place): Destination[] => {
    const lat = typeof place.lat === 'string' ? Number(place.lat) : place.lat;
    const lon = typeof place.lon === 'string' ? Number(place.lon) : place.lon;
    const coordinate = { lat, lon };
    if (!isCoordinates(coordinate) || typeof place.display_name !== 'string' || typeof place.place_id !== 'number') return [];
    const destination = destinationFrom(place.display_name, coordinate, `nominatim:${place.place_id}`, 'Geocoded only after explicit submit; verify the mapped entrance before relying on route qualification.');
    observations.set(destination.id, cached.retrievedAt);
    return [destination];
  });
}

export function geocodeEvidence(destination: Destination, observedAt = observations.get(destination.id)): { source: SourceEntry; evidence: Evidence } {
  if (!observedAt) throw new Error('GEOCODE_OBSERVATION_TIME_REQUIRED');
  const source: SourceEntry = { id: NOMINATIM_SOURCE_ID, family: 'OpenStreetMap', name: 'Nominatim', url: 'https://nominatim.openstreetmap.org/', accessMode: 'public_page', limitation: 'Geocode candidates are returned only on explicit submit and must be verified on the map.' };
  return { source, evidence: { id: destination.evidenceIds[0]!, sourceId: source.id, url: NOMINATIM_URL, observedAt, channel: 'dataset', captureHash: hash(destination.version), scopeKey: `dataset:geocode:${destination.id}`, scopeKind: 'dataset', appliesToAllUnits: true, excerpt: destination.label, locator: `destination:${destination.id}` } };
}
