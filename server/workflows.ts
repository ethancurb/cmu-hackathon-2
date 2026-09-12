import { createHash } from 'node:crypto';
import type { Criteria, Evidence, Home, Snapshot, SourceEntry, SourceRun } from '../src/domain/schema.js';
import { SEED_CRITERIA, validateSnapshot } from '../src/domain/schema.js';
import { reconcileHomes, diffSnapshots } from '../src/domain/reconcile.js';
import { collectSources } from '../jobs/sources/collect.js';
import { enrichRoutes, enrichSnapshot } from '../jobs/geo/enrich.js';
import { findDestinations } from '../jobs/geo/geocode.js';
import { fetchPublicPage, sourceIdFor } from '../jobs/sources/public-page.js';
import { SOURCE_REGISTRY, sourceById } from '../jobs/sources/registry.js';
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
    if (old?.address.value !== home.address.value || !old?.coordinate.value) return home;
    const coordinate = home.coordinate.value ? home.coordinate : old.coordinate;
    const unchanged = coordinate.value?.lat === old.coordinate.value.lat && coordinate.value?.lon === old.coordinate.value.lon;
    return { ...home, coordinate, ...(unchanged ? { routeIds: old.routeIds, nearby: old.nearby, transit: old.transit } : {}) };
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
      try {
        const discovered = await discoverLeads(criteria, signal, progress);
        const remaining = [] as typeof discovered.leads;
        const verifiedHomes: Home[] = []; const verifiedEvidence: Evidence[] = []; const verifiedSources: SourceEntry[] = []; const verifiedRuns: SourceRun[] = [];
        const seenUrls = new Set<string>(); let checked = 0;
        for (const lead of discovered.leads) {
          const normalizedUrl = lead.url.replace(/\/$/, '');
          if (seenUrls.has(normalizedUrl)) continue;
          seenUrls.add(normalizedUrl);
          const sourceId = sourceIdFor(lead.url);
          const registered = SOURCE_REGISTRY.find(source => source.id === sourceId && source.accessMode === 'public_page');
          if (!registered || checked >= 3) { remaining.push(lead); continue; }
          checked += 1;
          const scope = { ...researchScope(criteria, discovered.observedAt), queryCount: 1, limitReasons: ['One model-discovered public page was fetched and parsed through the registered source adapter.', 'Bounded follow-on verification; no market-coverage claim.'] };
          const source: SourceEntry = { id: registered.id, family: registered.family, name: registered.name, url: registered.url, accessMode: registered.accessMode, limitation: registered.limitation };
          verifiedSources.push(source);
          const startedAt = new Date().toISOString();
          try {
            progress(`Verifying a public ${registered.name} lead.`);
            const capture = await fetchPublicPage(lead.url, signal);
            const parsed = sourceId === 'cmu-offcampus' ? parseCmu(capture)
              : sourceId === 'lobos-management' ? /\/units\/[^/]+\/?$/.test(new URL(lead.url).pathname) ? parseLobosDetail(capture) : parseLobos(capture)
                : sourceId === 'reinhold-residential' ? parseReinhold(capture) : null;
            if (!parsed?.listings.length) {
              warnings.push(`${registered.name}: discovered page had no supported unit-level structure; retained as an unverified lead.`);
              verifiedRuns.push({ sourceId, status: 'fetched', method: 'Model-discovered URL + bounded public fetch and source-specific parser', startedAt, completedAt: capture.fetchedAt, urlsAttempted: [lead.url], pagesFetched: 1, observations: 0, importedHomeIds: [], duplicateObservations: 0, queryDescription: `Discovered public page: ${lead.url}`, bounds: 'One registered host; 12 MiB; finite timeout; max three follow-on pages.', scope, error: 'No supported unit-level structure.' });
              remaining.push(lead);
              continue;
            }
            const evidence = uniqueById(parsed.listings.flatMap(listing => listing.evidence));
            const homes = parsed.listings.map(listing => toHome(listing, evidence));
            verifiedEvidence.push(...evidence); verifiedHomes.push(...homes);
            verifiedRuns.push({ sourceId, status: 'imported', method: 'Model-discovered URL + bounded public fetch and source-specific parser', startedAt, completedAt: capture.fetchedAt, urlsAttempted: [lead.url], pagesFetched: 1, observations: homes.length, importedHomeIds: homes.map(home => home.id), duplicateObservations: 0, queryDescription: `Discovered public page: ${lead.url}`, bounds: 'One registered host; 12 MiB; finite timeout; max three follow-on pages.', scope, error: parsed.warnings.length ? parsed.warnings.join('; ') : null });
          } catch (error) {
            warnings.push(`${registered.name}: could not verify discovered page; retained as an unverified lead.`);
            verifiedRuns.push({ sourceId, status: 'failed', method: 'Model-discovered URL + bounded public fetch', startedAt, completedAt: new Date().toISOString(), urlsAttempted: [lead.url], pagesFetched: 0, observations: 0, importedHomeIds: [], duplicateObservations: 0, queryDescription: `Discovered public page: ${lead.url}`, bounds: 'One registered host; 12 MiB; finite timeout; max three follow-on pages.', scope, error: error instanceof Error ? error.message : 'Unknown fetch failure.' });
            remaining.push(lead);
          }
        }
        snapshot = appendLeads(snapshot, { ...discovered, leads: remaining }, criteria);
        if (verifiedRuns.length) snapshot = { ...snapshot, homes: reconcileHomes(snapshot.homes, verifiedHomes), evidence: uniqueById([...snapshot.evidence, ...verifiedEvidence]), sources: uniqueById([...snapshot.sources, ...verifiedSources]), sourceRuns: [...snapshot.sourceRuns, ...verifiedRuns], researchScopes: [...snapshot.researchScopes, ...verifiedRuns.map(run => run.scope!).filter((scope, index, scopes) => scopes.findIndex(item => JSON.stringify(item) === JSON.stringify(scope)) === index)] };
      }
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
  const routes: Workflows['routes'] = async (destination, homeIds, signal, progress, expectedSnapshotId) => {
    const previous = await store.loadCurrent();
    if (previous.id !== expectedSnapshotId) throw new AppError('STALE_SNAPSHOT', 'New research is available. Refresh before recomputing routes.', 409);
    const requested = new Set(homeIds);
    let base = attachDestination({ ...previous, id: newSnapshotId(), createdAt: new Date().toISOString() }, destination);
    progress(`Routing ${homeIds.length} homes to ${destination.label}.`);
    const updated = await enrichSnapshot({ ...base, homes: base.homes.filter(home => requested.has(home.id)) }, { ...SEED_CRITERIA, market: previous.discoveryMarket, destination }, signal, progress);
    const changed = new Map(updated.homes.map(home => [home.id, home]));
    base = { ...updated, homes: base.homes.map(home => changed.get(home.id) ?? home) };
    const usable = updated.homes.filter(home => home.routeIds.some(id => updated.routes.some(route => route.id === id && route.destinationVersion === destination.version && route.status === 'ok'))).length;
    return { snapshot: validateSnapshot(base), partial: usable < homeIds.length, message: `${usable} walking routes ready for ${destination.label}; ${homeIds.length - usable} still unverified.` };
  };
  const importListing: Workflows['import'] = async (sourceId, url, text, signal, progress, context) => {
    let registered;
    try { registered = sourceById(sourceId); }
    catch { throw new AppError('UNKNOWN_SOURCE', 'Choose a source from the research ledger.', 400); }
    const sameSourceHost = new URL(registered.url).hostname.toLowerCase().replace(/^www\./, '') === new URL(url).hostname.toLowerCase().replace(/^www\./, '');
    if (!sameSourceHost) throw new AppError('SOURCE_URL_MISMATCH', 'Choose the source that owns this listing URL.', 400);
    const previous = await store.loadCurrent();
    if (context && previous.id !== context.snapshotId) throw new AppError('STALE_SNAPSHOT', 'New research is available. Refresh before importing a listing.', 409);
    const criteria = context?.criteria ?? { ...SEED_CRITERIA, market: previous.discoveryMarket };
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
    if (context) {
      snapshot = await placeHomes(snapshot, criteria, signal, progress);
      snapshot = await enrichRoutes(snapshot, criteria.destination, signal);
    }
    return { snapshot: validateSnapshot(snapshot), partial: fresh.homes.some(home => home.rent.amount.value === null), message: `${fresh.homes.length} imported options checked; source uncertainty remains visible.` };
  };
  return { discovery, routes, destinations: (query, market, signal) => findDestinations(query, { ...market, label: market.label.split('/')[0]!.trim() }, signal), import: importListing };
}
