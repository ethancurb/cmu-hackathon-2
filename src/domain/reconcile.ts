import type { Home, Snapshot } from './schema.js';

const identity = (home: Home) => `${home.buildingKey}|${home.offerKey}|${[...home.sourceListingIds].sort().join(',')}`;

export function reconcileHomes(existing: Home[], incoming: Home[]): Home[] {
  const merged = new Map(existing.map((home) => [identity(home), home]));
  for (const home of incoming) {
    const key = identity(home);
    const previous = merged.get(key);
    merged.set(key, previous && previous.lastObservedAt > home.lastObservedAt ? previous : home);
  }
  return [...merged.values()];
}

const stableValue = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map(stableValue).sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)));
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value as Record<string, unknown>)
    .filter(([key]) => !['lastObservedAt', 'observedAt', 'evidenceId', 'evidenceIds', 'captureHash', 'routeIds'].includes(key))
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, item]) => [key, stableValue(item)]));
  return value;
};

const materiallyEqual = (a: Home, b: Home) => JSON.stringify(stableValue(a)) === JSON.stringify(stableValue(b));

export function diffSnapshots(before: Snapshot, after: Snapshot): { addedIds: string[]; changedIds: string[]; notReobservedIds: string[] } {
  const previous = new Map(before.homes.map((home) => [home.id, home])); const current = new Map(after.homes.map((home) => [home.id, home]));
  return {
    addedIds: after.homes.filter((home) => !previous.has(home.id)).map((home) => home.id),
    changedIds: after.homes.filter((home) => previous.has(home.id) && !materiallyEqual(previous.get(home.id)!, home)).map((home) => home.id),
    notReobservedIds: before.homes.filter((home) => !current.has(home.id)).map((home) => home.id),
  };
}
