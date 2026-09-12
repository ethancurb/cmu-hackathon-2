import type { Coordinates, NearbyPlace } from '../../src/domain/schema.js';
import { metresBetween } from './coordinates.js';

export type OsmPlace = { id: string; name: string; category: string; coordinate: Coordinates; url: string };
const allowed = new Set(['supermarket', 'grocery', 'convenience', 'pharmacy', 'cafe', 'restaurant']);

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
  return places.map((place) => ({ id: place.id, name: place.name, category: place.category, coordinate: place.coordinate, distanceMeters: metresBetween(home, place.coordinate), distanceBasis: 'straight_line' as const, walkSeconds: null, evidenceIds: [evidenceId] })).sort((a, b) => a.distanceMeters - b.distanceMeters).slice(0, limit);
}

export async function queryOsmEssentials(center: Coordinates, signal: AbortSignal, options: { fetch?: typeof fetch; limit?: number; timeoutMs?: number } = {}): Promise<OsmPlace[]> {
  const query = `[out:json][timeout:20];(nwr[shop~"^(supermarket|grocery|convenience)$"](around:4500,${center.lat},${center.lon});nwr[amenity~"^(pharmacy|cafe|restaurant)$"](around:4500,${center.lat},${center.lon}););out center ${options.limit ?? 80};`;
  const url = new URL('https://overpass-api.de/api/interpreter');
  url.searchParams.set('data', query);
  const response = await (options.fetch ?? fetch)(url, { signal: AbortSignal.any([signal, AbortSignal.timeout(options.timeoutMs ?? 15_000)]), headers: { 'User-Agent': 'AddressHousingHackathon/0.1 (local demo)' } });
  if (!response.ok) throw new Error(`OVERPASS_HTTP_${response.status}`);
  return parseOverpassElements(await response.json());
}

export const OSM_ATTRIBUTION = '© OpenStreetMap contributors. Nearby categories and coordinates are an OSM observation; absence means not found in the queried OSM data.';
