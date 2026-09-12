import type { Coordinates } from '../../src/domain/schema.js';

export const isCoordinates = (value: unknown): value is Coordinates => {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as { lat?: unknown; lon?: unknown };
  return typeof candidate.lat === 'number' && Number.isFinite(candidate.lat) && candidate.lat >= -90 && candidate.lat <= 90
    && typeof candidate.lon === 'number' && Number.isFinite(candidate.lon) && candidate.lon >= -180 && candidate.lon <= 180;
};

export function metresBetween(a: Coordinates, b: Coordinates): number {
  const radians = Math.PI / 180;
  const dLat = (b.lat - a.lat) * radians;
  const dLon = (b.lon - a.lon) * radians;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * radians) * Math.cos(b.lat * radians) * Math.sin(dLon / 2) ** 2;
  return 6_371_000 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}
