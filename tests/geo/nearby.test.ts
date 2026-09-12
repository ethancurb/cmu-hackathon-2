import { describe, expect, test } from 'vitest';
import { parseOverpassElements, nearbyForHome } from '../../jobs/geo/nearby.js';

describe('OSM nearby essentials', () => {
  test('preserves the sourced OSM category and labels straight-line distance', () => {
    const places = parseOverpassElements({ elements: [{ type: 'node', id: 7, lat: 40.4441892, lon: -79.9389348, tags: { name: "Scotty's Market", shop: 'supermarket' } }] });
    const nearby = nearbyForHome({ lat: 40.443, lon: -79.945 }, places, 'evidence:osm:cmu');
    expect(nearby[0]).toMatchObject({ name: "Scotty's Market", category: 'supermarket', distanceBasis: 'straight_line', walkSeconds: null, evidenceIds: ['evidence:osm:cmu'] });
  });
});
