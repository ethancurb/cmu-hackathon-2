import { useState } from 'react';
import { ArrowRight } from 'lucide-react';
import type { Alternative, Criteria, Snapshot } from '../domain/schema.js';
import { dollars, title } from '../lib/view.js';

type Props = { alternatives: Alternative[]; criteria: Criteria; snapshot: Snapshot; onApply: (patch: Alternative['patch']) => void; onSelectHome: (id: string) => void };
const walkText = (seconds: number) => `${Math.floor(seconds / 60)}m ${Math.ceil(seconds % 60)}s`;
const valueText = (key: string, value: string | number) => key === 'personalRentCap' ? dollars(Number(value)) : key === 'maxWalkSeconds' ? walkText(Number(value)) : String(value);
const changeLabel = (key: string) => key === 'personalRentCap' ? 'Your monthly share cap' : key === 'maxWalkSeconds' ? 'Walking limit' : key === 'minBathrooms' ? 'Minimum bathrooms' : key === 'bedrooms' ? 'Bedrooms required' : key === 'propertyTypes' ? 'Property types' : key.replaceAll(/([A-Z])/g, ' $1').toLowerCase();
const changeDelta = (key: string, before: string | number, after: string | number) => {
  const difference = Number(after) - Number(before);
  if (!Number.isFinite(difference) || difference === 0) return '';
  if (key === 'personalRentCap') return ` (${difference > 0 ? '+' : '−'}${dollars(Math.abs(difference))}/month)`;
  if (key === 'maxWalkSeconds') return ` (${difference > 0 ? '+' : '−'}${walkText(Math.abs(difference))})`;
  return '';
};
const label = (alternative: Alternative) => alternative.changed.length === 1 ? (() => { const change = alternative.changed[0]; return change.key === 'personalRentCap' ? `Raise your share cap to ${dollars(Number(change.after))}` : change.key === 'maxWalkSeconds' ? `Allow ${walkText(Number(change.after))} walk` : change.key === 'minBathrooms' ? `Allow ${change.after}+ baths` : alternative.label; })() : alternative.label;
const shortLabel = (alternative: Alternative) => alternative.changed.length === 1 ? (() => { const change = alternative.changed[0]; return change.key === 'personalRentCap' ? `Raise cap to ${dollars(Number(change.after))}` : change.key === 'maxWalkSeconds' ? `Allow ${walkText(Number(change.after))} walk` : change.key === 'minBathrooms' ? `Allow ${change.after}+ baths` : alternative.label; })() : alternative.label;

export function Alternatives({ alternatives, criteria, snapshot, onApply, onSelectHome }: Props) {
  const [preview, setPreview] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);
  if (!alternatives.length) return null;
  const homes = new Map(snapshot.homes.map(home => [home.id, home]));
  return <section className={`alternatives ${showAll ? 'expanded' : ''}`}><div className="alternatives-heading"><span className="eyebrow">One change unlocks more</span><span>Calculated from options already found</span></div><div className="alternative-list">{(showAll ? alternatives : alternatives.slice(0,1)).map(alt => <div className="alternative" key={alt.id}><button className="alternative-trigger" onClick={() => setPreview(preview === alt.id ? null : alt.id)} aria-expanded={preview === alt.id}><span><strong className="alternative-label-desktop">{label(alt)}</strong><strong className="alternative-label-mobile">{shortLabel(alt)}</strong><small>{alt.newlyMatchedIds.length} newly eligible {alt.newlyMatchedIds.length === 1 ? 'option' : 'options'}</small></span><ArrowRight size={15}/></button>{preview === alt.id && <div className="alternative-preview"><p>{alt.changed.map(change => <span key={change.key}><b>{changeLabel(change.key)}:</b> {valueText(change.key, change.before)} → {valueText(change.key, change.after)}{changeDelta(change.key, change.before, change.after)}. </span>)}The original search remains available with Revert.</p><div className="alternative-eligible"><strong>Would meet your requirements</strong>{alt.newlyMatchedIds.map(id => { const home = homes.get(id); return home && <button type="button" key={id} onClick={() => { onSelectHome(id); setPreview(null); }}>{title(home)} <ArrowRight size={12}/></button>; })}</div><button className="plain-button primary-button" onClick={() => { onApply(alt.patch); setPreview(null); }}>Apply this change</button></div>}</div>)}</div>{alternatives.length > 1 && <button className="alternative-more" onClick={() => setShowAll(value => !value)}>{showAll ? 'Show first' : `${alternatives.length - 1} more changes`}</button>}</section>;
}
