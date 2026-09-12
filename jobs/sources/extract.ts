import { load } from 'cheerio';
import type { Capture, EvidenceRow, ObservedFact } from './types.js';

export const clean = (value: string): string => value.replace(/\u00a0/g, ' ').replace(/\s+/g, ' ').trim();

export function moneyCents(value: string): number | null {
  const match = value.replace(/,/g, '').match(/\$\s*(\d+(?:\.\d{1,2})?)/);
  if (!match) return null;
  const amount = Number(match[1]);
  return Number.isSafeInteger(Math.round(amount * 100)) ? Math.round(amount * 100) : null;
}

export function dateValue(value: string): string | null {
  const match = clean(value).match(/\b(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})\b/);
  if (!match) return null;
  const [, month, day, year] = match;
  return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
}

export function evidenceFor(capture: Capture, scopeKey: string, scopeKind: EvidenceRow['scopeKind'], excerpt: string, locator: string, appliesToAllUnits = false): EvidenceRow {
  const id = `ev-${capture.sourceId}-${scopeKey.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}-${capture.captureHash.slice(0, 10)}-${Math.abs(hashCode(locator + excerpt))}`;
  return { id, sourceId: capture.sourceId, url: capture.url, observedAt: capture.fetchedAt, channel: 'page', captureHash: capture.captureHash, scopeKey, scopeKind, appliesToAllUnits, excerpt: clean(excerpt).slice(0, 600), locator };
}

function hashCode(value: string): number { let hash = 0; for (let i = 0; i < value.length; i++) hash = ((hash << 5) - hash + value.charCodeAt(i)) | 0; return hash; }

export function sourced<T>(value: T, evidenceIds: string[]): ObservedFact<T> { return { value, state: 'sourced', evidenceIds }; }
export function unknown<T>(): ObservedFact<T> { return { value: null, state: 'unknown', evidenceIds: [] }; }

export type FactProposal = { field: string; value: unknown; evidenceId: string; scopeKey: string };

/** Ensures an extracted value is supported by its evidence row and row scope. */
export function validateExtractedFact(proposal: FactProposal, captures: Array<Capture | EvidenceRow>): { accepted: boolean; reason: string | null } {
  const evidence = captures.find((item): item is EvidenceRow => 'scopeKey' in item && item.id === proposal.evidenceId);
  if (!evidence) return { accepted: false, reason: 'evidence_not_found' };
  if (evidence.scopeKey !== proposal.scopeKey) return { accepted: false, reason: 'scope_mismatch' };
  const excerpt = evidence.excerpt;
  if (proposal.field === 'availability' && typeof proposal.value === 'string') {
    const date = dateValue(proposal.value) ?? proposal.value;
    if (!excerpt.includes(date) && !excerpt.toLowerCase().includes(proposal.value.toLowerCase())) return { accepted: false, reason: 'value_not_in_evidence' };
  } else if (typeof proposal.value === 'string' && !excerpt.toLowerCase().includes(proposal.value.toLowerCase())) {
    return { accepted: false, reason: 'value_not_in_evidence' };
  } else if (typeof proposal.value === 'number') {
    const supported = proposal.field === 'rent' ? moneyCents(excerpt) === proposal.value : proposal.field === 'bedrooms' ? new RegExp(`\\b${proposal.value}\\s*Beds?\\b`, 'i').test(excerpt) : proposal.field === 'bathrooms' ? new RegExp(`\\b${proposal.value}\\s*Baths?\\b`, 'i').test(excerpt) : excerpt.includes(String(proposal.value));
    if (!supported) return { accepted: false, reason: 'value_not_in_evidence' };
  }
  return { accepted: true, reason: null };
}

export function elementText($: ReturnType<typeof load>, element: unknown): string { return clean($(element as never).text()); }
