import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { unzipSync } from 'fflate';
import { parse } from 'csv-parse/sync';
import type { Coordinates, TransitContext } from '../../src/domain/schema.js';
import { metresBetween } from './coordinates.js';

const PRT_GTFS_URL = 'https://www.rideprt.org/developerresources/GTFS.zip';
const GTFS_CACHE = join(process.cwd(), 'data', 'cache', 'geo', 'prt', 'GTFS.zip');
const decoder = new TextDecoder();
type Row = Record<string, string>;
export type GtfsFeed = { version: string; stops: Row[]; routes: Row[]; trips: Row[]; stopTimes: Row[]; calendar: Row[]; calendarDates: Row[] };

const table = (files: Record<string, Uint8Array>, name: string): Row[] => files[name]
  ? parse(decoder.decode(files[name]), { columns: true, skip_empty_lines: true, trim: true, bom: true }) as Row[] : [];

export function parseGtfsZip(bytes: Uint8Array): GtfsFeed {
  const files = unzipSync(bytes);
  const feedInfo = table(files, 'feed_info.txt')[0];
  return { version: feedInfo?.feed_version ?? feedInfo?.feed_publisher_name ?? 'unknown-prt-feed', stops: table(files, 'stops.txt'), routes: table(files, 'routes.txt'), trips: table(files, 'trips.txt'), stopTimes: table(files, 'stop_times.txt'), calendar: table(files, 'calendar.txt'), calendarDates: table(files, 'calendar_dates.txt') };
}

export async function loadPrtGtfs(signal: AbortSignal, options: { fetch?: typeof fetch; cachePath?: string; timeoutMs?: number } = {}): Promise<GtfsFeed> {
  const cachePath = options.cachePath ?? GTFS_CACHE;
  try { return parseGtfsZip(new Uint8Array(await readFile(cachePath))); } catch { /* fetch a missing cache */ }
  const response = await (options.fetch ?? fetch)(PRT_GTFS_URL, { signal: AbortSignal.any([signal, AbortSignal.timeout(options.timeoutMs ?? 15_000)]), headers: { 'User-Agent': 'AddressHousingHackathon/0.1 (local demo)' } });
  if (!response.ok) throw new Error(`PRT_GTFS_HTTP_${response.status}`);
  const length = Number(response.headers.get('content-length') ?? 0);
  if (length > 30_000_000) throw new Error('PRT_GTFS_TOO_LARGE');
  const bytes = new Uint8Array(await response.arrayBuffer());
  if (bytes.byteLength > 30_000_000) throw new Error('PRT_GTFS_TOO_LARGE');
  const parsed = parseGtfsZip(bytes);
  await mkdir(join(cachePath, '..'), { recursive: true });
  await writeFile(cachePath, bytes);
  return parsed;
}

export function gtfsTimeToSeconds(value: string): number | null {
  const match = /^(\d{1,2}):(\d{2}):(\d{2})$/.exec(value);
  if (!match) return null;
  const hours = Number(match[1]); const minutes = Number(match[2]); const seconds = Number(match[3]);
  return hours <= 47 && minutes < 60 && seconds < 60 ? hours * 3600 + minutes * 60 + seconds : null;
}

const dateParts = (date: string) => date.replaceAll('-', '');
export function serviceRunsOn(serviceId: string, serviceDate: string, feed: GtfsFeed): boolean {
  const date = dateParts(serviceDate);
  const exception = feed.calendarDates.find((entry) => entry.service_id === serviceId && entry.date === date);
  if (exception) return exception.exception_type === '1';
  const day = new Date(`${serviceDate}T12:00:00Z`).getUTCDay();
  const field = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'][day]!;
  return feed.calendar.some((entry) => entry.service_id === serviceId && entry[field] === '1' && entry.start_date <= date && entry.end_date >= date);
}

export function nextRepresentativeWeekday(serviceDate: string): string {
  const value = new Date(`${serviceDate}T12:00:00Z`);
  while (value.getUTCDay() === 0 || value.getUTCDay() === 6) value.setUTCDate(value.getUTCDate() + 1);
  return value.toISOString().slice(0, 10);
}

const stopCoordinate = (stop: Row): Coordinates | null => {
  const lat = Number(stop.stop_lat); const lon = Number(stop.stop_lon);
  return Number.isFinite(lat) && Number.isFinite(lon) ? { lat, lon } : null;
};
const nearbyStops = (coordinate: Coordinates, feed: GtfsFeed, reachMeters: number, limit = 8) => feed.stops
  .map((stop) => ({ stop, coordinate: stopCoordinate(stop) }))
  .filter((entry): entry is { stop: Row; coordinate: Coordinates } => entry.coordinate !== null)
  .map((entry) => ({ ...entry, distanceMeters: metresBetween(coordinate, entry.coordinate) }))
  .filter((entry) => entry.distanceMeters <= reachMeters).sort((a, b) => a.distanceMeters - b.distanceMeters).slice(0, limit);

type GtfsIndex = { routeById: Map<string, Row>; timesByTrip: Map<string, Row[]>; tripsByStop: Map<string, Row[]> };
const indexes = new WeakMap<GtfsFeed, GtfsIndex>();
const indexFeed = (feed: GtfsFeed): GtfsIndex => {
  const existing = indexes.get(feed);
  if (existing) return existing;
  const timesByTrip = new Map<string, Row[]>();
  const tripsByStop = new Map<string, Row[]>();
  for (const time of feed.stopTimes) {
    const times = timesByTrip.get(time.trip_id) ?? [];
    times.push(time); timesByTrip.set(time.trip_id, times);
  }
  for (const times of timesByTrip.values()) times.sort((a, b) => Number(a.stop_sequence) - Number(b.stop_sequence));
  for (const trip of feed.trips) for (const time of timesByTrip.get(trip.trip_id) ?? []) {
    const trips = tripsByStop.get(time.stop_id) ?? [];
    if (!trips.some((candidate) => candidate.trip_id === trip.trip_id)) trips.push(trip);
    tripsByStop.set(time.stop_id, trips);
  }
  const index = { routeById: new Map(feed.routes.map((route) => [route.route_id, route])), timesByTrip, tripsByStop };
  indexes.set(feed, index);
  return index;
};

export function compactGtfsForPoints(feed: GtfsFeed, points: Coordinates[], radiusMeters = 1_000): GtfsFeed {
  const keptStopIds = new Set(feed.stops.filter((stop) => {
    const coordinate = stopCoordinate(stop);
    return coordinate !== null && points.some((point) => metresBetween(point, coordinate) <= radiusMeters);
  }).map((stop) => stop.stop_id));
  const keptTripIds = new Set(feed.stopTimes.filter((time) => keptStopIds.has(time.stop_id)).map((time) => time.trip_id));
  const trips = feed.trips.filter((trip) => keptTripIds.has(trip.trip_id));
  const routeIds = new Set(trips.map((trip) => trip.route_id));
  return {
    version: feed.version,
    stops: feed.stops.filter((stop) => keptStopIds.has(stop.stop_id)),
    routes: feed.routes.filter((route) => routeIds.has(route.route_id)),
    trips,
    stopTimes: feed.stopTimes.filter((time) => keptTripIds.has(time.trip_id) && keptStopIds.has(time.stop_id)),
    calendar: feed.calendar,
    calendarDates: feed.calendarDates,
  };
}

export async function cacheCompactGtfs(feed: GtfsFeed, points: Coordinates[], directory = join(process.cwd(), 'data', 'cache', 'geo', 'prt', 'subsets')): Promise<void> {
  const key = createHash('sha256').update(`${feed.version}|${points.map((point) => `${point.lat},${point.lon}`).sort().join('|')}`).digest('hex').slice(0, 20);
  await mkdir(directory, { recursive: true });
  await writeFile(join(directory, `${key}.json`), JSON.stringify(feed), 'utf8');
}

export function findTransitContexts(origin: Coordinates, destination: Coordinates, feed: GtfsFeed, serviceDate: string, evidenceId = `evidence:prt:${feed.version}`): TransitContext[] {
  const origins = nearbyStops(origin, feed, 500); const destinations = nearbyStops(destination, feed, 400);
  const index = indexFeed(feed);
  const window = `scheduled service (${serviceDate}, 07:00–10:00)`;
  const output: TransitContext[] = [];
  for (const originStop of origins) {
    const tripMatches = (index.tripsByStop.get(originStop.stop.stop_id) ?? []).filter((trip) => serviceRunsOn(trip.service_id, serviceDate, feed));
    for (const trip of tripMatches) {
      const times = index.timesByTrip.get(trip.trip_id) ?? [];
      const departure = times.find((time) => time.stop_id === originStop.stop.stop_id);
      const departureSeconds = departure ? gtfsTimeToSeconds(departure.departure_time) : null;
      if (departureSeconds === null || departureSeconds < 7 * 3600 || departureSeconds > 10 * 3600) continue;
      const route = index.routeById.get(trip.route_id);
      const destinationStop = destinations.find((candidate) => {
        const from = times.find((time) => time.stop_id === originStop.stop.stop_id);
        const to = times.find((time) => time.stop_id === candidate.stop.stop_id);
        return !!from && !!to && Number(to.stop_sequence) > Number(from.stop_sequence);
      });
      output.push({ originStopId: originStop.stop.stop_id, originStopName: originStop.stop.stop_name || originStop.stop.stop_id, distanceMeters: originStop.distanceMeters, distanceBasis: 'straight_line', routeShortName: route?.route_short_name || route?.route_long_name || trip.route_id, headsign: trip.trip_headsign || departure?.stop_headsign || 'Scheduled route', destinationStopId: destinationStop?.stop.stop_id ?? null, servesDestination: Boolean(destinationStop), serviceDate, window, feedVersion: feed.version, evidenceIds: [evidenceId] });
    }
  }
  const seen = new Set<string>();
  return output.sort((a, b) => Number(b.servesDestination) - Number(a.servesDestination) || a.distanceMeters - b.distanceMeters)
    .filter((context) => { const key = `${context.routeShortName}|${context.headsign}|${context.destinationStopId ?? 'nearby'}`; if (seen.has(key)) return false; seen.add(key); return true; }).slice(0, 5);
}

export const PRT_ATTRIBUTION = 'PRT schedule data reproduced with permission from Pittsburgh Regional Transit; schedule data may be unavailable or inaccurate. Check current service before travel.';
