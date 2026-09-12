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
const factResult = <T extends string | number>(key: string, fact: Fact<T>, required: T, passes: (value: T) => boolean, unit: string | null): ConstraintResult => fact.value === null || fact.state === 'conflicting'
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
  const route = routes.find((candidate) => home.routeIds.includes(candidate.id) && candidate.destinationId === criteria.destination.id && candidate.destinationVersion === criteria.destination.version);
  const routeUsable = route && route.status === 'ok' && route.durationSeconds !== null && route.snappedOrigin && route.snappedDestination && metresBetween(route.origin, route.snappedOrigin) <= 75 && metresBetween(route.requestedDestination, route.snappedDestination) <= 75;
  constraints.push(!routeUsable ? result('walk', 'unknown', criteria.maxWalkSeconds, null, 'seconds') : result('walk', route.durationSeconds! <= criteria.maxWalkSeconds ? 'pass' : 'fail', criteria.maxWalkSeconds, route.durationSeconds!, 'seconds', [], route.durationSeconds! - criteria.maxWalkSeconds));
  for (const utilityName of criteria.requiredIncludedUtilities) {
    const utility = home.utilities.find((item) => item.name === utilityName);
    constraints.push(!utility || utility.inclusion.value === null || utility.inclusion.state === 'conflicting'
      ? result(`utility:${utilityName}`, 'unknown', 'included', null, null, utility?.inclusion.evidenceIds ?? [])
      : result(`utility:${utilityName}`, utility.inclusion.value === 'included' ? 'pass' : 'fail', 'included', utility.inclusion.value, null, utility.inclusion.evidenceIds));
  }
  for (const key of criteria.mustHaveAmenities) {
    const amenity = canonicalAmenities.has(key) ? home.amenities.find((item) => item.key === key) : undefined;
    const value = amenity?.fact.value;
    constraints.push(value === null || value === undefined || amenity?.fact.state === 'conflicting'
      ? result(`amenity:${key}`, 'unknown', 'true', null, null, amenity?.fact.evidenceIds ?? [])
      : result(`amenity:${key}`, value === true ? 'pass' : 'fail', 'true', String(Boolean(value)), null, amenity!.fact.evidenceIds));
  }
  if (home.listingStatus === 'reported_off_market' || home.listingStatus === 'historical') constraints.push(result('listing_status', 'fail', 'currently observed', home.listingStatus, null));
  const questions = [
    ...cost.unknownItems.map((item) => ({ key: `cost:${item.key}`, priority: 1, text: item.reason, evidenceIds: [] })),
    ...(home.availability.value === null ? [{ key: 'availability', priority: 2, text: 'Confirm current availability before touring.', evidenceIds: home.availability.evidenceIds }] : []),
    ...(home.leaseTerms.value === null ? [{ key: 'lease_terms', priority: 3, text: 'Confirm lease term and conditions.', evidenceIds: home.leaseTerms.evidenceIds }] : []),
  ];
  const hasFail = constraints.some((constraint) => constraint.outcome === 'fail');
  const hasUnknown = constraints.some((constraint) => constraint.outcome === 'unknown');
  return { homeId: home.id, fit: hasFail ? 'near_match' : hasUnknown ? 'needs_verification' : 'matches', constraints, cost, routeId: route?.id ?? null, questions };
}
