import type { Criteria, ResearchScope } from './schema.js';

export const normalizedMarketKey = (market: Criteria['market']) => `${market.label.split('/')[0]!.trim().toLowerCase()}|${market.region.toLowerCase()}|${market.country.toLowerCase()}`;
const wholeHomeCeiling = (criteria: Criteria) => criteria.allocation.kind === 'equal'
  ? Math.floor(criteria.personalRentCap * criteria.allocation.occupants)
  : Math.floor(criteria.personalRentCap * 10000 / criteria.allocation.personalShareBps!);

export function needsDiscovery(criteria: Criteria, scopes: ResearchScope[]): { needed: boolean; reason: string | null } {
  const sameMarket = scopes.filter((scope) => scope.marketKey.toLowerCase() === normalizedMarketKey(criteria.market));
  if (!sameMarket.length) return { needed: true, reason: 'The requested market has not been researched.' };
  const sameDestination = sameMarket.filter((scope) => scope.destinationVersion === criteria.destination.version);
  if (!sameDestination.length) return { needed: true, reason: 'The destination changed, so routes and research must be refreshed.' };
  for (const scope of sameDestination) {
    if (scope.queriedBedrooms !== null && !scope.queriedBedrooms.includes(criteria.bedrooms)) continue;
    if (scope.queriedMinBathrooms !== null && criteria.minBathrooms < scope.queriedMinBathrooms) continue;
    if (scope.queriedMaxWholeRent !== null && wholeHomeCeiling(criteria) > scope.queriedMaxWholeRent) continue;
    if (scope.queriedPropertyTypes !== null && criteria.propertyTypes.some((type) => !scope.queriedPropertyTypes!.includes(type))) continue;
    if (criteria.maxWalkSeconds > scope.scenarioMaxWalkSeconds) continue;
    return { needed: false, reason: null };
  }
  return { needed: true, reason: 'The revised criteria exceed the recorded research scope.' };
}
