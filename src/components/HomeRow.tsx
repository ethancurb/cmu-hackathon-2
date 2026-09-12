import { ArrowUpRight, Bookmark, GitCompareArrows } from 'lucide-react';
import type { Criteria, EvaluatedHome, Home, Snapshot } from '../domain/schema.js';
import { constraintSummary, dollars, fitLabel, homeRoute, layout, minute, shortDate, title, utilities, utilityFor, utilityState, wholeRentLabel } from '../lib/view.js';

type Props = { snapshot: Snapshot; criteria: Criteria; home: Home; result: EvaluatedHome; number: number; selected: boolean; saved: boolean; comparing: boolean; onSelect: () => void; onSave: () => void; onCompare: () => void; onHover: (hovered: boolean) => void };

export function HomeRow({ snapshot, criteria, home, result, number, selected, saved, comparing, onSelect, onSave, onCompare, onHover }: Props) {
  const route = homeRoute(snapshot, result);
  const source = snapshot.sources.find(s => {
    try { return new URL(home.primaryUrl).host === new URL(s.url).host; } catch { return false; }
  });
  const share = result.cost.personalBaseRent;
  return <article className={`home-row ${selected ? 'is-selected' : ''}`} id={`home-${home.id}`} onMouseEnter={() => onHover(true)} onMouseLeave={() => onHover(false)}>
    <button type="button" className="row-main" onClick={onSelect} aria-label={`Open ${title(home)} details`} aria-expanded={selected}>
      <span className="row-number" aria-hidden="true">{String(number).padStart(2, '0')}</span>
      <span className="row-identity">
        <strong className="row-address">{title(home)}</strong>
        <span className="row-property">{home.propertyType.value ? home.propertyType.value[0].toUpperCase() + home.propertyType.value.slice(1) : 'Type unknown'} <span className="dot-separator">·</span> {layout(home)}{home.unitLabel.value ? ` · ${home.unitLabel.value}` : ''}</span>
      </span>
      <span className="row-cost">
        <strong className="row-price">{share == null ? wholeRentLabel(home).split(' · ')[0] : dollars(share)}<small>{share == null ? '' : ' / mo'}</small></strong>
        <span className="row-cost-note">{share == null ? wholeRentLabel(home) : `${wholeRentLabel(home)} · computed ${criteria.allocation.kind === 'equal' ? `${criteria.allocation.occupants} equal shares` : 'custom share'}`}</span>
      </span>
      <span className="row-walk">
        <strong className={route?.status === 'ok' ? 'route-color' : ''}>{route?.status === 'ok' ? minute(route.durationSeconds) : 'Unknown'}</strong>
        <span>walk to {criteria.destination.label}</span>
      </span>
    </button>
    <div className="row-evidence">
      <div className="utility-line" aria-label="Utility inclusion">
        {utilities.map(({ key, short }) => <span key={key} className={`utility-pill utility-${utilityState(utilityFor(home,key)).replaceAll(' ','-')}`} title={`${short}: ${utilityState(utilityFor(home,key))}`}><span className="utility-name">{short}</span><b>{utilityState(utilityFor(home,key))}</b></span>)}
      </div>
      <div className="row-meta">
        <span className={`fit-status ${result.fit}`}>{fitLabel(result)}</span>
        <span className="row-consequence">{result.fit === 'matches' ? (result.cost.unknownItems.length ? `${result.cost.unknownItems.length} additional cost ${result.cost.unknownItems.length === 1 ? 'item' : 'items'} unresolved` : 'Known monthly costs shown in detail') : constraintSummary(result) || 'Some evidence remains unknown'}</span>
        <span className="row-source mono">{source?.name ?? 'Source link'} · checked {shortDate(home.lastObservedAt)}</span>
      </div>
    </div>
    <div className="row-actions">
      <button type="button" className={`action-button ${saved ? 'active' : ''}`} onClick={onSave} aria-pressed={saved} aria-label={`${saved ? 'Remove' : 'Add'} ${title(home)} ${saved ? 'from' : 'to'} shortlist`}><Bookmark size={15} fill={saved ? 'currentColor' : 'none'} /> {saved ? 'Saved' : 'Shortlist'}</button>
      <button type="button" className={`action-button ${comparing ? 'active' : ''}`} onClick={onCompare} aria-pressed={comparing} aria-label={`${comparing ? 'Remove' : 'Add'} ${title(home)} ${comparing ? 'from' : 'to'} comparison`}><GitCompareArrows size={15} /> Compare</button>
      <a className="row-link" href={home.primaryUrl} target="_blank" rel="noreferrer" aria-label={`Open original listing for ${title(home)}`}>Listing <ArrowUpRight size={14}/></a>
    </div>
  </article>;
}
