import { describe, expect, test } from 'vitest';
import { compactGtfsForPoints, findTransitContexts, gtfsTimeToSeconds, serviceRunsOn, type GtfsFeed } from '../../jobs/geo/transit.js';

const feed: GtfsFeed = {
  version: 'test-feed',
  stops: [
    { stop_id: 'origin', stop_name: 'Origin', stop_lat: '40.4400', stop_lon: '-79.9500' },
    { stop_id: 'campus', stop_name: 'Campus', stop_lat: '40.4444', stop_lon: '-79.9423' },
  ],
  routes: [{ route_id: '61A', route_short_name: '61A' }],
  trips: [{ route_id: '61A', service_id: 'weekday', trip_id: 'toward-campus', trip_headsign: 'Carnegie Mellon' }],
  stopTimes: [
    { trip_id: 'toward-campus', arrival_time: '08:10:00', departure_time: '08:10:00', stop_id: 'origin', stop_sequence: '1' },
    { trip_id: 'toward-campus', arrival_time: '08:24:00', departure_time: '08:24:00', stop_id: 'campus', stop_sequence: '2' },
  ],
  calendar: [{ service_id: 'weekday', monday: '1', tuesday: '1', wednesday: '1', thursday: '1', friday: '1', saturday: '0', sunday: '0', start_date: '20260901', end_date: '20261231' }],
  calendarDates: [],
};

describe('PRT GTFS context', () => {
  test('requires same-trip forward stop order before promising destination service', () => {
    const forward = findTransitContexts({ lat: 40.4401, lon: -79.9501 }, { lat: 40.4440, lon: -79.9445 }, feed, '2026-09-14');
    expect(forward).toHaveLength(1);
    expect(forward[0]).toMatchObject({ routeShortName: '61A', headsign: 'Carnegie Mellon', destinationStopId: 'campus', servesDestination: true });

    const reverse = findTransitContexts({ lat: 40.4444, lon: -79.9423 }, { lat: 40.4400, lon: -79.9500 }, feed, '2026-09-14');
    expect(reverse).toHaveLength(1);
    expect(reverse[0]?.servesDestination).toBe(false);
    expect(reverse[0]?.destinationStopId).toBeNull();
  });

  test('honours service additions and removals, and parses after-midnight GTFS times', () => {
    const removed: GtfsFeed = { ...feed, calendarDates: [{ service_id: 'weekday', date: '20260914', exception_type: '2' }] };
    const added: GtfsFeed = { ...feed, calendar: [], calendarDates: [{ service_id: 'weekday', date: '20260914', exception_type: '1' }] };
    expect(serviceRunsOn('weekday', '2026-09-14', removed)).toBe(false);
    expect(serviceRunsOn('weekday', '2026-09-14', added)).toBe(true);
    expect(gtfsTimeToSeconds('25:10:00')).toBe(90600);
  });

  test('keeps only trip records connected to the candidate or destination stop subset', () => {
    const expanded: GtfsFeed = { ...feed, stops: [...feed.stops, { stop_id: 'far', stop_name: 'Far', stop_lat: '41', stop_lon: '-80' }], trips: [...feed.trips, { route_id: '61A', service_id: 'weekday', trip_id: 'far-trip', trip_headsign: 'Far' }], stopTimes: [...feed.stopTimes, { trip_id: 'far-trip', arrival_time: '08:00:00', departure_time: '08:00:00', stop_id: 'far', stop_sequence: '1' }] };
    const compact = compactGtfsForPoints(expanded, [{ lat: 40.4401, lon: -79.9501 }, { lat: 40.4440, lon: -79.9445 }]);
    expect(compact.stops.map((stop) => stop.stop_id)).not.toContain('far');
    expect(compact.trips.map((trip) => trip.trip_id)).toEqual(['toward-campus']);
  });
});
