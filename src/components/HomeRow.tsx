import { ArrowUpRight, Bookmark, GitCompareArrows } from 'lucide-react';
import type { Criteria, EvaluatedHome, Home, NicheAssessment, Snapshot } from '../domain/schema.js';
import { decisionReason, destinationName, dollars, homeRoute, layout, minute, shortDate, title, utilities, utilityFor, utilityState, wholeRentLabel } from '../lib/view.js';

type Props = { snapshot: Snapshot; criteria: Criteria; home: Home; result: EvaluatedHome; number: number; selected: boolean; saved: boolean; comparing: boolean; onSelect: () => void; onSave: () => void; onCompare: () => void; onHover: (hovered: boolean) => void; niche?: NicheAssessment };

export function HomeRow({ snapshot, criteria, home, result, number, selected, saved, comparing, onSelect, onSave, onCompare, onHover, niche }: Props) {
  const route = homeRoute(snapshot, result);
  const source = snapshot.sources.find(s => {
    try { return new URL(home.primaryUrl).host === new URL(s.url).host; } catch { return false; }
  });
  const share = result.cost.personalBaseRent;
  const states = utilities.map(u => ({ ...u, state: utilityState(utilityFor(home,u.key)) }));
  const included = states.filter(u => u.state === 'included');
  const separate = states.filter(u => u.state === 'separate');
  const partial = states.filter(u => u.state === 'partly covered');
  const unknown = states.filter(u => u.state === 'not stated' || u.state === 'conflicting');
  const heatIncluded = included.some(u => u.key === 'other' && /\bheat\b/i.test(utilityFor(home, 'other')?.terms.value || ''));
  const utilityText = [heatIncluded ? 'Heat included' : '', included.length - Number(heatIncluded) ? (included.length - Number(heatIncluded) === 1 ? `${included.find(u => !heatIncluded || u.key !== 'other')?.short} included` : `${included.length - Number(heatIncluded)} utilities included`) : '', separate.length ? `${separate.length} separately billed` : '', partial.length ? `${partial.length} partly covered` : '', unknown.length ? `${unknown.length} not stated` : ''].filter(Boolean).join(' · ');
  return <article className={`home-row ${selected ? 'is-selected' : ''}`} id={`home-${home.id}`} onMouseEnter={() => onHover(true)} onMouseLeave={() => onHover(false)}>
    <button type="button" className="row-main" onClick={onSelect} aria-label={`Open ${title(home)} details`} aria-expanded={selected}>
      <span className="row-number" aria-hidden="true">{String(number).padStart(2, '0')}</span>
      <span className="row-identity">
        {home.photo && <span className="row-photo-wrap"><img src={home.photo.url} alt={home.photo.alt || 'Property photo from original listing'} className="row-photo" loading="lazy" onError={event => { event.currentTarget.parentElement!.style.display = 'none'; }}/><small>Property photo</small></span>}
        <span className="row-identity-copy"><strong className="row-address" title={title(home)}>{title(home)}</strong><span className="row-property">{home.scope === 'floor_plan' ? 'Floor plan' : home.scope === 'building' ? 'Building lead' : home.scope === 'room' ? 'Room' : 'Unit'} <span className="dot-separator">·</span> {home.propertyType.value ? home.propertyType.value[0].toUpperCase() + home.propertyType.value.slice(1) : 'Type unknown'} <span className="dot-separator">·</span> {layout(home)}{home.unitLabel.value ? ` · ${home.unitLabel.value}` : ''}</span></span>
      </span>
      <span className="row-cost">
        {share == null && <span className="row-quote-label">{home.rent.basis === 'whole_unit' ? 'Whole-home quote' : home.rent.basis === 'per_room' ? 'Per-room quote' : 'Advertised quote'} · share unknown</span>}
        <strong className="row-price">{share == null ? wholeRentLabel(home).split(' · ')[0] : dollars(share)}<small>{share == null ? '' : ' / mo'}</small></strong>
        <span className="row-cost-note">{share == null ? wholeRentLabel(home) : `${wholeRentLabel(home)} · computed ${criteria.allocation.kind === 'equal' ? `${criteria.allocation.occupants} equal shares` : 'custom share'}`}</span>
      </span>
      <span className="row-walk">
        <strong className={route?.status === 'ok' ? 'route-color' : ''}>{route?.status === 'ok' ? minute(route.durationSeconds) : 'Unknown'}</strong>
        <span>{home.coordinate.value ? `walk to ${destinationName(criteria)}` : 'location not mapped'}</span>
      </span>
    </button>
    <div className="row-evidence">{niche && <span className={`niche-badge niche-tier-${niche.provenance}`} title={niche.reason}>Grok suggestion{niche.confidence === 'partial' ? ' · partial' : ''}</span>}<span className="utility-segments" role="img" aria-label={states.map(u => `${u.label}: ${u.state}`).join('; ')}>{states.map(u => <i key={u.key} className={`segment segment-${u.state.replaceAll(' ','-')}`} title={`${u.label}: ${u.state}`}/>)}</span><span className="utility-summary">{utilityText}</span>{result.cost.unknownItems.length > 0 && <span className="row-cost-unknown">Costs to verify</span>}{home.listingStatus !== 'observed' && <span className="row-status">{home.listingStatus === 'stale' ? 'Not seen in latest source check' : home.listingStatus === 'historical' ? 'Historical record' : 'Reported off market'}</span>}<span className="row-source mono">{source?.name ?? 'Source link'} · checked {shortDate(home.lastObservedAt)}</span></div>
    {result.fit !== 'matches' && <div className="row-reason">{decisionReason(result, criteria)}</div>}
    <div className="row-actions">
      <button type="button" className={`action-button ${saved ? 'active' : ''}`} onClick={onSave} aria-pressed={saved} aria-label={`${saved ? 'Remove' : 'Add'} ${title(home)} ${saved ? 'from' : 'to'} shortlist`}><Bookmark size={15} fill={saved ? 'currentColor' : 'none'} /> {saved ? 'Saved' : 'Shortlist'}</button>
      <button type="button" className={`action-button ${comparing ? 'active' : ''}`} onClick={onCompare} aria-pressed={comparing} aria-label={`${comparing ? 'Remove' : 'Add'} ${title(home)} ${comparing ? 'from' : 'to'} comparison`}><GitCompareArrows size={15} /> Compare</button>
      <a className="row-link" href={home.primaryUrl} target="_blank" rel="noreferrer" aria-label={`Open original listing for ${title(home)}`}>Listing <ArrowUpRight size={14}/></a>
    </div>
  </article>;
}
