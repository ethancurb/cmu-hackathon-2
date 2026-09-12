import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowRight, ArrowUpRight, Compass, GitCompareArrows, List, Map as MapIcon, Plus, Search, X } from 'lucide-react';
import type { Criteria, CriteriaPatch, Destination, EvaluatedHome, Home, SearchResult, Snapshot } from './domain/schema.js';
import { validateSnapshot } from './domain/schema.js';
import { applyCriteriaPatch, evaluateSearch } from './domain/engine.js';
import { api, type Bootstrap, type Job } from './lib/api.js';
import { dateTime, dollars, fitLabel, title } from './lib/view.js';
import { presentation } from './config/presentation.js';
import { CriteriaBar } from './components/CriteriaBar.js';
import { CoveragePanel } from './components/CoveragePanel.js';
import { Alternatives } from './components/Alternatives.js';
import { HomeRow } from './components/HomeRow.js';
import { HomeDetail } from './components/HomeDetail.js';
import { MapPanel } from './components/MapPanel.js';
import { CompareSheet } from './components/CompareSheet.js';
import { ShortlistRail } from './components/ShortlistRail.js';

type Stored = { criteria?: Criteria; baseline?: Criteria; selectedHomeId?: string | null; compareIds?: string[]; shortlistIds?: string[]; snapshotId?: string };
const STORAGE_KEY = 'address-search-v1';
const readStored = (): Stored => { try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}') as Stored; } catch { return {}; } };
const id = () => typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`;
const marketKey = (market: Criteria['market']) => `${market.label}|${market.region}|${market.country}`.toLowerCase();

export default function App() {
  const [bootstrap, setBootstrap] = useState<Bootstrap | null>(null);
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [criteria, setCriteria] = useState<Criteria | null>(null);
  const [baseline, setBaseline] = useState<Criteria | null>(null);
  const [serverResult, setServerResult] = useState<SearchResult | null>(null);
  const [selectedHomeId, setSelectedHomeId] = useState<string | null>(null);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [compareIds, setCompareIds] = useState<string[]>([]);
  const [shortlistIds, setShortlistIds] = useState<string[]>([]);
  const [job, setJob] = useState<Job | null>(null);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const [destinationOpen, setDestinationOpen] = useState(false);
  const [destinationQuery, setDestinationQuery] = useState('');
  const [destinationCandidates, setDestinationCandidates] = useState<Destination[]>([]);
  const [destinationBusy, setDestinationBusy] = useState(false);
  const [pinMode, setPinMode] = useState(false);
  const [mapView, setMapView] = useState(false);
  const [compareOpen, setCompareOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [importUrl, setImportUrl] = useState('');
  const [importText, setImportText] = useState('');
  const [importSource, setImportSource] = useState('');
  const requestRef = useRef('');
  const snapshotRef = useRef('');
  const destinationRef = useRef('');
  const listRef = useRef<HTMLDivElement>(null);
  const listScrollRef = useRef(0);
  const resultMapRef = useRef(new Map<string, EvaluatedHome>());
  
  useEffect(() => {
    let active = true;
    api.bootstrap().then(data => {
      if (!active) return;
      const valid = validateSnapshot(data.snapshot);
      const saved = readStored();
      setBootstrap(data);
      setSnapshot(valid);
      snapshotRef.current = valid.id;
      const current = saved.criteria && saved.criteria.market.country === 'US' ? saved.criteria : data.seed;
      setCriteria(current);
      setBaseline(saved.baseline || data.seed);
      destinationRef.current = current.destination.version;
      setSelectedHomeId(saved.selectedHomeId || null);
      setCompareIds((saved.compareIds || []).slice(0,3));
      setShortlistIds(saved.shortlistIds || []);
    }).catch(e => { if (active) setError(`Could not load the saved housing research: ${e instanceof Error ? e.message : String(e)}`); });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!criteria || !snapshot) return;
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify({ criteria, baseline: baseline ?? undefined, selectedHomeId, compareIds, shortlistIds, snapshotId: snapshot.id } satisfies Stored)); } catch { /* private browsing */ }
  }, [criteria, baseline, selectedHomeId, compareIds, shortlistIds, snapshot]);

  const currentMarketHasResearch = Boolean(snapshot && criteria && marketKey(snapshot.discoveryMarket) === marketKey(criteria.market));
  const result = useMemo(() => snapshot && criteria && currentMarketHasResearch ? evaluateSearch(snapshot, criteria, 'client-preview') : null, [snapshot, criteria, currentMarketHasResearch]);
  const activeResult = serverResult && result && serverResult.snapshotId === result.snapshotId && JSON.stringify(serverResult.criteria) === JSON.stringify(criteria) ? serverResult : result;
  const resultMap = useMemo(() => new Map(activeResult?.results.map(r => [r.homeId,r]) || []), [activeResult]);
  resultMapRef.current = resultMap;
  const homeMap = useMemo(() => new Map(snapshot?.homes.map(h => [h.id,h]) || []), [snapshot]);
  const ordered = useMemo(() => {
    if (!snapshot || !activeResult) return [];
    const rank = { matches: 0, needs_verification: 1, near_match: 2 };
    return activeResult.results.map(r => ({ home: homeMap.get(r.homeId), result: r })).filter((x): x is { home: Home; result: EvaluatedHome } => Boolean(x.home)).sort((a,b) => {
      const fit = rank[a.result.fit] - rank[b.result.fit];
      if (fit) return fit;
      if (criteria?.sort === 'personal_rent') return (a.result.cost.personalBaseRent ?? Infinity) - (b.result.cost.personalBaseRent ?? Infinity);
      if (criteria?.sort === 'walk') return (snapshot.routes.find(r => r.id === a.result.routeId)?.durationSeconds ?? Infinity) - (snapshot.routes.find(r => r.id === b.result.routeId)?.durationSeconds ?? Infinity);
      if (criteria?.sort === 'unresolved_costs') return a.result.cost.unknownItems.length - b.result.cost.unknownItems.length;
      return b.home.lastObservedAt.localeCompare(a.home.lastObservedAt);
    });
  }, [snapshot, activeResult, homeMap, criteria?.sort]);
  const selectedHome = selectedHomeId ? homeMap.get(selectedHomeId) : undefined;
  const selectedResult = selectedHomeId ? resultMap.get(selectedHomeId) : undefined;
  const compareItems = compareIds.map(homeId => ({ home: homeMap.get(homeId), result: resultMap.get(homeId) })).filter((x): x is { home: Home; result: EvaluatedHome | undefined } => Boolean(x.home));
  const shortlistItems = shortlistIds.map(homeId => ({ home: homeMap.get(homeId), result: resultMap.get(homeId) })).filter((x): x is { home: Home; result: EvaluatedHome | undefined } => Boolean(x.home));

  useEffect(() => {
    if (!snapshot || !criteria) return;
    const requestId = id();
    requestRef.current = requestId;
    const expectedSnapshot = snapshot.id;
    const expectedDestination = criteria.destination.version;
    api.search(expectedSnapshot, requestId, criteria).then(value => {
      const response = value as SearchResult;
      if (requestRef.current === requestId && snapshotRef.current === expectedSnapshot && destinationRef.current === expectedDestination && response.snapshotId === expectedSnapshot && response.requestId === requestId) setServerResult(response);
    }).catch(() => { /* immediate validated client result remains usable */ });
  }, [snapshot, criteria]);

  useEffect(() => {
    if (!job || ['succeeded','partial','failed','cancelled'].includes(job.status)) return;
    let cancelled = false;
    const timer = setTimeout(async () => {
      if (document.hidden) return;
      try {
        const updated = (await api.job(job.id)).job;
        if (cancelled) return;
        setJob(updated);
        if (['succeeded','partial'].includes(updated.status) && updated.snapshotId) {
          const next = validateSnapshot((await api.snapshot(updated.snapshotId)).snapshot);
          if (cancelled) return;
          if (job.type === 'routes' && next.routes.some(r => r.destinationVersion !== destinationRef.current) && !next.routes.some(r => r.destinationVersion === destinationRef.current)) { setNotice('A route job finished for an earlier destination; the current search remains unchanged.'); return; }
          const previous = snapshotRef.current;
          snapshotRef.current = next.id;
          setSnapshot(next);
          setServerResult(null);
          setNotice(`${job.type === 'discovery' ? 'Research' : 'Routes'} updated. Snapshot ${next.id}${previous === next.id ? '' : ' replaced the previous view'}.`);
        } else if (updated.status === 'failed' || updated.status === 'cancelled') setNotice(`${job.type === 'discovery' ? 'Research' : 'Routing'} ${updated.status}: ${updated.error?.message || 'The saved snapshot remains available.'}`);
      } catch (e) { if (!cancelled) setNotice(`Update check failed: ${e instanceof Error ? e.message : String(e)}. The current list remains available.`); }
    }, 1000);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [job]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { setCompareOpen(false); setDestinationOpen(false); setImportOpen(false); if (selectedHomeId) setSelectedHomeId(null); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [selectedHomeId]);

  const patch = (change: CriteriaPatch) => {
    if (!criteria) return;
    try { const next = applyCriteriaPatch(criteria, change); setCriteria(next); setServerResult(null); destinationRef.current = next.destination.version; setNotice(''); } catch (e) { setNotice(`Could not apply preference: ${e instanceof Error ? e.message : String(e)}`); }
  };
  const startDiscovery = async () => {
    if (!criteria) return;
    try { setNotice('Searching supported sources. You can keep using this snapshot.'); setJob((await api.discovery(criteria)).job); } catch (e) { setNotice(`Research could not start: ${e instanceof Error ? e.message : String(e)}`); }
  };
  const updateDestination = async (destination: Destination, market?: Criteria['market']) => {
    if (!criteria || !snapshot) return;
    const next = { ...criteria, destination, market: market || criteria.market };
    destinationRef.current = destination.version;
    setCriteria(next);
    setServerResult(null);
    setDestinationOpen(false);
    setPinMode(false);
    setNotice(`Destination changed to ${destination.label}. Old walking routes cannot confirm this search.`);
    try { setJob((await api.routes(snapshot.id, destination, snapshot.homes.map(h => h.id))).job); } catch (e) { setNotice(`Destination changed. Route update unavailable: ${e instanceof Error ? e.message : String(e)}`); }
  };
  const geocodeDestination = async () => {
    if (!criteria || !destinationQuery.trim()) return;
    setDestinationBusy(true);
    setDestinationCandidates([]);
    try { const response = await api.destination(destinationQuery.trim(), criteria.market); setDestinationCandidates(response.candidates); if (!response.candidates.length) setNotice('No mapped destination found. Choose a point on the map instead.'); } catch (e) { setNotice(`Destination lookup failed: ${e instanceof Error ? e.message : String(e)}. You can choose a map point.`); }
    finally { setDestinationBusy(false); }
  };
  const pinDestination = (lat: number, lon: number) => {
    if (!criteria) return;
    void updateDestination({ ...criteria.destination, id: `custom:${id()}`, version: id(), label: destinationQuery.trim() || 'Chosen map point', coordinate: { lat, lon }, evidenceIds: [], caveat: 'User-selected map point; entrance has not been physically verified.' });
  };
  const selectHome = (homeId: string) => {
    if (!selectedHomeId) listScrollRef.current = listRef.current?.scrollTop ?? 0;
    setSelectedHomeId(homeId);
    setMapView(false);
    requestAnimationFrame(() => { const target = document.getElementById(`home-${homeId}`); if (target) target.scrollIntoView({ block: 'center', behavior: 'smooth' }); });
  };
  const backToList = () => { setSelectedHomeId(null); requestAnimationFrame(() => { if (listRef.current) listRef.current.scrollTop = listScrollRef.current; }); };
  const toggleShortlist = (homeId: string) => setShortlistIds(ids => ids.includes(homeId) ? ids.filter(x => x !== homeId) : [...ids, homeId]);
  const toggleCompare = (homeId: string) => setCompareIds(ids => ids.includes(homeId) ? ids.filter(x => x !== homeId) : ids.length < 3 ? [...ids, homeId] : (setNotice('Comparison holds up to three homes. Remove one before adding another.'), ids));
  const runImport = async () => { try { setJob((await api.import(importSource, importUrl, importText)).job); setImportOpen(false); setNotice('Checking the supplied listing against source evidence.'); } catch (e) { setNotice(`Import could not start: ${e instanceof Error ? e.message : String(e)}`); } };

  if (error) return <div className="boot-state"><div className="wordmark">address<span>.</span></div><h1>Research is temporarily unavailable.</h1><p>{error}</p><button className="plain-button" onClick={() => location.reload()}>Try again</button></div>;
  if (!bootstrap || !snapshot || !criteria || !baseline) return <div className="boot-state"><div className="wordmark">address<span>.</span></div><h1>Opening saved housing research…</h1><p>Loading the sourced snapshot and its search criteria.</p></div>;

  return <div className="app-shell" style={{ '--list-percent': `${presentation.listPercent}%`, '--map-percent': `${presentation.mapPercent}%` } as React.CSSProperties}>
    <header className="app-header"><div className="brand-block"><div className="wordmark">{presentation.wordmark}<span>.</span></div><span className="brand-divider"/><span className="brand-tagline">A clearer way to choose home</span></div><div className="header-actions"><span className="snapshot-label mono">SNAPSHOT {snapshot.id} · {dateTime(snapshot.createdAt)}</span><button className="plain-button find-button" onClick={startDiscovery} disabled={!bootstrap.capabilities.discovery || Boolean(job && ['queued','running'].includes(job.status))}><Plus size={16}/> Find more homes</button></div></header>
    <div className="workspace-heading"><div><span className="eyebrow">Research workspace / {criteria.market.label}, {criteria.market.region}</span><h1>{presentation.title}</h1></div><div className="workspace-mode"><button className={`mode-button ${!mapView ? 'active' : ''}`} onClick={() => setMapView(false)}><List size={16}/> List</button><button className={`mode-button ${mapView ? 'active' : ''}`} onClick={() => setMapView(true)}><MapIcon size={16}/> Map</button></div></div>
    <CriteriaBar criteria={criteria} baseline={baseline} onPatch={patch} onRevert={() => { setCriteria(baseline); destinationRef.current = baseline.destination.version; setNotice('Original requirements restored.'); }} onDestinationEdit={() => setDestinationOpen(true)}/>
    {notice && <div className="notice-bar" role="status"><span>{notice}</span><button className="icon-button" onClick={() => setNotice('')} aria-label="Dismiss message"><X size={15}/></button></div>}
    {job && ['queued','running'].includes(job.status) && <div className="job-bar" role="status"><span className="pulse-dot"/><strong>{job.type === 'discovery' ? 'Researching sources' : 'Computing walking routes'}</strong><span>{job.progress.message}</span>{job.progress.total != null && <span className="mono">{job.progress.completed}/{job.progress.total}</span>}</div>}
    {result && <CoveragePanel snapshot={snapshot} result={result} onRefresh={startDiscovery} busy={Boolean(job && ['queued','running'].includes(job.status))} capabilities={bootstrap.capabilities.discovery}/>}
    <main className={`workspace ${mapView ? 'mobile-map-view' : ''}`}>
      <div className="list-pane" ref={listRef}>
        {selectedHome && selectedResult ? <HomeDetail snapshot={snapshot} criteria={criteria} home={selectedHome} result={selectedResult} onBack={backToList} saved={shortlistIds.includes(selectedHome.id)} comparing={compareIds.includes(selectedHome.id)} onSave={() => toggleShortlist(selectedHome.id)} onCompare={() => toggleCompare(selectedHome.id)}/> : <>
          {result?.discoveryNeeded && <div className="discovery-needed"><Compass size={18}/><div><strong>More research needed for this search</strong><p>{result.discoveryReason || 'The current research scope does not cover these requirements.'} Existing records are still shown with their evidence.</p></div><button className="plain-button" onClick={startDiscovery} disabled={!bootstrap.capabilities.discovery}>Search now <ArrowRight size={14}/></button></div>}
          {!currentMarketHasResearch && <div className="market-empty"><span className="eyebrow">New market</span><h2>No saved research for {criteria.market.label}, {criteria.market.region}.</h2><p>The Pittsburgh snapshot cannot represent homes in this city. Search supported sources to build a new inventory.</p><button className="plain-button primary-button" onClick={startDiscovery} disabled={!bootstrap.capabilities.discovery}>Find homes here <ArrowRight size={16}/></button></div>}
          {result && <>
            <Alternatives alternatives={result.alternatives} criteria={criteria} onApply={patch}/>
            <div className="list-title"><div><span className="eyebrow">Homes in this snapshot</span><h2>Browse the evidence <span>{ordered.length}</span></h2></div><div className="sort-control"><label htmlFor="sort">Sort within each group</label><select id="sort" value={criteria.sort} onChange={e => setCriteria({ ...criteria, sort: e.target.value as Criteria['sort'] })}><option value="personal_rent">Your rent share</option><option value="walk">Walk time</option><option value="unresolved_costs">Unresolved costs</option><option value="observed_at">Last observed</option></select></div></div>
            {ordered.length === 0 && <div className="list-empty"><Search size={22}/><h3>No homes recorded in this snapshot.</h3><p>See Coverage for searched sources and limits, or run more discovery. Unknown listing data is never filled in to make a match.</p></div>}
            {(['matches','needs_verification','near_match'] as const).map(fit => { const group = ordered.filter(x => x.result.fit === fit); return group.length > 0 && <section className="home-group" key={fit}><div className="group-heading"><span>{fit === 'matches' ? 'Meets requirements' : fit === 'needs_verification' ? 'Needs verification' : 'Near matches'}</span><span className="mono">{group.length} {group.length === 1 ? 'home' : 'homes'}</span></div>{group.map(({ home, result: item }) => <HomeRow key={home.id} snapshot={snapshot} criteria={criteria} home={home} result={item} number={ordered.findIndex(x => x.home.id === home.id)+1} selected={selectedHomeId === home.id} saved={shortlistIds.includes(home.id)} comparing={compareIds.includes(home.id)} onSelect={() => selectHome(home.id)} onSave={() => toggleShortlist(home.id)} onCompare={() => toggleCompare(home.id)} onHover={hovered => setHoveredId(hovered ? home.id : null)}/>)}</section>; })}
            <div className="list-footer"><p>This is a saved research snapshot. A listing observation does not confirm current vacancy. Verify terms and availability at the original source.</p><button className="text-button" onClick={() => setImportOpen(true)}>Add a listing to check <ArrowUpRight size={14}/></button></div>
          </>}
        </>}
      </div>
      <MapPanel snapshot={snapshot} criteria={criteria} ordered={ordered} selectedId={selectedHomeId} hoveredId={hoveredId} onSelect={selectHome} onPinDestination={pinDestination} pinMode={pinMode}/>
    </main>
    <ShortlistRail items={shortlistItems} compareCount={compareIds.length} onCompare={() => setCompareOpen(true)} onRemove={toggleShortlist} onSelect={selectHome}/>
    {compareOpen && <CompareSheet items={compareItems} snapshot={snapshot} criteria={criteria} onClose={() => setCompareOpen(false)} onRemove={toggleCompare}/>}<div className="sr-only" role="status" aria-live="polite">{result ? `${result.counts.matches} homes meet requirements, ${result.counts.needsVerification} need verification, ${result.counts.nearMatches} near matches.` : ''}</div>
    {destinationOpen && <div className="sheet-backdrop" onClick={() => setDestinationOpen(false)}><div className="destination-dialog" role="dialog" aria-modal="true" aria-label="Change destination" onClick={e => e.stopPropagation()}><button className="icon-button dialog-close" onClick={() => setDestinationOpen(false)} aria-label="Close"><X size={20}/></button><span className="eyebrow">Destination</span><h2>Where should the walk end?</h2><p>Walking qualification uses the mapped point below. Changing it requires a new route calculation.</p><div className="destination-current"><strong>{criteria.destination.label}</strong><span className="mono">{criteria.destination.coordinate.lat.toFixed(6)}, {criteria.destination.coordinate.lon.toFixed(6)}</span><small>{criteria.destination.caveat}</small></div><label htmlFor="destination-query">Search a place or address</label><div className="destination-input"><input id="destination-query" value={destinationQuery} onChange={e => setDestinationQuery(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') void geocodeDestination(); }}/><button className="plain-button primary-button" onClick={geocodeDestination} disabled={destinationBusy}>{destinationBusy ? 'Looking up…' : 'Find point'}</button></div>{destinationCandidates.map(candidate => <button key={candidate.id} className="destination-candidate" onClick={() => void updateDestination({ ...candidate, version: id() })}><MapIcon size={16}/><span><strong>{candidate.label}</strong><small className="mono">{candidate.coordinate.lat.toFixed(6)}, {candidate.coordinate.lon.toFixed(6)}</small></span><ArrowRight size={16}/></button>)}<button className="text-button" onClick={() => { setDestinationOpen(false); setPinMode(true); setMapView(true); }}>Or choose a point on the map <ArrowRight size={14}/></button></div></div>}
    {importOpen && <div className="sheet-backdrop" onClick={() => setImportOpen(false)}><div className="destination-dialog" role="dialog" aria-modal="true" aria-label="Check an additional listing" onClick={e => e.stopPropagation()}><button className="icon-button dialog-close" onClick={() => setImportOpen(false)} aria-label="Close"><X size={20}/></button><span className="eyebrow">Add evidence</span><h2>Check a listing</h2><p>Import is a fallback for a listing you found. Its claims will be checked before they appear as confirmed facts.</p><label>Source<select value={importSource} onChange={e => setImportSource(e.target.value)}><option value="">Choose a registered source</option>{snapshot.sources.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select></label><label>Listing URL<input value={importUrl} onChange={e => setImportUrl(e.target.value)} type="url" placeholder="https://…"/></label><label>Listing text, if needed<textarea value={importText} onChange={e => setImportText(e.target.value)} rows={5}/></label><button className="plain-button primary-button" onClick={runImport} disabled={!importSource || !importUrl}>Check listing <ArrowRight size={15}/></button></div></div>}
  </div>;
}
