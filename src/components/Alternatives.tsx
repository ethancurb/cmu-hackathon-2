import { useState } from 'react';
import { ArrowRight } from 'lucide-react';
import type { Alternative, Criteria } from '../domain/schema.js';
import { dollars } from '../lib/view.js';

type Props = { alternatives: Alternative[]; criteria: Criteria; onApply: (patch: Alternative['patch']) => void };
const valueText = (key: string, value: string | number) => key === 'personalRentCap' ? dollars(Number(value)) : key === 'maxWalkSeconds' ? `${Number(value) / 60} min` : String(value);

export function Alternatives({ alternatives, criteria, onApply }: Props) {
  const [preview, setPreview] = useState<string | null>(null);
  if (!alternatives.length) return null;
  return <section className="alternatives"><div className="alternatives-heading"><div><span className="eyebrow">Explore one change</span><h3>What would open up?</h3></div><span className="muted">Calculated from homes already found</span></div><div className="alternative-list">{alternatives.map(alt => <div className="alternative" key={alt.id}><button className="alternative-trigger" onClick={() => setPreview(preview === alt.id ? null : alt.id)} aria-expanded={preview === alt.id}><span><strong>{alt.label}</strong><small>{alt.newlyMatchedIds.length} newly eligible {alt.newlyMatchedIds.length === 1 ? 'home' : 'homes'}</small></span><ArrowRight size={17}/></button>{preview === alt.id && <div className="alternative-preview"><p>{alt.changed.map(change => <span key={change.key}><b>{change.key.replaceAll('_',' ')}:</b> {valueText(change.key, change.before)} → {valueText(change.key, change.after)}. </span>)}Original search remains available with Revert.</p><p>Newly eligible home IDs: <span className="mono">{alt.newlyMatchedIds.join(', ')}</span></p><button className="plain-button primary-button" onClick={() => { onApply(alt.patch); setPreview(null); }}>Apply this change</button></div>}</div>)}</div></section>;
}
