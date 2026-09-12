import { load } from 'cheerio';
import type { Capture, ObservedListing, ParseResult } from './types.js';
import { clean, dateValue, evidenceFor, moneyCents, sourced, unknown } from './extract.js';

export function parseReinhold(capture: Capture): ParseResult {
  const $ = load(capture.html); const listings: ObservedListing[] = []; const warnings: string[] = [];
  const property = clean($('h1,h2').filter((_, x) => /Shadyside Commons/i.test($(x).text())).first().text()) || 'Shadyside Commons';
  const address = clean($('body').text()).match(/\b\d+\s+Amberson\s+Avenue\s+Pittsburgh,\s+PA\s+\d{5}\b/i)?.[0] ?? '401 Amberson Avenue, Pittsburgh, PA 15232';
  $('.rr-unit-block').each((index, block) => {
    const row = $(block).find('.rr-unit').first(); const cells = row.find('.rr-price-column').map((_, x) => clean($(x).text())).get();
    const type = cells[0] ?? ''; const unit = cells[1] ?? ''; const rentText = cells[2] ?? ''; const availRaw = cells[3] ?? '';
    if (!unit || !type) { warnings.push(`Skipped Reinhold availability block ${index}: missing unit or layout`); return; }
    const scopeKey = `reinhold-${unit}`; const beds = type.match(/(\d+)\s*Bed/i)?.[1]; const bath = type.match(/(\d+(?:\.5)?)\s*Bath/i)?.[1]; const amount = moneyCents(rentText);
    const rowExcerpt = `${property}; ${address}; ${type}; ${unit}; ${rentText}; ${availRaw}`;
    const rowEvidence = evidenceFor(capture, scopeKey, 'offer', rowExcerpt, `.rr-unit-block:nth-of-type(${index + 1}) .rr-unit`);
    const buildingEvidence = evidenceFor(capture, `reinhold-building-shadyside-commons`, 'building', `${property}; ${address}`, 'property header', true);
    listings.push({
      id: `reinhold-${unit}`, sourceId: capture.sourceId, sourceFamily: 'direct-manager', url: capture.url, scope: 'unit', buildingKey: buildingEvidence.scopeKey, offerKey: scopeKey, floorPlanKey: `reinhold-plan-${unit}`,
      scopeKey, title: sourced(`${property} · ${type}`, [rowEvidence.id]), address: sourced(address, [buildingEvidence.id]), unitLabel: sourced(unit, [rowEvidence.id]), propertyType: sourced('apartment', [buildingEvidence.id]),
      bedrooms: beds ? sourced(Number(beds), [rowEvidence.id]) : unknown(), bathrooms: bath ? sourced(Number(bath), [rowEvidence.id]) : unknown(), fullBaths: unknown(), halfBaths: unknown(),
      rent: { basis: 'whole_unit', period: 'month', amount: amount === null ? unknown() : sourced(amount, [rowEvidence.id]), upperAmount: unknown(), kind: amount === null ? 'unknown' : 'exact', semantics: 'base_rent' }, availability: dateValue(availRaw) ? sourced(dateValue(availRaw)!, [rowEvidence.id]) : unknown(), utilities: [], amenities: [], evidence: [rowEvidence, buildingEvidence],
    });
  });
  if (!listings.length) warnings.push('Reinhold parser found no .rr-unit-block rows');
  return { listings, captures: [capture], warnings };
}

/** A generic direct-manager hook. It requires explicit row selectors to prevent cross-unit joins. */
export function parseManagerPage(capture: Capture, selectors: { row: string; title: string; address: string; rent: string; availability: string; beds: string; baths: string }): ParseResult {
  const $ = load(capture.html); const listings: ObservedListing[] = []; const warnings: string[] = [];
  $(selectors.row).each((index, node) => {
    const row = $(node); const title = clean(row.find(selectors.title).text()); const address = clean(row.find(selectors.address).text());
    const rentText = clean(row.find(selectors.rent).text()); const available = clean(row.find(selectors.availability).text()); const beds = row.find(selectors.beds).text().match(/(\d+)/)?.[1]; const baths = row.find(selectors.baths).text().match(/(\d+(?:\.5)?)/)?.[1];
    if (!title || !address) { warnings.push(`Skipped generic manager row ${index}: missing title/address`); return; }
    const scopeKey = `manager-row-${index + 1}`; const ev = evidenceFor(capture, scopeKey, 'offer', `${title}; ${address}; ${rentText}; ${available}`, `${selectors.row}:nth-of-type(${index + 1})`); const amount = moneyCents(rentText);
    listings.push({ id: `${capture.sourceId}-${index + 1}`, sourceId: capture.sourceId, sourceFamily: 'direct-manager', url: capture.url, scope: 'floor_plan', buildingKey: scopeKey, offerKey: scopeKey, floorPlanKey: scopeKey, scopeKey, title: sourced(title, [ev.id]), address: sourced(address, [ev.id]), unitLabel: unknown(), propertyType: sourced('apartment', [ev.id]), bedrooms: beds ? sourced(Number(beds), [ev.id]) : unknown(), bathrooms: baths ? sourced(Number(baths), [ev.id]) : unknown(), fullBaths: unknown(), halfBaths: unknown(), rent: { basis: 'unknown', period: 'month', amount: amount === null ? unknown() : sourced(amount, [ev.id]), upperAmount: unknown(), kind: amount === null ? 'unknown' : 'from', semantics: 'advertised_unspecified' }, availability: available ? sourced(dateValue(available) ?? available, [ev.id]) : unknown(), utilities: [], amenities: [], evidence: [ev] });
  });
  return { listings, captures: [capture], warnings };
}
