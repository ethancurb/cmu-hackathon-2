/**
 * Niche filtering: the deterministic half.
 *
 * The model answers one question — does this home satisfy the renter's plain-language
 * request. Everything else here is reproducible arithmetic: which homes are eligible for
 * the niche group, and what order they appear in. Keeping the ranking out of the model's
 * hands is deliberate; the demo needs one axis that is provably not a model's opinion.
 *
 * Nothing in this file can change `fit`. See CONTEXT.md § Niche verdict.
 */

import type {
  ConstraintResult, Criteria, EvaluatedHome, Home, NicheAssessment, Snapshot,
} from './schema.js';

/**
 * How far outside a core dial a home may sit and still reach the niche group.
 *
 * Declared in one place so it can be defended in a sentence. The seed's headline near
 * miss is $7.50 over a $1,200 cap — 0.6% — so 10% admits it comfortably while excluding
 * a home at twice the budget. Without a bound, "slightly outside" means nothing and the
 * group degenerates into the whole near-match pile.
 */
export const NICHE_TOLERANCE = {
  /** Fraction of the requirement a numeric overage may exceed it by. */
  relative: { personal_rent: 0.1, walk: 0.5 } as Record<string, number>,
  /** Absolute shortfall permitted below the requirement. */
  absolute: { bathrooms: 1 } as Record<string, number>,
} as const;

/** A failed constraint no tolerance entry covers keeps a home out of the group entirely. */
export function withinTolerance(constraint: ConstraintResult): boolean {
  if (constraint.outcome !== 'fail') return true;
  const { key, required, actual } = constraint;
  if (typeof required !== 'number' || typeof actual !== 'number') return false;
  const relative = NICHE_TOLERANCE.relative[key];
  if (relative !== undefined) return required > 0 && actual <= required * (1 + relative);
  const absolute = NICHE_TOLERANCE.absolute[key];
  if (absolute !== undefined) return actual >= required - absolute;
  return false;
}

/** Homes passing every core dial are always eligible; misses must be bounded. */
export const eligibleForNicheGroup = (result: EvaluatedHome): boolean =>
  result.constraints.every(withinTolerance);

/**
 * Distance from the renter's stated requirements. Failed-dial count dominates: a home
 * missing one dial by a hair beats one missing three, which is how a person reads a list.
 * Relative overage breaks ties so $7.50 over $1,200 outranks $168 over $1,200.
 */
export function coreCloseness(result: EvaluatedHome): { failedDials: number; overage: number } {
  const failed = result.constraints.filter((constraint) => constraint.outcome === 'fail');
  const overage = failed.reduce((total, constraint) => {
    const { required, actual } = constraint;
    // A non-numeric miss (property type) has no magnitude; charge it a full unit.
    if (typeof required !== 'number' || typeof actual !== 'number' || required <= 0) return total + 1;
    return total + Math.abs(actual - required) / required;
  }, 0);
  return { failedDials: failed.length, overage };
}

/** Verdicts citing a place the home does not carry are dropped rather than displayed. */
export function usableAssessments(assessments: NicheAssessment[], snapshot: Snapshot): NicheAssessment[] {
  const placesByHome = new Map(snapshot.homes.map((home) => [home.id, new Set(home.nearby.map((place) => place.id))]));
  return assessments.filter((assessment) => {
    const places = placesByHome.get(assessment.homeId);
    if (!places) return false;
    return assessment.citedPlaceIds.every((id) => places.has(id));
  });
}

export type RankedNicheHome = {
  homeId: string;
  assessment: NicheAssessment;
  result: EvaluatedHome;
  closeness: { failedDials: number; overage: number };
};

/**
 * The niche group: matching homes within tolerance, nearest to the core dials first.
 * Strong matches precede partial ones at equal closeness so a stretched interpretation
 * never outranks a direct one.
 */
export function rankByCoreCloseness(
  assessments: NicheAssessment[], results: EvaluatedHome[], snapshot: Snapshot,
): RankedNicheHome[] {
  const resultById = new Map(results.map((result) => [result.homeId, result]));
  return usableAssessments(assessments, snapshot)
    .flatMap((assessment) => {
      const result = resultById.get(assessment.homeId);
      if (!assessment.matches || !result || !eligibleForNicheGroup(result)) return [];
      return [{ homeId: assessment.homeId, assessment, result, closeness: coreCloseness(result) }];
    })
    .sort((a, b) => a.closeness.failedDials - b.closeness.failedDials
      || a.closeness.overage - b.closeness.overage
      || (a.assessment.confidence === b.assessment.confidence ? 0 : a.assessment.confidence === 'strong' ? -1 : 1)
      || a.homeId.localeCompare(b.homeId));
}

// ---------------------------------------------------------------------------
// Digest: what the model is allowed to read.
// ---------------------------------------------------------------------------

export type DigestHome = {
  id: string; title: string; address: string;
  coordinate: { lat: number; lon: number } | null;
  propertyType: string | null; bedrooms: number | null; bathrooms: number | null;
  amenities: string[];
  nearby: { id: string; name: string; category: string; metres: number }[];
  transit: { route: string; servesDestination: boolean }[];
};

const factValue = <T>(fact: { value: T | null; state: string }): T | null =>
  fact.state === 'sourced' || fact.state === 'derived' ? fact.value : null;

/**
 * One home, compacted to what a niche question could plausibly need. Core-dial values
 * (rent, walk time) are deliberately excluded: the model judges the niche request only,
 * and giving it the numbers it is not deciding on invites it to second-guess them.
 *
 * Coordinates are included so geography the snapshot does not record — "far from a
 * railroad" — can still be reasoned about, and labelled as a model assessment.
 */
export function digestHome(home: Home): DigestHome {
  return {
    id: home.id,
    title: factValue(home.title) ?? factValue(home.address) ?? 'Address not stated',
    address: factValue(home.address) ?? '',
    coordinate: factValue(home.coordinate),
    propertyType: factValue(home.propertyType),
    bedrooms: factValue(home.bedrooms),
    bathrooms: factValue(home.bathrooms),
    amenities: home.amenities.filter((amenity) => amenity.fact.value === true).map((amenity) => amenity.key),
    nearby: home.nearby.map((place) => ({ id: place.id, name: place.name, category: place.category, metres: Math.round(place.distanceMeters) })),
    // A route serves the destination if *any* of its recorded trips does. Collapsing to
    // the last trip seen would silently downgrade a route that does reach the destination.
    transit: [...home.transit.reduce((routes, context) => routes.set(
      context.routeShortName,
      (routes.get(context.routeShortName) ?? false) || context.servesDestination,
    ), new Map<string, boolean>())].map(([route, servesDestination]) => ({ route, servesDestination })),
  };
}

export const buildDigest = (snapshot: Snapshot): DigestHome[] => snapshot.homes.map(digestHome);

/** Homes carrying nothing a niche query could be judged against, so recall stays honest. */
export const homesWithoutJudgeableData = (digest: DigestHome[]): number =>
  digest.filter((home) => !home.nearby.length && !home.transit.length && !home.amenities.length && !home.coordinate).length;

/** Criteria comparison used to decide whether a cached verdict still applies. */
export const nicheQueryOf = (criteria: Criteria): string | null => criteria.nicheQuery;
