import { suggestAlternatives, applyCriteriaPatch } from './alternatives.js';
import { needsDiscovery, normalizedMarketKey } from './coverage.js';
import { computeCosts } from './costs.js';
import { evaluateHome } from './matching.js';
import type { Criteria, SearchResult, Snapshot } from './schema.js';

export { applyCriteriaPatch, computeCosts, evaluateHome, needsDiscovery, suggestAlternatives };

export function evaluateSearch(snapshot: Snapshot, criteria: Criteria, requestId: string): SearchResult {
  const sameMarket = normalizedMarketKey(snapshot.discoveryMarket) === normalizedMarketKey(criteria.market);
  const eligibleHomes = sameMarket ? snapshot.homes : [];
  const results = eligibleHomes.map((home) => evaluateHome(home, criteria, snapshot.routes));
  const discovery = needsDiscovery(criteria, snapshot.researchScopes);
  return {
    snapshotId: snapshot.id, requestId, criteria, results, alternatives: sameMarket ? suggestAlternatives(snapshot, criteria) : [],
    counts: { total: results.length, matches: results.filter((item) => item.fit === 'matches').length, nearMatches: results.filter((item) => item.fit === 'near_match').length, needsVerification: results.filter((item) => item.fit === 'needs_verification').length },
    discoveryNeeded: discovery.needed, discoveryReason: discovery.reason,
  };
}
