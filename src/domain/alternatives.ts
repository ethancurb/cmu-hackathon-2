import { evaluateHome } from './matching.js';
import type { Alternative, Criteria, CriteriaPatch, Snapshot } from './schema.js';
import { CriteriaSchema } from './schema.js';

export function applyCriteriaPatch(criteria: Criteria, patch: CriteriaPatch): Criteria {
  return CriteriaSchema.parse({ ...criteria, ...patch });
}

const wholeHomePersonalCap = (amount: number, criteria: Criteria) => criteria.allocation.kind === 'equal'
  ? Math.ceil(amount / criteria.allocation.occupants)
  : Math.ceil(amount * criteria.allocation.personalShareBps! / 10000);

export function suggestAlternatives(snapshot: Snapshot, criteria: Criteria): Alternative[] {
  const baseline = new Map(snapshot.homes.map((home) => [home.id, evaluateHome(home, criteria, snapshot.routes)]));
  const candidates: { patch: CriteriaPatch; key: string; before: number; after: number; unit: string; label: string }[] = [];
  for (const home of snapshot.homes) {
    if (home.rent.basis === 'whole_unit' && home.rent.period === 'month' && home.rent.kind === 'exact' && home.rent.semantics === 'base_rent' && home.rent.amount.value !== null) {
      const cap = wholeHomePersonalCap(home.rent.amount.value, criteria);
      if (cap > criteria.personalRentCap) candidates.push({ patch: { personalRentCap: cap }, key: 'personalRentCap', before: criteria.personalRentCap, after: cap, unit: 'cents/month', label: `Raise personal rent cap to $${(cap / 100).toFixed(2)}` });
    }
    const route = snapshot.routes.find((item) => home.routeIds.includes(item.id) && item.destinationId === criteria.destination.id && item.destinationVersion === criteria.destination.version && item.status === 'ok' && item.durationSeconds !== null);
    if (route?.durationSeconds && route.durationSeconds > criteria.maxWalkSeconds) candidates.push({ patch: { maxWalkSeconds: route.durationSeconds }, key: 'maxWalkSeconds', before: criteria.maxWalkSeconds, after: route.durationSeconds, unit: 'seconds', label: `Allow a ${Math.ceil(route.durationSeconds / 60)}-minute walk` });
    if (home.bathrooms.value !== null && home.bathrooms.value < criteria.minBathrooms && [1, 1.5].includes(home.bathrooms.value)) candidates.push({ patch: { minBathrooms: home.bathrooms.value }, key: 'minBathrooms', before: criteria.minBathrooms, after: home.bathrooms.value, unit: 'bathrooms', label: `Allow ${home.bathrooms.value} bathrooms` });
  }
  const seen = new Set<string>(); const alternatives: Alternative[] = [];
  for (const candidate of candidates) {
    const signature = `${candidate.key}:${candidate.after}`; if (seen.has(signature)) continue; seen.add(signature);
    const revised = applyCriteriaPatch(criteria, candidate.patch);
    const newlyMatchedIds = snapshot.homes.filter((home) => baseline.get(home.id)?.fit !== 'matches' && evaluateHome(home, revised, snapshot.routes).fit === 'matches').map((home) => home.id);
    if (!newlyMatchedIds.length) continue;
    const noLongerMatchedIds = snapshot.homes.filter((home) => baseline.get(home.id)?.fit === 'matches' && evaluateHome(home, revised, snapshot.routes).fit !== 'matches').map((home) => home.id);
    alternatives.push({ id: `alternative:${candidate.key}:${candidate.after}`, patch: candidate.patch, label: candidate.label, newlyMatchedIds, noLongerMatchedIds, changed: [{ key: candidate.key, before: candidate.before, after: candidate.after, unit: candidate.unit }] });
  }
  return alternatives.sort((a, b) => a.changed[0]!.after.valueOf() > b.changed[0]!.after.valueOf() ? 1 : -1).slice(0, 3);
}
