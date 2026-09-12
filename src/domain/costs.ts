import type { CostSummary, Criteria, Home } from './schema.js';

const ratio = (criteria: Criteria) => criteria.allocation.kind === 'equal'
  ? { numerator: 1, denominator: criteria.allocation.occupants, label: `Equal split across ${criteria.allocation.occupants} occupants` }
  : { numerator: criteria.allocation.personalShareBps!, denominator: 10000, label: `${criteria.allocation.personalShareBps! / 100}% personal share` };

const allocate = (cents: number, numerator: number, denominator: number) => Math.round((cents * numerator) / denominator);

export function computeCosts(home: Home, criteria: Criteria): CostSummary {
  const split = ratio(criteria);
  const unknownItems: { key: string; reason: string }[] = [];
  const rentIsCompatible = home.rent.basis === 'whole_unit' && home.rent.period === 'month' && home.rent.kind === 'exact' && home.rent.semantics === 'base_rent' && home.rent.amount.value !== null;
  const wholeHomeBaseRent = rentIsCompatible ? home.rent.amount.value : null;
  if (!rentIsCompatible) unknownItems.push({ key: 'base_rent', reason: 'A compatible exact monthly whole-unit base-rent quote is not available.' });
  let recurring = wholeHomeBaseRent === null ? null : allocate(wholeHomeBaseRent, split.numerator, split.denominator);
  for (const charge of home.charges) {
    if (charge.cadence !== 'monthly') {
      if (charge.cadence === 'usage') unknownItems.push({ key: `charge:${charge.id}`, reason: 'Usage-based charge cannot be totaled monthly.' });
      continue;
    }
    if (charge.required.value !== true || charge.amount.value === null || charge.allocation === 'unknown') {
      unknownItems.push({ key: `charge:${charge.id}`, reason: 'Monthly charge amount, requirement, or allocation is unresolved.' });
      continue;
    }
    if (recurring !== null) recurring += charge.allocation === 'per_person' ? charge.amount.value : allocate(charge.amount.value, split.numerator, split.denominator);
  }
  for (const utility of home.utilities) {
    if (utility.inclusion.value === null) unknownItems.push({ key: utility.name, reason: 'Utility inclusion is not stated.' });
    else if (utility.inclusion.value === 'partial') unknownItems.push({ key: utility.name, reason: 'Utility is only partly included; possible excess cost is unresolved.' });
    else if (utility.inclusion.value === 'separate' && utility.chargeIds.length === 0) unknownItems.push({ key: utility.name, reason: 'Utility is separately charged but no recurring amount is stated.' });
  }
  return {
    wholeHomeBaseRent,
    personalBaseRent: wholeHomeBaseRent === null ? null : allocate(wholeHomeBaseRent, split.numerator, split.denominator),
    knownPersonalRecurring: recurring,
    unknownItems,
    completeness: unknownItems.length ? 'unknown' : 'complete_for_stated_components',
    allocationLabel: split.label,
    evidenceIds: [...home.rent.amount.evidenceIds, ...home.charges.flatMap((charge) => charge.amount.evidenceIds)],
  };
}

export function personalRentWithinCap(home: Home, criteria: Criteria): boolean | null {
  if (home.rent.basis !== 'whole_unit' || home.rent.period !== 'month' || home.rent.kind !== 'exact' || home.rent.semantics !== 'base_rent' || home.rent.amount.value === null) return null;
  const split = ratio(criteria);
  return home.rent.amount.value * split.numerator <= criteria.personalRentCap * split.denominator;
}
