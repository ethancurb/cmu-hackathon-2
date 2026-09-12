import { useState } from 'react';
import { ArrowRight, Sparkles, X } from 'lucide-react';
import type { Criteria, Snapshot } from '../domain/schema.js';
import { NICHE_TOLERANCE, type RankedNicheHome } from '../domain/niche.js';
import { decisionReason, dollars, homeRoute, minute, title } from '../lib/view.js';

type Props = {
  query: string;
  ranked: RankedNicheHome[];
  snapshot: Snapshot;
  criteria: Criteria;
  busy: boolean;
  degraded: string | null;
  homesWithoutData: number;
  selectedId: string | null;
  onSelect: (id: string) => void;
  onCancel: () => void;
  onClear: () => void;
  onRetry: () => void;
  onHover: (id: string | null) => void;
};

export function NicheGroup({ query, ranked, snapshot, criteria, busy, degraded, homesWithoutData, selectedId, onSelect, onCancel, onClear, onRetry, onHover }: Props) {
  const [expanded, setExpanded] = useState(false);
  const homes = new Map(snapshot.homes.map(home => [home.id, home]));
  const shown = expanded ? ranked : ranked.slice(0, 3);
  return <section className="niche-group" aria-label={`Grok suggestions for: ${query}`} aria-busy={busy}>
    <div className="niche-heading">
      <span className="niche-title"><Sparkles size={14}/><span className="eyebrow">Grok suggestions</span></span>
      <div className="niche-status">{busy
        ? <button className="plain-button niche-cancel" onClick={onCancel}>Cancel</button>
        : <button className="niche-clear" onClick={onClear} aria-label="Clear this request"><X size={13}/> Clear</button>}
      </div>
    </div>
    <h2 className="niche-query">“{query}”</h2>
    {busy ? <p className="niche-note niche-progress" role="status"><span className="pulse-dot"/> Checking saved listing and nearby-place evidence…</p>
      : degraded ? <div className="niche-note"><p>{degraded}</p><button className="plain-button" onClick={onRetry}>Try again</button></div>
      : <>
        <p className="niche-summary">{ranked.length > 0 ? `${ranked.length} possible ${ranked.length === 1 ? 'fit' : 'fits'} · smallest compromises first.` : 'No suggestions within this comparison range.'} Your filters are unchanged.</p>
        {ranked.length === 0 && <p className="niche-note">The saved evidence may not cover this request. Try a different feature or place with Ask Grok; all researched homes remain below.</p>}
        {shown.map(({ homeId, assessment, result }) => {
          const home = homes.get(homeId);
          if (!home) return null;
          const share = result.cost.personalBaseRent;
          const route = homeRoute(snapshot, result);
          const misses = decisionReason(result, criteria);
          return <button type="button" key={homeId} className={`niche-row ${selectedId === homeId ? 'is-selected' : ''}`} onClick={() => onSelect(homeId)}
            onMouseEnter={() => onHover(homeId)} onMouseLeave={() => onHover(null)} aria-label={`Open ${title(home)} details`} aria-describedby={`niche-facts-${homeId} niche-fit-${homeId} niche-verdict-${homeId}`}>
            <span className="niche-row-main"><strong>{title(home)}</strong><span id={`niche-facts-${homeId}`} className="niche-row-facts">{share == null ? 'Rent share unknown' : `${dollars(share)}/mo for your share`} · {route?.status === 'ok' ? `${minute(route.durationSeconds)} walk` : 'Walk unknown'}</span></span>
            <span id={`niche-fit-${homeId}`} className="niche-row-fit">{result.fit === 'matches' ? <span className="niche-fit-ok">Meets stated requirements</span> : <span className="niche-fit-miss">{misses || 'Needs verification'}</span>}</span>
            <span id={`niche-verdict-${homeId}`} className="niche-row-verdict"><span className="niche-reason">{assessment.reason}</span><span className="niche-tags"><span className={`niche-tier niche-tier-${assessment.provenance}`}>{assessment.provenance === 'listing_data' ? 'Saved evidence · Grok interpretation' : 'Grok interpretation · verify'}</span>{assessment.confidence === 'partial' && <span className="niche-partial">Partial preference match</span>}</span>{assessment.mitigates && <span className="niche-mitigation">Possible trade-off: {assessment.mitigates.reason}</span>}</span>
            <ArrowRight size={15} className="niche-row-arrow"/>
          </button>;
        })}
        {ranked.length > 3 && <button className="niche-expand" onClick={() => setExpanded(value => !value)} aria-expanded={expanded}>{expanded ? 'Show fewer suggestions' : `Show all ${ranked.length} suggestions`}</button>}
      </>}
    {!busy && <details className="niche-method"><summary>How suggestions are selected</summary><p>Grok interprets the saved evidence. A suggestion can be up to {Math.round(NICHE_TOLERANCE.relative.personal_rent * 100)}% over your rent cap, {Math.round(NICHE_TOLERANCE.relative.walk * 100)}% over your walking limit, or {NICHE_TOLERANCE.absolute.bathrooms} bathroom below your minimum. Other known requirement failures stay out of this group; missing facts remain unverified. These bounds only select suggestions and do not change your requirements.</p>{homesWithoutData > 0 && <p>{homesWithoutData} homes lack enough saved amenity, nearby-place, transit, or location detail for this request.</p>}<p>All {snapshot.homes.length} researched homes remain in the main list, with their original fit and source evidence.</p></details>}
  </section>;
}
