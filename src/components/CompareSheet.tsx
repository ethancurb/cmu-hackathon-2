import { ArrowUpRight, X } from 'lucide-react';
import type { Criteria, EvaluatedHome, Home, Snapshot } from '../domain/schema.js';
import { dollars, homeRoute, layout, minute, title, utilities, utilityFor, utilityState, wholeRentLabel } from '../lib/view.js';

type Item = { home: Home; result: EvaluatedHome | undefined };
type Props = { items: Item[]; snapshot: Snapshot; criteria: Criteria; onClose: () => void; onRemove: (id: string) => void };

export function CompareSheet({ items, snapshot, criteria, onClose, onRemove }: Props) {
  const rows: { label: string; value: (item: Item) => React.ReactNode }[] = [
    { label: 'Base rent', value: ({ home }) => wholeRentLabel(home) },
    { label: 'Your share', value: ({ result }) => result ? <>{dollars(result.cost.personalBaseRent)} <small>{result.cost.allocationLabel}</small></> : 'Unavailable in this snapshot' },
    { label: 'Known monthly costs', value: ({ result }) => result ? <>{dollars(result.cost.knownPersonalRecurring)} <small>{result.cost.unknownItems.length} unresolved cost items</small></> : 'Unknown' },
    { label: 'Layout', value: ({ home }) => layout(home) },
    ...utilities.map(u => ({ label: u.label, value: ({ home }: Item) => utilityState(utilityFor(home,u.key)) })),
    { label: `Walk to ${criteria.destination.label}`, value: ({ result }) => { const route = result && homeRoute(snapshot,result); return route?.status === 'ok' ? <>{minute(route.durationSeconds)} <small>{route.provider} · computed foot route</small></> : 'Unverified'; } },
    { label: 'Transit', value: ({ home }) => home.transit.length ? home.transit.slice(0,2).map(t => `Route ${t.routeShortName} · ${t.servesDestination ? 'serves destination' : 'nearby stop only'}`).join('; ') : 'No recorded context' },
    { label: 'Errands', value: ({ home }) => home.nearby.length ? home.nearby.slice(0,3).map(n => `${n.name} (${Math.round(n.distanceMeters)} m ${n.distanceBasis.replaceAll('_',' ')})`).join('; ') : 'No recorded context' },
    { label: 'Features', value: ({ home }) => home.amenities.length ? home.amenities.filter(a => a.fact.value === true).map(a => a.label).join('; ') || 'None confirmed' : 'No recorded context' },
    { label: 'Availability / lease', value: ({ home }) => `${home.availability.value ?? 'Availability unknown'} · ${home.leaseTerms.value ?? 'Lease terms unknown'}` },
    { label: 'Verify before touring', value: ({ result }) => result ? result.questions.slice(0,3).map(q => <div key={q.key} className="compare-question">{q.text}</div>) : 'Refresh this home’s evidence' },
    { label: 'Source', value: ({ home }) => <a href={home.primaryUrl} target="_blank" rel="noreferrer">Original listing <ArrowUpRight size={13}/></a> },
  ];
  return <div className="sheet-backdrop" onClick={onClose}><div className="compare-sheet" role="dialog" aria-modal="true" aria-label="Compare homes" onClick={e => e.stopPropagation()}><header className="compare-header"><div><span className="eyebrow">Side by side</span><h2>Compare homes</h2><p>Same facts in the same order. Unknowns stay visible.</p></div><button className="icon-button" onClick={onClose} aria-label="Close comparison"><X size={20}/></button></header><div className="compare-scroller"><table className="compare-table"><thead><tr><th scope="col">Fact</th>{items.map(({ home }, i) => <th scope="col" key={home.id}><span className="mono">{String(i+1).padStart(2,'0')}</span><strong>{title(home)}</strong><button className="text-button" onClick={() => onRemove(home.id)}>Remove</button></th>)}</tr></thead><tbody>{rows.map(row => <tr key={row.label}><th scope="row">{row.label}</th>{items.map(item => <td key={item.home.id}>{row.value(item)}</td>)}</tr>)}</tbody></table></div></div></div>;
}
