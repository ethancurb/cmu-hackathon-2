import { computeCosts, personalRentWithinCap } from './costs.js';
import type { ConstraintResult, Criteria, EvaluatedHome, Fact, Home, WalkRoute } from './schema.js';

const canonicalAmenities = new Set(['laundry_in_unit', 'laundry_on_site', 'parking', 'pets_allowed', 'step_free_access', 'air_conditioning', 'outdoor_space']);
const radians = (degrees: number) => degrees * Math.PI / 180;
const metresBetween = (a: { lat: number; lon: number }, b: { lat: number; lon: number }) => {
  const dLat = radians(b.lat - a.lat); const dLon = radians(b.lon - a.lon);
  const v = Math.sin(dLat / 2) ** 2 + Math.cos(radians(a.lat)) * Math.cos(radians(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 6371000 * 2 * Math.atan2(Math.sqrt(v), Math.sqrt(1 - v));
};
const result = (key: string, outcome: ConstraintResult['outcome'], required: string | number, actual: string | number | null, unit: string | null, evidenceIds: string[] = [], delta: number | null = null): ConstraintResult => ({ key, outcome, required, actual, delta, unit, evidenceIds });
const factResult = <T extends string | number>(key: string, fact: Fact<T>, required: T, passes: (value: T) => boolean, unit: string | null): ConstraintResult => fact.value === null || fact.state !== 'sourced'
  ? result(key, 'unknown', required, null, unit, fact.evidenceIds)
  : result(key, passes(fact.value) ? 'pass' : 'fail', required, fact.value, unit, fact.evidenceIds);

export function evaluateHome(home: Home, criteria: Criteria, routes: WalkRoute[]): EvaluatedHome {
  const cost = computeCosts(home, criteria);
  const constraints: ConstraintResult[] = [
    factResult('bedrooms', home.bedrooms, criteria.bedrooms, (actual) => actual === criteria.bedrooms, 'bedrooms'),
    factResult('bathrooms', home.bathrooms, criteria.minBathrooms, (actual) => actual >= criteria.minBathrooms, 'bathrooms'),
    factResult('property_type', home.propertyType, criteria.propertyTypes.join(', '), (actual) => (criteria.propertyTypes as string[]).includes(actual), null),
  ];
  const rentPasses = personalRentWithinCap(home, criteria);
  constraints.push(result('personal_rent', rentPasses === null ? 'unknown' : rentPasses ? 'pass' : 'fail', criteria.personalRentCap, cost.personalBaseRent, 'cents/month', home.rent.amount.evidenceIds));
  // A recorded address geocode is a supported input to a computed walk, not a guessed listing fact.
  const homeCoordinate = ['sourced', 'derived'].includes(home.coordinate.state) && home.coordinate.evidenceIds.length > 0 ? home.coordinate.value : null;
  const sameCoordinates = (a: { lat: number; lon: number }, b: { lat: number; lon: number }) => a.lat === b.lat && a.lon === b.lon;
  const usableRoutes = routes.filter((candidate) => home.routeIds.includes(candidate.id)
    && candidate.destinationId === criteria.destination.id
    && candidate.destinationVersion === criteria.destination.version
    && candidate.profile === 'foot'
    && candidate.status === 'ok'
    && candidate.durationSeconds !== null
    && candidate.snappedOrigin !== null
    && candidate.snappedDestination !== null
    && sameCoordinates(candidate.requestedDestination, criteria.destination.coordinate)
    && homeCoordinate !== null
    && metresBetween(candidate.origin, homeCoordinate) <= 75
    && metresBetween(candidate.origin, candidate.snappedOrigin) <= 75
    && metresBetween(candidate.requestedDestination, candidate.snappedDestination) <= 75)
    .sort((a, b) => b.computedAt.localeCompare(a.computedAt));
  const route = usableRoutes[0];
  const routeUsable = route !== undefined;
  constraints.push(!routeUsable ? result('walk', 'unknown', criteria.maxWalkSeconds, null, 'seconds') : result('walk', route.durationSeconds! <= criteria.maxWalkSeconds ? 'pass' : 'fail', criteria.maxWalkSeconds, route.durationSeconds!, 'seconds', [], route.durationSeconds! - criteria.maxWalkSeconds));
  for (const utilityName of criteria.requiredIncludedUtilities) {
    const utility = home.utilities.find((item) => item.name === utilityName);
    constraints.push(!utility || utility.inclusion.value === null || utility.inclusion.state !== 'sourced'
      ? result(`utility:${utilityName}`, 'unknown', 'included', null, null, utility?.inclusion.evidenceIds ?? [])
      : result(`utility:${utilityName}`, utility.inclusion.value === 'included' ? 'pass' : 'fail', 'included', utility.inclusion.value, null, utility.inclusion.evidenceIds));
  }
  for (const key of criteria.mustHaveAmenities) {
    const amenity = canonicalAmenities.has(key) ? home.amenities.find((item) => item.key === key) : undefined;
    const value = amenity?.fact.value;
    constraints.push(value === null || value === undefined || amenity?.fact.state !== 'sourced'
      ? result(`amenity:${key}`, 'unknown', 'true', null, null, amenity?.fact.evidenceIds ?? [])
      : result(`amenity:${key}`, value === true ? 'pass' : 'fail', 'true', String(Boolean(value)), null, amenity!.fact.evidenceIds));
  }
  if (home.listingStatus === 'reported_off_market' || home.listingStatus === 'historical') constraints.push(result('listing_status', 'fail', 'currently observed', home.listingStatus, null));
  const statedAvailabilityDate = home.availability.value?.match(/^\d{4}-\d{2}-\d{2}/)?.[0];
  const pastAvailability = statedAvailabilityDate !== undefined && statedAvailabilityDate < home.lastObservedAt.slice(0, 10);
  const questions = [
    ...constraints.filter((constraint) => constraint.outcome === 'unknown' && ['bedrooms', 'bathrooms', 'personal_rent', 'walk', 'property_type'].includes(constraint.key)).map((constraint) => ({ key: `hard:${constraint.key}`, priority: 1, text: `Verify ${constraint.key.replace('_', ' ')} before relying on this listing.`, evidenceIds: constraint.evidenceIds })),
    ...cost.unknownItems.map((item) => ({ key: `cost:${item.key}`, priority: item.key === 'base_rent' ? 1 : 2, text: item.reason, evidenceIds: [] })),
    ...(home.availability.value === null || home.availability.state !== 'sourced' || pastAvailability || home.scope === 'floor_plan' ? [{ key: 'availability', priority: 3, text: pastAvailability ? `The source lists ${statedAvailabilityDate}, a date before this observation. Confirm a currently vacant unit and move-in date.` : home.scope === 'floor_plan' ? 'This is an advertised floor plan. Confirm a vacant unit at this price and its move-in date.' : 'Confirm current availability before touring.', evidenceIds: home.availability.evidenceIds }] : []),
    ...(home.leaseTerms.value === null || home.leaseTerms.state !== 'sourced' ? [{ key: 'lease_terms', priority: 4, text: 'Confirm lease term and conditions.', evidenceIds: home.leaseTerms.evidenceIds }] : []),
  ].sort((a, b) => a.priority - b.priority);
  const hasFail = constraints.some((constraint) => constraint.outcome === 'fail');
  const hasUnknown = constraints.some((constraint) => constraint.outcome === 'unknown');
  return { homeId: home.id, fit: hasFail ? 'near_match' : hasUnknown ? 'needs_verification' : 'matches', constraints, cost, routeId: route?.id ?? null, questions };
}
