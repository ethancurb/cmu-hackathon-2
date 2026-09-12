import { createHash } from 'node:crypto';
import type { Criteria, Snapshot } from '../src/domain/schema.js';
import { SEED_CRITERIA, validateSnapshot } from '../src/domain/schema.js';
import { reconcileHomes, diffSnapshots } from '../src/domain/reconcile.js';
import { collectSources } from '../jobs/sources/collect.js';
import { enrichRoutes, enrichSnapshot } from '../jobs/geo/enrich.js';
import { findDestinations } from '../jobs/geo/geocode.js';
import { fetchPublicPage, sourceIdFor } from '../jobs/sources/public-page.js';
import { sourceById } from '../jobs/sources/registry.js';
import { parseCmu } from '../jobs/sources/cmu.js';
import { parseLobos, parseLobosDetail } from '../jobs/sources/lobos.js';
import { parseReinhold } from '../jobs/sources/manager-page.js';
import { toHome } from '../jobs/sources/collect.js';
import { discoverLeads } from './cli.js';
import { AppError } from './errors.js';
import type { Workflows } from './api.js';
import type { SnapshotStore } from './snapshots.js';
import { appendLeads, attachDestination, marketKey, newSnapshotId, placeHomes, researchScope, snapshotFromCollection, uniqueById } from './research.js';

export function carryForward(previous: Snapshot, fresh: Snapshot): Snapshot {
  if (marketKey(previous.discoveryMarket) !== marketKey(fresh.discoveryMarket)) return fresh;
  const incoming = new Set(fresh.homes.map(home => home.id));
  const oldById = new Map(previous.homes.map(home => [home.id, home]));
  const homes = fresh.homes.map(home => {
    const old = oldById.get(home.id);
    return old?.address.value === home.address.value && old?.coordinate.value ? { ...home, coordinate: old.coordinate, routeIds: old.routeIds, nearby: old.nearby, transit: old.transit } : home;
  });
  return { ...fresh, homes: reconcileHomes(previous.homes.filter(home => !incoming.has(home.id)).map(home => ({ ...home, listingStatus: home.listingStatus === 'reported_off_market' ? 'reported_off_market' : 'stale' })), homes), evidence: uniqueById([...previous.evidence, ...fresh.evidence]), sources: uniqueById([...previous.sources, ...fresh.sources]), routes: previous.routes, researchScopes: [...previous.researchScopes, ...fresh.researchScopes] };
}

export function createWorkflows(store: SnapshotStore, options: { useResearchWorker?: boolean; limit?: number } = {}): Workflows {
  const discovery: Workflows['discovery'] = async (criteria, signal, progress) => {
    const previous = await store.loadCurrent();
    const warnings: string[] = [];
    let snapshot: Snapshot;
    if (marketKey(criteria.market) === marketKey(SEED_CRITERIA.market)) {
      const collected = await collectSources(criteria, progress, signal);
      if (!collected.homes.length) throw new AppError('NO_SOURCE_RESULTS', 'The selected sources returned no parseable homes. Your saved research is preserved.', 502);
      snapshot = carryForward(previous, snapshotFromCollection(collected, criteria));
      warnings.push(...collected.warnings);
    } else {
      snapshot = snapshotFromCollection({ homes: [], evidence: [], sources: [], sourceRuns: [], researchScopes: [] }, criteria);
    }
    if (options.useResearchWorker !== false) {
      try { snapshot = appendLeads(snapshot, await discoverLeads(criteria, signal, progress), criteria); }
      catch (error) { if (signal.aborted) throw error; warnings.push(error instanceof Error ? error.message : 'Additional web research unavailable.'); progress('Additional web research unavailable; preserving the completed public-source work.'); }
    }
    if (!snapshot.homes.length) throw new AppError('NO_RESEARCH_RESULTS', 'No housing leads were retrieved for this market. The previous market remains saved.', 502);
    if (options.limit) {
      snapshot.homes = snapshot.homes.slice(0, options.limit);
      const retained = new Set(snapshot.homes.map(home => home.id));
      snapshot.sourceRuns = snapshot.sourceRuns.map(run => ({ ...run, importedHomeIds: run.importedHomeIds.filter(id => retained.has(id)) }));
    }
    // The geo budget leaves enough time to validate and publish even when a provider is slow.
    const geoSignal = AbortSignal.any([signal, AbortSignal.timeout(160_000)]);
    try {
      snapshot = await placeHomes(snapshot, criteria, geoSignal, progress);
      snapshot = await enrichSnapshot(snapshot, criteria, geoSignal, progress);
    } catch (error) { if (signal.aborted) throw error; warnings.push('Some geographic lookups did not finish; those fields remain unverified.'); }
    snapshot.id = newSnapshotId(); snapshot.createdAt = new Date().toISOString();
    const diff = marketKey(previous.discoveryMarket) === marketKey(snapshot.discoveryMarket) ? diffSnapshots(previous, snapshot) : { addedIds: snapshot.homes.map(home => home.id), changedIds: [], notReobservedIds: [] };
    const unplaced = snapshot.homes.filter(home => !home.coordinate.value).length;
    const message = `${snapshot.homes.length} options researched · ${diff.addedIds.length} added · ${diff.changedIds.length} changed${unplaced ? ` · ${unplaced} locations still unverified` : ''}${warnings.length ? ' · some sources or context remain incomplete' : ''}.`;
    return { snapshot: validateSnapshot(snapshot), partial: warnings.length > 0 || unplaced > 0, message };
  };
  const routes: Workflows['routes'] = async (destination, homeIds, signal, progress) => {
    const previous = await store.loadCurrent();
    const requested = new Set(homeIds);
    let base = attachDestination({ ...previous, id: newSnapshotId(), createdAt: new Date().toISOString() }, destination);
    progress(`Routing ${homeIds.length} homes to ${destination.label}.`);
    const updated = await enrichSnapshot({ ...base, homes: base.homes.filter(home => requested.has(home.id)) }, { ...SEED_CRITERIA, market: previous.discoveryMarket, destination }, signal, progress);
    const changed = new Map(updated.homes.map(home => [home.id, home]));
    base = { ...updated, homes: base.homes.map(home => changed.get(home.id) ?? home) };
    const usable = updated.homes.filter(home => home.routeIds.some(id => updated.routes.some(route => route.id === id && route.destinationVersion === destination.version && route.status === 'ok'))).length;
    return { snapshot: validateSnapshot(base), partial: usable < homeIds.length, message: `${usable} walking routes ready for ${destination.label}; ${homeIds.length - usable} still unverified.` };
  };
  const importListing: Workflows['import'] = async (sourceId, url, text, signal, progress) => {
    const registered = sourceById(sourceId);
    if (sourceIdFor(url) !== sourceId) throw new AppError('SOURCE_URL_MISMATCH', 'Choose the source that owns this listing URL.', 400);
    const previous = await store.loadCurrent();
    const criteria = { ...SEED_CRITERIA, market: previous.discoveryMarket };
    const checkedAt = new Date().toISOString();
    const scope = { ...researchScope(criteria, checkedAt), queryCount: 1, limitReasons: ['One explicitly imported source page; not a broader market search.'] };
    progress(`Checking the supplied ${registered.name} listing.`);
    let fresh: Snapshot;
    try {
      const capture = await fetchPublicPage(url, signal);
      const parsed = sourceId === 'cmu-offcampus' ? parseCmu(capture) : sourceId === 'lobos-management' ? /\/units\/[^/]+\/?$/.test(new URL(url).pathname) ? parseLobosDetail(capture) : parseLobos(capture) : sourceId === 'reinhold-residential' ? parseReinhold(capture) : null;
      if (!parsed?.listings.length) throw new AppError('NO_UNIT_EVIDENCE', 'This page has no supported unit-level structure. Paste its listing text to preserve it as an unverified lead.', 422);
      const evidence = uniqueById(parsed.listings.flatMap(home => home.evidence));
      const homes = parsed.listings.map(home => toHome(home, evidence));
      fresh = snapshotFromCollection({ homes, evidence, sources: previous.sources, researchScopes: [scope], sourceRuns: [{ sourceId, status: 'imported', method: 'Explicit URL import + bounded public fetch and source-specific parser', startedAt: checkedAt, completedAt: capture.fetchedAt, urlsAttempted: [url], pagesFetched: 1, observations: homes.length, importedHomeIds: homes.map(home => home.id), duplicateObservations: 0, queryDescription: `User-selected page: ${url}`, bounds: 'One registered host; 12 MiB; finite timeout.', scope, error: null }] }, criteria);
    } catch (error) {
      if (signal.aborted) throw error;
      if (!text.trim()) throw error;
      const captureHash = createHash('sha256').update(text).digest('hex');
      fresh = appendLeads(snapshotFromCollection({ homes: [], evidence: [], sources: previous.sources, researchScopes: [], sourceRuns: [] }, criteria), { queries: [`User supplied listing text from ${url}`], leads: [{ title: text.trim().split('\n')[0]!.slice(0, 180), address: null, url, excerpt: text.trim().slice(0, 800), sourceName: registered.name }], limitations: ['User-imported text; unit facts have not been verified against a supported page parser.'], observedAt: checkedAt, captureHash }, criteria);
      fresh.evidence = fresh.evidence.map(item => item.channel === 'search_index' ? { ...item, channel: 'user_import', locator: 'Text supplied in the listing import form.' } : item);
      fresh.sourceRuns = fresh.sourceRuns.map(run => ({ ...run, method: 'User-supplied text import; unverified lead', pagesFetched: 0 }));
    }
    // An explicit import adds to the current research; it does not mark every other home stale.
    let snapshot = { ...fresh, homes: reconcileHomes(previous.homes, fresh.homes), sources: uniqueById([...previous.sources, ...fresh.sources]), evidence: uniqueById([...previous.evidence, ...fresh.evidence]), routes: previous.routes, sourceRuns: [...previous.sourceRuns, ...fresh.sourceRuns], researchScopes: [...previous.researchScopes, ...fresh.researchScopes] };
    snapshot = await placeHomes(snapshot, criteria, signal, progress);
    snapshot = await enrichRoutes(snapshot, criteria.destination, signal);
    return { snapshot: validateSnapshot(snapshot), partial: fresh.homes.some(home => home.rent.amount.value === null), message: `${fresh.homes.length} imported options checked; source uncertainty remains visible.` };
  };
  return { discovery, routes, destinations: (query, market, signal) => findDestinations(query, { ...market, label: market.label.split('/')[0]!.trim() }, signal), import: importListing };
}
