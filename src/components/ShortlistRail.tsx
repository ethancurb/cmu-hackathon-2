import { ArrowUpRight, GitCompareArrows, X } from 'lucide-react';
import type { EvaluatedHome, Home } from '../domain/schema.js';
import { dollars, fitLabel, title } from '../lib/view.js';

type Props = { items: { home: Home; result?: EvaluatedHome }[]; compareCount: number; onCompare: () => void; onRemove: (id: string) => void; onSelect: (id: string) => void };
export function ShortlistRail({ items, compareCount, onCompare, onRemove, onSelect }: Props) {
  if (!items.length) return null;
  return <aside className="shortlist-rail" aria-label="Saved shortlist"><div className="shortlist-label"><span className="eyebrow">Ready to investigate</span><strong>{items.length} saved {items.length === 1 ? 'home' : 'homes'}</strong><button className="plain-button" disabled={compareCount < 2} onClick={onCompare}><GitCompareArrows size={15}/> Compare {compareCount || ''}</button></div><div className="shortlist-items">{items.map(({ home, result }) => <div className="shortlist-item" key={home.id}><button onClick={() => onSelect(home.id)}><strong>{title(home)}</strong><span>{result ? `${dollars(result.cost.personalBaseRent)} share · ${fitLabel(result)}` : 'Outside current snapshot'}</span><small>{result?.questions[0]?.text || 'Check current availability and costs'}</small></button><a href={home.primaryUrl} target="_blank" rel="noreferrer" aria-label={`Open listing for ${title(home)}`}><ArrowUpRight size={14}/></a><button className="icon-button" onClick={() => onRemove(home.id)} aria-label={`Remove ${title(home)} from shortlist`}><X size={15}/></button></div>)}</div></aside>;
}
