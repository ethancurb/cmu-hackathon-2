import { expect, test } from 'vitest';
import { transitFor } from '../../src/lib/view.js';
import { SEED_CRITERIA } from '../../src/domain/schema.js';
import { home2400 } from '../fixtures/homes.js';

test('changing a destination immediately hides prior bus-service claims, before any refresh', () => {
  const context = { originStopId: 'stop', originStopName: 'Nearby stop', distanceMeters: 40, distanceBasis: 'straight_line' as const, routeShortName: '71D', headsign: 'Campus', destinationStopId: 'destination-stop', servesDestination: true, serviceDate: '2026-09-14', window: '07:00–10:00', feedVersion: 'feed', evidenceIds: [], destinationId: SEED_CRITERIA.destination.id, destinationVersion: SEED_CRITERIA.destination.version };
  const home = home2400({ transit: [context] });
  expect(transitFor(home, SEED_CRITERIA)).toEqual([context]);
  expect(transitFor(home, { ...SEED_CRITERIA, destination: { ...SEED_CRITERIA.destination, version: 'moved-entrance' } })).toEqual([]);
  expect(transitFor(home, { ...SEED_CRITERIA, destination: { ...SEED_CRITERIA.destination, id: 'another-destination' } })).toEqual([]);
  expect(transitFor(home2400({ transit: [{ ...context, destinationId: undefined, destinationVersion: undefined }] }), SEED_CRITERIA)).toEqual([]);
});
