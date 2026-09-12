import type { Criteria, EvaluatedHome, Home, Snapshot, Utility, UtilityName, WalkRoute } from '../domain/schema.js';

export const utilities: { key: UtilityName; label: string; short: string }[] = [
  { key: 'electricity', label: 'Electric', short: 'Electric' },
  { key: 'gas', label: 'Gas', short: 'Gas' },
  { key: 'water_sewer', label: 'Water / sewer', short: 'Water' },
  { key: 'trash', label: 'Trash', short: 'Trash' },
  { key: 'internet', label: 'Internet', short: 'Internet' },
  { key: 'other', label: 'Other listed', short: 'Other' },
];

export const dollars = (cents: number | null | undefined) => cents == null ? 'Not stated' : new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: cents % 100 ? 2 : 0 }).format(cents / 100);
export const minute = (seconds: number | null | undefined) => seconds == null ? 'Route unknown' : `${Math.ceil(seconds / 60)} min`;
export const dateTime = (iso: string | null | undefined) => iso ? new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZone: 'America/New_York', timeZoneName: 'short' }).format(new Date(iso)) : 'Not recorded';
export const shortDate = (iso: string | null | undefined) => iso ? new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', timeZone: 'America/New_York' }).format(new Date(iso)) : 'Date unknown';
export const title = (home: Home) => {
  const raw = home.scope === 'floor_plan' && home.title.value ? home.title.value : home.address.value || home.title.value || 'Address not stated';
  return raw.replace(/\b[A-Z]{3,}\b/g, word => word[0] + word.slice(1).toLowerCase());
};
export const destinationName = (criteria: Criteria) => criteria.destination.label.split(' — ')[0];
export const layout = (home: Home) => `${home.bedrooms.value ?? '?'} bed${home.bedrooms.value === 1 ? '' : 's'} · ${home.bathrooms.value ?? '?'} bath${home.bathrooms.value === 1 ? '' : 's'}`;
export const wholeRentLabel = (home: Home) => {
  const quote = home.rent;
  const amount = quote.amount.value;
  if (amount == null) return 'Rent not stated';
  const prefix = quote.kind === 'from' ? 'From ' : quote.kind === 'range' ? '' : '';
  const value = quote.kind === 'range' && quote.upperAmount.value != null ? `${dollars(amount)}–${dollars(quote.upperAmount.value)}` : `${prefix}${dollars(amount)}`;
  const basis = quote.basis === 'whole_unit' ? 'whole home' : quote.basis === 'per_room' ? 'per room' : quote.basis === 'per_person' ? 'per person' : 'basis unknown';
  return `${value} / ${quote.period === 'month' ? 'mo' : quote.period === 'week' ? 'week' : 'period unknown'} · ${basis}`;
};
export const utilityState = (utility?: Utility) => utility?.inclusion.state === 'conflicting' ? 'conflicting' : utility?.inclusion.value === 'included' ? 'included' : utility?.inclusion.value === 'separate' ? 'separate' : utility?.inclusion.value === 'partial' ? 'partly covered' : 'not stated';
export const utilityFor = (home: Home, key: UtilityName) => home.utilities.find(u => u.name === key);
export const unresolved = (result: EvaluatedHome) => result.cost.unknownItems.length;
export const homeRoute = (snapshot: Snapshot, result?: EvaluatedHome) => result?.routeId ? snapshot.routes.find(r => r.id === result.routeId) : undefined;
export const routeForHome = (snapshot: Snapshot, home: Home, criteria: Criteria): WalkRoute | undefined => snapshot.routes.find(r => home.routeIds.includes(r.id) && r.destinationId === criteria.destination.id && r.destinationVersion === criteria.destination.version);
export const sourceNames = (snapshot: Snapshot, home: Home) => snapshot.evidence.filter(e => home.sourceListingIds.includes(e.scopeKey) || home.primaryUrl === e.url).map(e => snapshot.sources.find(s => s.id === e.sourceId)?.name).filter((x): x is string => Boolean(x));
export const fitLabel = (result: EvaluatedHome) => result.fit === 'matches' ? 'Meets stated requirements' : result.fit === 'near_match' ? 'Near match' : 'Needs verification';
export const constraintSummary = (result: EvaluatedHome) => result.constraints.filter(c => c.outcome !== 'pass').map(c => `${c.key.replaceAll('_',' ')} ${c.outcome === 'fail' ? 'outside requirement' : 'unknown'}`).join(' · ');
export const decisionReason = (result: EvaluatedHome, criteria: Criteria) => {
  const failures = result.constraints.filter(c => c.outcome === 'fail').map(c => {
    if (c.key === 'personal_rent' && typeof c.actual === 'number') return `${dollars(c.actual - criteria.personalRentCap)} over share cap`;
    if (c.key === 'walk' && typeof c.actual === 'number') return `${Math.ceil((c.actual - criteria.maxWalkSeconds) / 60)} min over walk limit`;
    if (c.key === 'bathrooms') return `${c.actual} baths vs ${criteria.minBathrooms}+ required`;
    if (c.key === 'bedrooms') return `${c.actual} beds vs ${criteria.bedrooms} required`;
    return `${c.key.replaceAll('_',' ')} outside requirement`;
  });
  const unknown = result.constraints.filter(c => c.outcome === 'unknown').map(c => c.key.replace('personal_rent','rent').replace('property_type','type'));
  return [...failures, unknown.length ? `${unknown.join(', ')} unknown` : ''].filter(Boolean).join(' · ');
};
export const capWhole = (criteria: Criteria) => criteria.allocation.kind === 'equal' ? Math.floor(criteria.personalRentCap * criteria.allocation.occupants) : criteria.allocation.personalShareBps ? Math.floor(criteria.personalRentCap * 10000 / criteria.allocation.personalShareBps) : null;
