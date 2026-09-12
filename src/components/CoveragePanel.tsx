import { ChevronDown, Database, RefreshCw } from 'lucide-react';
import type { SearchResult, Snapshot, SourceRun } from '../domain/schema.js';
import { dateTime, shortDate } from '../lib/view.js';

type Props = { snapshot: Snapshot; result: SearchResult; onRefresh: () => void; busy: boolean; capabilities: boolean };

export function CoveragePanel({ snapshot, result, onRefresh, busy, capabilities }: Props) {
  const housingSources = snapshot.sources.filter(source => !source.id.startsWith('geo:'));
  const supportingSources = snapshot.sources.filter(source => source.id.startsWith('geo:'));
  const runsBySource = new Map<string, SourceRun[]>();
  for (const run of snapshot.sourceRuns) runsBySource.set(run.sourceId, [...(runsBySource.get(run.sourceId) || []), run]);
  const runsFor = (id: string) => runsBySource.get(id) || [];
  const searched = housingSources.filter(source => runsFor(source.id).some(run => ['queried','fetched','imported'].includes(run.status)));
  const attempted = housingSources.filter(source => runsFor(source.id).some(run => run.status !== 'not_searched'));
  const gaps = housingSources.filter(source => !searched.includes(source));
  const organizations = new Set(searched.map(source => source.family));
  const dates = snapshot.homes.map(h => h.lastObservedAt).sort();
  const merged = snapshot.sourceRuns.reduce((sum, run) => sum + run.duplicateObservations, 0);
  const window = dates.length ? (shortDate(dates[0]) === shortDate(dates[dates.length-1]) ? shortDate(dates[0]) : `${shortDate(dates[0])}–${shortDate(dates[dates.length-1])}`) : dateTime(snapshot.createdAt);
  return <div className="coverage-block">
    <div className="coverage-strip">
      <div className="coverage-primary"><Database size={15}/><strong>{snapshot.homes.length} researched option{snapshot.homes.length === 1 ? '' : 's'}</strong><span className="coverage-divider"/><span>{result.counts.matches} meet requirements</span><span>{result.counts.needsVerification} need verification</span><span>{result.counts.nearMatches} near matches</span></div>
      <div className="coverage-secondary"><span className="mono">{searched.length} housing {searched.length === 1 ? 'source' : 'sources'} searched · checked {window}</span><button className="refresh-button" onClick={onRefresh} disabled={busy || !capabilities} title={capabilities ? 'Search supported sources again' : 'Live discovery unavailable'}><RefreshCw size={13} className={busy ? 'spinning' : ''}/> {busy ? 'Searching' : 'Refresh'}</button>
        <details className="coverage-disclosure"><summary>Coverage <ChevronDown size={13}/></summary><div className="coverage-pop"><h3>Where this search looked</h3><p className="mono">Research snapshot {snapshot.id} · saved {dateTime(snapshot.createdAt)}</p><p>{attempted.length} housing sources attempted · {searched.length} searched across {organizations.size} organizations · {snapshot.homes.length} researched offers or leads · {merged} duplicate observations reconciled.</p><p className="muted">A floor plan or building lead may represent multiple units. These counts describe recorded research, not a percentage of the market or confirmed vacancies.</p>
          <div className="coverage-runs">{housingSources.map(source => { const sourceRuns = runsFor(source.id); const imported = new Set(sourceRuns.flatMap(run => run.importedHomeIds)); const pages = sourceRuns.reduce((sum, run) => sum + run.pagesFetched, 0); const observations = sourceRuns.reduce((sum, run) => sum + run.observations, 0); return <div key={source.id} className="coverage-run"><strong><a href={source.url} target="_blank" rel="noreferrer">{source.name}</a></strong><span className="mono">{sourceRuns.length ? `${sourceRuns.length} research ${sourceRuns.length === 1 ? 'run' : 'runs'} · ${pages} pages · ${observations} observations · ${imported.size} distinct imported records` : 'not searched in this run'}</span>{sourceRuns.map((run, index) => <div className="coverage-run-entry" key={`${source.id}-${index}`}><small>{run.status.replaceAll('_',' ')} · {dateTime(run.completedAt)}</small><p>{run.queryDescription || run.method}{run.bounds ? ` · ${run.bounds}` : ''}{run.error ? ` · ${run.error}` : ''}</p></div>)}{source.limitation && <p className="coverage-limit">Source limit: {source.limitation}</p>}</div>; })}</div>
          {gaps.length > 0 && <p className="coverage-gap">Not searched or unsuccessful here: {gaps.map(source => source.name).join(', ')}.</p>}{snapshot.researchScopes.flatMap(scope => scope.limitReasons).length > 0 && <p>Research limits: {snapshot.researchScopes.flatMap(scope => scope.limitReasons).join(' · ')}</p>}{supportingSources.length > 0 && <p>Supporting geographic data: {supportingSources.map(source => source.name).join(', ')}. These are separate from housing source coverage.</p>}
        </div></details>
      </div>
    </div>
  </div>;
}
