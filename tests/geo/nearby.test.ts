import { describe, expect, test } from 'vitest';
import { queryOsmEssentialsWithProvenance, parseOverpassElements, nearbyForHome } from '../../jobs/geo/nearby.js';
import { vi } from 'vitest';

describe('OSM nearby essentials', () => {
  test('preserves the sourced OSM category and labels straight-line distance', () => {
    const places = parseOverpassElements({ elements: [{ type: 'node', id: 7, lat: 40.4441892, lon: -79.9389348, tags: { name: "Scotty's Market", shop: 'supermarket' } }] });
    const nearby = nearbyForHome({ lat: 40.443, lon: -79.945 }, places, 'evidence:osm:cmu');
    expect(nearby[0]).toMatchObject({ name: "Scotty's Market", category: 'supermarket', distanceBasis: 'straight_line', walkSeconds: null, evidenceIds: ['evidence:osm:cmu'] });
  });

  test('keeps nearby essentials within 1,500 metres and diversifies groceries, pharmacy, and cafe choices', () => {
    const home = { lat: 40.443, lon: -79.945 };
    const places = [
      { id: 'one', name: 'Restaurant one', category: 'restaurant', coordinate: { lat: 40.44301, lon: -79.94501 }, url: 'https://example.test/one' },
      { id: 'two', name: 'Restaurant two', category: 'restaurant', coordinate: { lat: 40.44302, lon: -79.94502 }, url: 'https://example.test/two' },
      { id: 'grocer', name: 'Grocer', category: 'supermarket', coordinate: { lat: 40.444, lon: -79.945 }, url: 'https://example.test/grocer' },
      { id: 'pharmacy', name: 'Pharmacy', category: 'pharmacy', coordinate: { lat: 40.445, lon: -79.945 }, url: 'https://example.test/pharmacy' },
      { id: 'far', name: 'Far shop', category: 'grocery', coordinate: { lat: 40.47, lon: -79.945 }, url: 'https://example.test/far' },
    ];
    const nearby = nearbyForHome(home, places, 'evidence:osm:cmu', 4);
    expect(nearby.map((place) => place.name)).toEqual(expect.arrayContaining(['Restaurant one', 'Grocer', 'Pharmacy']));
    expect(nearby.map((place) => place.name)).not.toContain('Far shop');
  });

  test('caches the bounded OSM response with its original retrieval timestamp', async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({ elements: [{ type: 'node', id: 7, lat: 40.444, lon: -79.944, tags: { name: 'Market', shop: 'supermarket' } }] }), { status: 200 }));
    const directory = `/private/tmp/geo-osm-${process.pid}-${Date.now()}`;
    const first = await queryOsmEssentialsWithProvenance({ lat: 40.444, lon: -79.944 }, new AbortController().signal, { fetch: fetcher, cacheDirectory: directory, now: () => new Date('2026-09-12T09:00:00.000Z') });
    const second = await queryOsmEssentialsWithProvenance({ lat: 40.444, lon: -79.944 }, new AbortController().signal, { fetch: fetcher, cacheDirectory: directory });
    expect(first).toMatchObject({ retrievedAt: '2026-09-12T09:00:00.000Z', fromCache: false });
    expect(second).toMatchObject({ retrievedAt: '2026-09-12T09:00:00.000Z', fromCache: true });
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(new URL(fetcher.mock.calls[0]?.[0].toString()).searchParams.get('data')).toContain('around:1500');
  });
});
