import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { Coordinates, NearbyPlace } from '../../src/domain/schema.js';
import { metresBetween } from './coordinates.js';

export type OsmPlace = { id: string; name: string; category: string; coordinate: Coordinates; url: string };
export type OsmQueryResult = { places: OsmPlace[]; retrievedAt: string; fromCache: boolean };
const allowed = new Set(['supermarket', 'grocery', 'convenience', 'pharmacy', 'cafe', 'restaurant']);
const CACHE_ROOT = join(process.cwd(), 'data', 'cache', 'geo', 'osm');

export function parseOverpassElements(input: unknown): OsmPlace[] {
  const elements = input && typeof input === 'object' && Array.isArray((input as { elements?: unknown }).elements) ? (input as { elements: unknown[] }).elements : [];
  return elements.flatMap((element): OsmPlace[] => {
    if (!element || typeof element !== 'object') return [];
    const item = element as { type?: unknown; id?: unknown; lat?: unknown; lon?: unknown; center?: { lat?: unknown; lon?: unknown }; tags?: Record<string, unknown> };
    const lat = typeof item.lat === 'number' ? item.lat : item.center?.lat;
    const lon = typeof item.lon === 'number' ? item.lon : item.center?.lon;
    const category = typeof item.tags?.shop === 'string' ? item.tags.shop : typeof item.tags?.amenity === 'string' ? item.tags.amenity : null;
    const name = typeof item.tags?.name === 'string' ? item.tags.name : null;
    if (typeof item.type !== 'string' || typeof item.id !== 'number' || typeof lat !== 'number' || typeof lon !== 'number' || !category || !name || !allowed.has(category)) return [];
    return [{ id: `osm:${item.type}:${item.id}`, name, category, coordinate: { lat, lon }, url: `https://www.openstreetmap.org/${item.type}/${item.id}` }];
  });
}

export function nearbyForHome(home: Coordinates, places: OsmPlace[], evidenceId: string, limit = 3): NearbyPlace[] {
  const close = places.map((place) => ({ id: place.id, name: place.name, category: place.category, coordinate: place.coordinate, distanceMeters: metresBetween(home, place.coordinate), distanceBasis: 'straight_line' as const, walkSeconds: null, evidenceIds: [evidenceId] })).filter((place) => place.distanceMeters <= 1_500).sort((a, b) => a.distanceMeters - b.distanceMeters);
  const groups: Record<string, (category: string) => boolean> = {
    grocery: (category) => ['supermarket', 'grocery', 'convenience'].includes(category),
    pharmacy: (category) => category === 'pharmacy',
    cafe: (category) => ['cafe', 'restaurant'].includes(category),
  };
  const selected = Object.values(groups).flatMap((matches) => close.find((place) => matches(place.category)) ?? []);
  for (const place of close) if (selected.length < limit && !selected.some((chosen) => chosen.id === place.id)) selected.push(place);
  return selected.slice(0, limit);
}

export async function queryOsmEssentialsWithProvenance(center: Coordinates, signal: AbortSignal, options: { fetch?: typeof fetch; limit?: number; timeoutMs?: number; cacheDirectory?: string; forceRefresh?: boolean; now?: () => Date } = {}): Promise<OsmQueryResult> {
  const cacheDirectory = options.cacheDirectory ?? CACHE_ROOT;
  const key = createHash('sha256').update(`${center.lat.toFixed(4)}|${center.lon.toFixed(4)}`).digest('hex').slice(0, 20);
  const cachePath = join(cacheDirectory, `${key}.json`);
  if (!options.forceRefresh) try {
    const cached = JSON.parse(await readFile(cachePath, 'utf8')) as Partial<OsmQueryResult>;
    if (typeof cached.retrievedAt === 'string' && Array.isArray(cached.places)) return { places: cached.places as OsmPlace[], retrievedAt: cached.retrievedAt, fromCache: true };
  } catch { /* cache miss */ }
  const query = `[out:json][timeout:20];(nwr[shop~"^(supermarket|grocery|convenience)$"](around:1500,${center.lat},${center.lon});nwr[amenity~"^(pharmacy|cafe|restaurant)$"](around:1500,${center.lat},${center.lon}););out center ${options.limit ?? 400};`;
  const url = new URL('https://overpass-api.de/api/interpreter');
  url.searchParams.set('data', query);
  const response = await (options.fetch ?? fetch)(url, { signal: AbortSignal.any([signal, AbortSignal.timeout(options.timeoutMs ?? 15_000)]), headers: { 'User-Agent': 'AddressHousingHackathon/0.1 (local demo)' } });
  if (!response.ok) throw new Error(`OVERPASS_HTTP_${response.status}`);
  const result: OsmQueryResult = { places: parseOverpassElements(await response.json()), retrievedAt: (options.now ?? (() => new Date()))().toISOString(), fromCache: false };
  try { await mkdir(cacheDirectory, { recursive: true }); await writeFile(cachePath, JSON.stringify(result), 'utf8'); } catch { /* cache is optional */ }
  return result;
}

export async function queryOsmEssentials(center: Coordinates, signal: AbortSignal, options: Parameters<typeof queryOsmEssentialsWithProvenance>[2] = {}): Promise<OsmPlace[]> {
  return (await queryOsmEssentialsWithProvenance(center, signal, options)).places;
}

export const OSM_ATTRIBUTION = '© OpenStreetMap contributors. Nearby categories and coordinates are an OSM observation; absence means not found in the queried OSM data.';
