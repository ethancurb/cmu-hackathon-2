import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowRight, ArrowUpRight, Compass, GitCompareArrows, List, Map as MapIcon, Plus, Search, X } from 'lucide-react';
import type { Criteria, CriteriaPatch, Destination, EvaluatedHome, Home, SearchResult, Snapshot } from './domain/schema.js';
import { CriteriaSchema, validateSnapshot } from './domain/schema.js';
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

type SavedHomeLabel = { title: string; url: string };
type Stored = { criteria?: Criteria; baseline?: Criteria; selectedHomeId?: string | null; compareIds?: string[]; shortlistIds?: string[]; shortlistMeta?: Record<string, SavedHomeLabel>; snapshotId?: string };
const STORAGE_KEY = 'address-search-v1';
const readStored = (): Stored => { try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}') as Stored; } catch { return {}; } };
const id = () => typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`;
const marketKey = (market: Criteria['market']) => `${market.label.split('/')[0].trim()}|${market.region}|${market.country}`.toLowerCase();

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
  const [shortlistMeta, setShortlistMeta] = useState<Record<string, SavedHomeLabel>>({});
  const [job, setJob] = useState<Job | null>(null);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const [destinationOpen, setDestinationOpen] = useState(false);
  const [destinationQuery, setDestinationQuery] = useState('');
  const [marketCity, setMarketCity] = useState('Pittsburgh');
  const [marketRegion, setMarketRegion] = useState('PA');
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
  const pinMarketRef = useRef<Criteria['market'] | null>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const listScrollRef = useRef(0);
  const resultMapRef = useRef(new Map<string, EvaluatedHome>());
  const jobContextRef = useRef<{ id: string; destinationVersion: string } | null>(null);
  
  useEffect(() => {
    let active = true;
    api.bootstrap().then(data => {
      if (!active) return;
      const valid = validateSnapshot(data.snapshot);
      const saved = readStored();
      setBootstrap(data);
      setSnapshot(valid);
      snapshotRef.current = valid.id;
      const current = CriteriaSchema.safeParse(saved.criteria).success ? CriteriaSchema.parse(saved.criteria) : data.seed;
      setCriteria(current);
      setBaseline(CriteriaSchema.safeParse(saved.baseline).success ? CriteriaSchema.parse(saved.baseline) : data.seed);
      destinationRef.current = current.destination.version;
      setSelectedHomeId(saved.selectedHomeId || null);
      setCompareIds((saved.compareIds || []).slice(0,3));
      setShortlistIds(saved.shortlistIds || []);
      if (saved.shortlistMeta && typeof saved.shortlistMeta === 'object') setShortlistMeta(Object.fromEntries(Object.entries(saved.shortlistMeta).filter((entry): entry is [string, SavedHomeLabel] => typeof entry[1]?.title === 'string' && typeof entry[1]?.url === 'string')));
    }).catch(e => { if (active) setError(`Could not load the saved housing research: ${e instanceof Error ? e.message : String(e)}`); });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!criteria || !snapshot) return;
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify({ criteria, baseline: baseline ?? undefined, selectedHomeId, compareIds, shortlistIds, shortlistMeta, snapshotId: snapshot.id } satisfies Stored)); } catch { /* private browsing */ }
  }, [criteria, baseline, selectedHomeId, compareIds, shortlistIds, shortlistMeta, snapshot]);

  const currentMarketHasResearch = Boolean(snapshot && criteria && marketKey(snapshot.discoveryMarket) === marketKey(criteria.market));
  const result = useMemo(() => snapshot && criteria && currentMarketHasResearch ? evaluateSearch(snapshot, criteria, 'client-preview') : null, [snapshot, criteria, currentMarketHasResearch]);
  const activeResult = serverResult && result && serverResult.snapshotId === result.snapshotId && JSON.stringify(serverResult.criteria) === JSON.stringify(criteria) ? serverResult : result;
  const resultMap = useMemo(() => new Map(activeResult?.results.map(r => [r.homeId,r]) || []), [activeResult]);
  resultMapRef.current = resultMap;
  const homeMap = useMemo(() => new Map(snapshot?.homes.map(h => [h.id,h]) || []), [snapshot]);
  const ordered = useMemo(() => {
    if (!snapshot || !activeResult) return [];
    const rank = { matches: 0, near_match: 1, needs_verification: 2 };
    const oneChangeOrder = new Map(activeResult.alternatives.flatMap((alternative, index) => alternative.newlyMatchedIds.map(homeId => [homeId, index] as const)));
    return activeResult.results.map(r => ({ home: homeMap.get(r.homeId), result: r })).filter((x): x is { home: Home; result: EvaluatedHome } => Boolean(x.home)).sort((a,b) => {
      const fit = rank[a.result.fit] - rank[b.result.fit];
      if (fit) return fit;
      if (criteria?.sort === 'smallest_change' && a.result.fit === 'near_match') { const distance = (oneChangeOrder.get(a.home.id) ?? Infinity) - (oneChangeOrder.get(b.home.id) ?? Infinity); if (!Number.isNaN(distance) && distance) return distance; }
      if (criteria?.sort === 'smallest_change') return (a.result.cost.personalBaseRent ?? Infinity) - (b.result.cost.personalBaseRent ?? Infinity);
      if (criteria?.sort === 'personal_rent') return (a.result.cost.personalBaseRent ?? Infinity) - (b.result.cost.personalBaseRent ?? Infinity);
      if (criteria?.sort === 'walk') return (snapshot.routes.find(r => r.id === a.result.routeId)?.durationSeconds ?? Infinity) - (snapshot.routes.find(r => r.id === b.result.routeId)?.durationSeconds ?? Infinity);
      if (criteria?.sort === 'unresolved_costs') return a.result.cost.unknownItems.length - b.result.cost.unknownItems.length;
      return b.home.lastObservedAt.localeCompare(a.home.lastObservedAt);
    });
  }, [snapshot, activeResult, homeMap, criteria?.sort]);
  const selectedHome = selectedHomeId ? homeMap.get(selectedHomeId) : undefined;
  const selectedResult = selectedHomeId ? resultMap.get(selectedHomeId) : undefined;
  const compareItems = compareIds.map(homeId => ({ home: homeMap.get(homeId), result: resultMap.get(homeId) })).filter((x): x is { home: Home; result: EvaluatedHome | undefined } => Boolean(x.home));
  const shortlistItems = shortlistIds.map(homeId => ({ id: homeId, home: homeMap.get(homeId), result: resultMap.get(homeId), meta: shortlistMeta[homeId] }));

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
    let polling = false;
    const poll = async () => {
      if (cancelled || polling || document.hidden) return;
      if (Date.now() - Date.parse(job.createdAt) > 7.5 * 60_000) { setNotice('This job has not reported a result within its time limit. The saved list remains available.'); setJob(null); return; }
      polling = true;
      try {
        const updated = (await api.job(job.id)).job;
        if (cancelled) return;
        if (['succeeded','partial'].includes(updated.status) && updated.snapshotId) {
          if (job.type === 'routes' && jobContextRef.current?.id === job.id && jobContextRef.current.destinationVersion !== destinationRef.current) { setNotice('A route job finished for an earlier destination; the current search remains unchanged.'); setJob(updated); return; }
          const next = validateSnapshot((await api.snapshot(updated.snapshotId)).snapshot);
          if (cancelled) return;
          const previous = snapshotRef.current;
          snapshotRef.current = next.id;
          setSnapshot(next);
          setServerResult(null);
          setNotice(`${job.type === 'discovery' ? 'Research' : 'Routes'} updated. Snapshot ${next.id}${previous === next.id ? '' : ' replaced the previous view'}.`);
          setJob(updated);
        } else {
          if (updated.status === 'failed' || updated.status === 'cancelled') setNotice(`${job.type === 'discovery' ? 'Research' : 'Routing'} ${updated.status}: ${updated.error?.message || 'The saved snapshot remains available.'}`);
          setJob(updated);
        }
      } catch (e) { if (!cancelled) setNotice(`Update check failed: ${e instanceof Error ? e.message : String(e)}. Retrying while this job is active; the current list remains available.`); }
      finally { polling = false; }
    };
    const timer = window.setInterval(() => { void poll(); }, 1000);
    const onVisible = () => { if (!document.hidden) void poll(); };
    document.addEventListener('visibilitychange', onVisible);
    return () => { cancelled = true; window.clearInterval(timer); document.removeEventListener('visibilitychange', onVisible); };
  }, [job?.id, job?.status]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { setCompareOpen(false); setDestinationOpen(false); setImportOpen(false); if (selectedHomeId) setSelectedHomeId(null); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [selectedHomeId]);

  useEffect(() => { if (!notice) return; const timeout = window.setTimeout(() => setNotice(''), 4500); return () => window.clearTimeout(timeout); }, [notice]);
  useEffect(() => { setNotice(''); }, [selectedHomeId, compareOpen]);

  const patch = (change: CriteriaPatch) => {
    if (!criteria) return;
    try { const next = applyCriteriaPatch(criteria, change); setCriteria(next); setServerResult(null); destinationRef.current = next.destination.version; setNotice(''); } catch (e) { setNotice(`Could not apply preference: ${e instanceof Error ? e.message : String(e)}`); }
  };
  const startDiscovery = async () => {
    if (!criteria) return;
    try { setNotice('Searching supported sources. You can keep using this snapshot.'); const started = (await api.discovery(criteria)).job; jobContextRef.current = { id: started.id, destinationVersion: criteria.destination.version }; setJob(started); } catch (e) { setNotice(`Research could not start: ${e instanceof Error ? e.message : String(e)}`); }
  };
  const updateDestination = async (destination: Destination, market?: Criteria['market']) => {
    if (!criteria || !snapshot) return;
    const next = { ...criteria, destination, market: market || criteria.market };
    const changedMarket = marketKey(next.market) !== marketKey(snapshot.discoveryMarket);
    destinationRef.current = destination.version;
    setCriteria(next);
    setServerResult(null);
    setDestinationOpen(false);
    setPinMode(false);
    if (changedMarket) { setJob(null); jobContextRef.current = null; setNotice(`City changed to ${next.market.label}, ${next.market.region}. Start research to find options here; the Pittsburgh inventory does not qualify.`); return; }
    setNotice(`Destination changed to ${destination.label}. Old walking routes cannot confirm this search.`);
    try { const locatedIds = snapshot.homes.filter(h => h.coordinate.value).map(h => h.id); const started = (await api.routes(snapshot.id, destination, locatedIds.slice(0,100))).job; jobContextRef.current = { id: started.id, destinationVersion: destination.version }; setJob(started); if (locatedIds.length > 100) setNotice(`Routing the first 100 located options. ${locatedIds.length - 100} still need route research; none will silently qualify.`); } catch (e) { setNotice(`Destination changed. Route update unavailable: ${e instanceof Error ? e.message : String(e)}`); }
  };
  const geocodeDestination = async () => {
    if (!criteria || !destinationQuery.trim()) return;
    if (!marketCity.trim() || !/^[A-Za-z]{2}$/.test(marketRegion.trim())) { setNotice('Enter a city and two-letter state before finding a destination.'); return; }
    setDestinationBusy(true);
    setDestinationCandidates([]);
    try { const response = await api.destination(destinationQuery.trim(), { label: marketCity.trim() || criteria.market.label, region: marketRegion.trim().toUpperCase() || criteria.market.region, country: 'US' }); setDestinationCandidates(response.candidates); if (!response.candidates.length) setNotice('No mapped destination found. Choose a point on the map instead.'); } catch (e) { setNotice(`Destination lookup failed: ${e instanceof Error ? e.message : String(e)}. You can choose a map point.`); }
    finally { setDestinationBusy(false); }
  };
  const pinDestination = async (lat: number, lon: number) => {
    if (!criteria) return;
    try {
      const response = await api.pinDestination(destinationQuery.trim() || 'Chosen map point', { lat, lon });
      const candidate = response.candidates[0];
      if (!candidate) throw new Error('The map point was not accepted.');
      await updateDestination(candidate, pinMarketRef.current || criteria.market);
      pinMarketRef.current = null;
    } catch (e) { setNotice(`Map point could not be set: ${e instanceof Error ? e.message : String(e)}`); }
  };
  const openDestination = () => { if (!criteria) return; setMarketCity(criteria.market.label.split('/')[0].trim()); setMarketRegion(criteria.market.region); setDestinationQuery(''); setDestinationCandidates([]); setDestinationOpen(true); };
  const selectHome = (homeId: string) => {
    if (!selectedHomeId) listScrollRef.current = listRef.current?.scrollTop ?? 0;
    setSelectedHomeId(homeId);
    setMapView(false);
    requestAnimationFrame(() => { const target = document.getElementById(`home-${homeId}`); if (target) target.scrollIntoView({ block: 'center', behavior: 'smooth' }); });
  };
  const backToList = () => { setSelectedHomeId(null); requestAnimationFrame(() => { if (listRef.current) listRef.current.scrollTop = listScrollRef.current; }); };
  const toggleShortlist = (homeId: string) => { const home = homeMap.get(homeId); if (home) setShortlistMeta(meta => ({ ...meta, [homeId]: { title: title(home), url: home.primaryUrl } })); setShortlistIds(ids => ids.includes(homeId) ? ids.filter(x => x !== homeId) : [...ids, homeId]); };
  const toggleCompare = (homeId: string) => setCompareIds(ids => ids.includes(homeId) ? ids.filter(x => x !== homeId) : ids.length < 3 ? [...ids, homeId] : (setNotice('Comparison holds up to three homes. Remove one before adding another.'), ids));
  const runImport = async () => { if (!criteria || !snapshot) return; try { const started = (await api.import(importSource, importUrl, importText, criteria, snapshot.id)).job; jobContextRef.current = { id: started.id, destinationVersion: criteria.destination.version }; setJob(started); setImportOpen(false); setNotice('Checking the supplied listing against source evidence.'); } catch (e) { setNotice(`Import could not start: ${e instanceof Error ? e.message : String(e)}`); } };
  const resetDemo = () => { try { localStorage.removeItem(STORAGE_KEY); } catch { /* private browsing */ } destinationRef.current = bootstrap?.seed.destination.version || ''; pinMarketRef.current = null; jobContextRef.current = null; setJob(null); setCriteria(bootstrap?.seed || null); setBaseline(bootstrap?.seed || null); setSelectedHomeId(null); setCompareIds([]); setShortlistIds([]); setShortlistMeta({}); setServerResult(null); setNotice('Saved demo search restored.'); };

  if (error) return <div className="boot-state"><div className="wordmark">address<span>.</span></div><h1>Research is temporarily unavailable.</h1><p>{error}</p><button className="plain-button" onClick={() => location.reload()}>Try again</button></div>;
  if (!bootstrap || !snapshot || !criteria || !baseline) return <div className="boot-state"><div className="wordmark">address<span>.</span></div><h1>Opening saved housing research…</h1><p>Loading the sourced snapshot and its search criteria.</p></div>;

  return <div className="app-shell" style={{ '--list-percent': `${presentation.listPercent}%`, '--map-percent': `${presentation.mapPercent}%` } as React.CSSProperties}>
    <header className="app-header"><div className="brand-block"><div className="wordmark">{presentation.wordmark}<span>.</span></div><span className="brand-divider"/><button className="brand-tagline mono" onClick={openDestination} aria-label={`Change research city from ${criteria.market.label}, ${criteria.market.region}`}>{criteria.market.label}, {criteria.market.region} / housing research</button></div><div className="header-actions"><span className="snapshot-label mono">RESEARCH SAVED {dateTime(snapshot.createdAt)}</span><button className="reset-button" onClick={resetDemo}>Reset demo</button><button className="plain-button find-button" onClick={startDiscovery} disabled={!bootstrap.capabilities.discovery || Boolean(job && ['queued','running'].includes(job.status))}><Plus size={16}/> Find more homes</button><div className="workspace-mode"><button className={`mode-button ${!mapView ? 'active' : ''}`} onClick={() => setMapView(false)}><List size={16}/> List</button><button className={`mode-button ${mapView ? 'active' : ''}`} onClick={() => setMapView(true)}><MapIcon size={16}/> Map</button></div></div></header>
    <CriteriaBar criteria={criteria} baseline={baseline} onPatch={patch} onRevert={() => { setCriteria(baseline); destinationRef.current = baseline.destination.version; setNotice('Original requirements restored.'); }} onDestinationEdit={openDestination}/>
    {notice && <div className="notice-bar" role="status"><span>{notice}</span><button className="icon-button" onClick={() => setNotice('')} aria-label="Dismiss message"><X size={15}/></button></div>}
    {job && ['queued','running'].includes(job.status) && <div className="job-bar" role="status"><span className="pulse-dot"/><strong>{job.type === 'discovery' ? 'Researching sources' : 'Computing walking routes'}</strong><span>{job.progress.message}</span>{job.progress.total != null && <span className="mono">{job.progress.completed}/{job.progress.total}</span>}</div>}
    {activeResult && <CoveragePanel snapshot={snapshot} result={activeResult} onRefresh={startDiscovery} busy={Boolean(job && ['queued','running'].includes(job.status))} capabilities={bootstrap.capabilities.discovery}/>}
    <main className={`workspace ${mapView ? 'mobile-map-view' : ''}`}>
      <div className="list-pane" ref={listRef}>
        {selectedHome && selectedResult ? <HomeDetail snapshot={snapshot} criteria={criteria} home={selectedHome} result={selectedResult} onBack={backToList} saved={shortlistIds.includes(selectedHome.id)} comparing={compareIds.includes(selectedHome.id)} onSave={() => toggleShortlist(selectedHome.id)} onCompare={() => toggleCompare(selectedHome.id)}/> : <>
          {activeResult?.discoveryNeeded && <div className="discovery-needed"><Compass size={18}/><div><strong>More research needed for this search</strong><p>{activeResult.discoveryReason || 'The current research scope does not cover these requirements.'} Existing records are still shown with their evidence.</p></div><button className="plain-button" onClick={startDiscovery} disabled={!bootstrap.capabilities.discovery}>Search now <ArrowRight size={14}/></button></div>}
          {!currentMarketHasResearch && <div className="market-empty"><span className="eyebrow">New market</span><h2>No saved research for {criteria.market.label}, {criteria.market.region}.</h2><p>The Pittsburgh snapshot cannot represent homes in this city. Search supported sources to build a new inventory.</p><button className="plain-button primary-button" onClick={startDiscovery} disabled={!bootstrap.capabilities.discovery}>Find homes here <ArrowRight size={16}/></button></div>}
          {activeResult && <>
            {activeResult.counts.matches === 0 && <div className="zero-banner"><strong>No options meet all requirements in this snapshot.</strong><span>{activeResult.counts.needsVerification} need evidence for one or more requirements; {activeResult.counts.nearMatches} have a known deviation. The search has not been relaxed.</span></div>}
            {activeResult.counts.matches === 0 && <Alternatives alternatives={activeResult.alternatives} criteria={criteria} snapshot={snapshot} onApply={patch} onSelectHome={selectHome}/>} 
            {ordered.length === 0 && <div className="list-empty"><Search size={22}/><h3>No homes recorded in this snapshot.</h3><p>See Coverage for searched sources and limits, or run more discovery. Unknown listing data is never filled in to make a match.</p></div>}
            {(['matches','near_match','needs_verification'] as const).map(fit => { const group = ordered.filter(x => x.result.fit === fit); return group.length > 0 && <div key={fit}><section className="home-group"><div className="group-heading"><span>{fit === 'matches' ? 'Meets requirements' : fit === 'near_match' ? <>Near matches{criteria.sort === 'smallest_change' && <span className="group-sort-context"> · smallest changes first</span>}</> : 'Needs verification'}</span><div className="group-tools"><span className="mono">{group.length} {group.length === 1 ? 'option' : 'options'}</span>{fit === ordered[0]?.result.fit && <select aria-label="Sort options within each group" value={criteria.sort} onChange={e => setCriteria({ ...criteria, sort: e.target.value as Criteria['sort'] })}><option value="smallest_change">Sort: smallest change</option><option value="personal_rent">Sort: your rent</option><option value="walk">Sort: walk</option><option value="unresolved_costs">Sort: cost unknowns</option><option value="observed_at">Sort: last seen</option></select>}</div></div>{group.map(({ home, result: item }) => <HomeRow key={home.id} snapshot={snapshot} criteria={criteria} home={home} result={item} number={ordered.findIndex(x => x.home.id === home.id)+1} selected={selectedHomeId === home.id} saved={shortlistIds.includes(home.id)} comparing={compareIds.includes(home.id)} onSelect={() => selectHome(home.id)} onSave={() => toggleShortlist(home.id)} onCompare={() => toggleCompare(home.id)} onHover={hovered => setHoveredId(hovered ? home.id : null)}/>)}</section>{fit === 'matches' && <Alternatives alternatives={activeResult.alternatives} criteria={criteria} snapshot={snapshot} onApply={patch} onSelectHome={selectHome}/>}</div>; })}
            <div className="list-footer"><p>This is a saved research snapshot. A listing observation does not confirm current vacancy. Verify terms and availability at the original source.</p><button className="text-button" onClick={() => setImportOpen(true)}>Add a listing to check <ArrowUpRight size={14}/></button></div>
          </>}
        </>}
      </div>
      <MapPanel snapshot={snapshot} criteria={criteria} ordered={ordered} selectedId={selectedHomeId} hoveredId={hoveredId} onSelect={selectHome} onPinDestination={pinDestination} pinMode={pinMode}/>
    </main>
    <ShortlistRail items={shortlistItems} compareCount={compareIds.length} onCompare={() => setCompareOpen(true)} onRemove={toggleShortlist} onSelect={selectHome}/>
    {compareOpen && <CompareSheet items={compareItems} snapshot={snapshot} criteria={criteria} onClose={() => setCompareOpen(false)} onRemove={toggleCompare}/>}<div className="sr-only" role="status" aria-live="polite">{activeResult ? `${activeResult.counts.matches} options meet requirements, ${activeResult.counts.needsVerification} need verification, ${activeResult.counts.nearMatches} near matches.` : ''}</div>
    {destinationOpen && <div className="sheet-backdrop" onClick={() => setDestinationOpen(false)}><div className="destination-dialog" role="dialog" aria-modal="true" aria-label="Change destination" onClick={e => e.stopPropagation()}><button className="icon-button dialog-close" onClick={() => setDestinationOpen(false)} aria-label="Close"><X size={20}/></button><span className="eyebrow">Destination</span><h2>Where are you moving?</h2><p>Choose a research city and the point your walk should end at. A new city needs its own housing search.</p><div className="destination-current"><strong>{criteria.destination.label}</strong><span className="mono">{criteria.destination.coordinate.lat.toFixed(6)}, {criteria.destination.coordinate.lon.toFixed(6)}</span><small>{criteria.destination.caveat}</small></div><div className="market-fields"><label htmlFor="market-city">City to research<input id="market-city" value={marketCity} onChange={e => { setMarketCity(e.target.value); setDestinationCandidates([]); }}/></label><label htmlFor="market-region">State<input id="market-region" value={marketRegion} maxLength={2} onChange={e => { setMarketRegion(e.target.value.toUpperCase()); setDestinationCandidates([]); }}/></label></div><label htmlFor="destination-query">Destination address or place</label><div className="destination-input"><input id="destination-query" value={destinationQuery} onChange={e => setDestinationQuery(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') void geocodeDestination(); }}/><button className="plain-button primary-button" onClick={geocodeDestination} disabled={destinationBusy}>{destinationBusy ? 'Looking up…' : 'Find point'}</button></div>{destinationCandidates.map(candidate => <button key={candidate.id} className="destination-candidate" onClick={() => void updateDestination({ ...candidate, version: id() }, { label: marketCity.trim(), region: marketRegion.trim().toUpperCase(), country: 'US' })}><MapIcon size={16}/><span><strong>{candidate.label}</strong><small className="mono">{candidate.coordinate.lat.toFixed(6)}, {candidate.coordinate.lon.toFixed(6)}</small></span><ArrowRight size={16}/></button>)}<button className="text-button" onClick={() => { pinMarketRef.current = { label: marketCity.trim() || criteria.market.label, region: marketRegion.trim().toUpperCase() || criteria.market.region, country: 'US' }; setDestinationOpen(false); setPinMode(true); setMapView(true); }}>Or choose a point on the map <ArrowRight size={14}/></button></div></div>}
    {importOpen && <div className="sheet-backdrop" onClick={() => setImportOpen(false)}><div className="destination-dialog" role="dialog" aria-modal="true" aria-label="Check an additional listing" onClick={e => e.stopPropagation()}><button className="icon-button dialog-close" onClick={() => setImportOpen(false)} aria-label="Close"><X size={20}/></button><span className="eyebrow">Add evidence</span><h2>Check a listing</h2><p>Import is a fallback for a listing you found. Its claims will be checked before they appear as confirmed facts.</p><label>Source<select value={importSource} onChange={e => setImportSource(e.target.value)}><option value="">Choose a registered housing source</option>{snapshot.sources.filter(s => !s.id.startsWith('geo:')).map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select></label><label>Listing URL<input value={importUrl} onChange={e => setImportUrl(e.target.value)} type="url" placeholder="https://…"/></label><label>Listing text, if needed<textarea value={importText} onChange={e => setImportText(e.target.value)} rows={5}/></label><button className="plain-button primary-button" onClick={runImport} disabled={!importSource || !importUrl}>Check listing <ArrowRight size={15}/></button></div></div>}
  </div>;
}
