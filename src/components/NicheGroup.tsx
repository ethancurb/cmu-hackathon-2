import { ArrowRight, Sparkles, X } from 'lucide-react';
import type { Criteria, Snapshot } from '../domain/schema.js';
import type { RankedNicheHome } from '../domain/niche.js';
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
  onHover: (id: string | null) => void;
};

/**
 * The highlighted group above the ordinary results: homes the model judged to satisfy the
 * renter's plain-language request, ordered by how close they come to the core requirements.
 * Purely additive — every home here also keeps its normal place in the list below, and a
 * core miss stays a visible core miss.
 */
export function NicheGroup({ query, ranked, snapshot, criteria, busy, degraded, homesWithoutData, selectedId, onSelect, onCancel, onClear, onHover }: Props) {
  const homes = new Map(snapshot.homes.map(home => [home.id, home]));
  return <section className="niche-group" aria-label={`Homes matching your request: ${query}`}>
    <div className="niche-heading">
      <span className="niche-title"><Sparkles size={14}/> <span className="eyebrow">Your request</span> <strong>“{query}”</strong></span>
      {busy
        ? <span className="niche-status"><span className="pulse-dot"/> Asking Grok…<button className="plain-button niche-cancel" onClick={onCancel}>Cancel</button></span>
        : <span className="niche-status">{!degraded && <span className="mono">{ranked.length} {ranked.length === 1 ? 'match' : 'matches'} · nearest to your requirements first</span>}<button className="icon-button" onClick={onClear} aria-label="Clear this request"><X size={14}/></button></span>}
    </div>
    {!busy && degraded && <p className="niche-note">{degraded}</p>}
    {!busy && !degraded && ranked.length === 0 && <p className="niche-note">Nothing in this snapshot matched the request within a small distance of your requirements. Options outside that band remain in the list below with their exact deviations.</p>}
    {!busy && !degraded && ranked.map(({ homeId, assessment, result }) => {
      const home = homes.get(homeId);
      if (!home) return null;
      const share = result.cost.personalBaseRent;
      const route = homeRoute(snapshot, result);
      const misses = decisionReason(result, criteria);
      return <button type="button" key={homeId} className={`niche-row ${selectedId === homeId ? 'is-selected' : ''}`} onClick={() => onSelect(homeId)}
        onMouseEnter={() => onHover(homeId)} onMouseLeave={() => onHover(null)} aria-label={`Open ${title(home)} details`}>
        <span className="niche-row-main">
          <strong>{title(home)}</strong>
          <span className="niche-row-facts mono">{share == null ? 'share unknown' : `${dollars(share)}/mo`} · {route?.status === 'ok' ? `${minute(route.durationSeconds)} walk` : 'walk unknown'}</span>
        </span>
        <span className="niche-row-verdict">
          <span className="niche-reason">{assessment.reason}</span>
          <span className="niche-tags">
            <span className={`niche-tier niche-tier-${assessment.provenance}`}>{assessment.provenance === 'listing_data' ? 'Saved evidence · Grok interpretation' : 'Grok interpretation · verify'}</span>
            {assessment.confidence === 'partial' && <span className="niche-partial">Close, not exact</span>}
          </span>
        </span>
        <span className="niche-row-fit">
          {result.fit === 'matches'
            ? <span className="niche-fit-ok">Meets stated requirements</span>
            : <span className="niche-fit-miss">{misses || 'Needs verification'}</span>}
          {assessment.mitigates && <span className="niche-mitigation">May offset the {assessment.mitigates.constraintKey.replaceAll('_', ' ')} gap: {assessment.mitigates.reason}</span>}
        </span>
        <ArrowRight size={15} className="niche-row-arrow"/>
      </button>;
    })}
    {!busy && !degraded && homesWithoutData > 0 && <p className="niche-footnote">{homesWithoutData} {homesWithoutData === 1 ? 'home carries' : 'homes carry'} no nearby, transit, amenity, or location detail to judge this request against; they are not counted either way.</p>}
    {!busy && <p className="niche-footnote">Assessments interpret saved snapshot data{degraded ? '' : ' and are labelled with what they rest on'}. Your stated requirements are never relaxed by a match here.</p>}
  </section>;
}
