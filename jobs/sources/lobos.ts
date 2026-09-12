import { load } from 'cheerio';
import type { Capture, ObservedListing, ParseResult } from './types.js';
import { clean, dateValue, evidenceFor, moneyCents, sourced, unknown } from './extract.js';

function numberFrom(value: string, pattern: RegExp): number | null { const m = clean(value).match(pattern); return m ? Number(m[1]) : null; }

export function parseLobos(capture: Capture): ParseResult {
  const $ = load(capture.html); const listings: ObservedListing[] = []; const warnings: string[] = [];
  $('.jet-engine-listing-overlay-wrap').each((index, node) => {
    const card = $(node); const link = card.find('a[href*="/units/"]').first().attr('href');
    const name = clean(card.find('h4').first().text()); const address = clean(card.find('.elementor-heading-title').filter((_, x) => /\bPA\s*\d{5}\b/i.test($(x).text())).first().text()) || clean(card.text()).match(/\b(\d{1,6}[^$]+?PA\s*\d{5})\b/i)?.[1] || '';
    const cardText = clean(card.text()); const bed = numberFrom(cardText, /(\d+)\s*Beds?/i); const bath = numberFrom(cardText, /(\d+(?:\.5)?)\s*Baths?/i);
    const rentMatch = cardText.match(/From\s+(\$[\d,]+(?:\.\d{2})?)/i); const amount = rentMatch ? moneyCents(rentMatch[1]) : null;
    const availRaw = cardText.match(/Availability:\s*([^$]+?)(?=\s*$|\s*From\s|$)/i)?.[1] ?? cardText.match(/Availability:\s*(Available Now|\d{1,2}\/\d{1,2}\/\d{4})/i)?.[1] ?? '';
    if (!name || !address || !link) { warnings.push(`Skipped Lobos card ${index}: missing title/address/unit URL`); return; }
    const normalizedUrl = new URL(link, capture.url).href; const unitSlug = normalizedUrl.split('/').filter(Boolean).pop() ?? String(index + 1); const scopeKey = `lobos-${unitSlug}`;
    const context = `${name} ${address} ${bed ? `${bed} Beds` : ''} ${bath ? `${bath} Baths` : ''} ${rentMatch?.[0] ?? ''} Availability: ${availRaw}`;
    const ev = evidenceFor(capture, scopeKey, 'offer', context, `.jet-engine-listing-overlay-wrap a[href*="${unitSlug}"]`);
    const titleEv = evidenceFor(capture, `lobos-building-${name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`, 'building', `${name} ${address}`, '.jet-engine-listing-overlay-wrap h4', true);
    const availability = dateValue(availRaw) ?? (clean(availRaw) || null);
    listings.push({
      id: `lobos-${unitSlug}`, sourceId: capture.sourceId, sourceFamily: 'lobos-management', url: normalizedUrl, scope: 'unit',
      buildingKey: titleEv.scopeKey, offerKey: scopeKey, floorPlanKey: null, scopeKey,
      title: sourced(name, [titleEv.id]), address: sourced(address, [titleEv.id]), unitLabel: sourced(unitSlug, [ev.id]), propertyType: sourced('apartment', [titleEv.id]),
      bedrooms: bed === null ? unknown() : sourced(bed, [ev.id]), bathrooms: bath === null ? unknown() : sourced(bath, [ev.id]), fullBaths: unknown(), halfBaths: unknown(),
      rent: { basis: 'unknown', period: 'month', amount: amount === null ? unknown() : sourced(amount, [ev.id]), upperAmount: unknown(), kind: amount === null ? 'unknown' : 'from', semantics: 'base_rent' },
      availability: availability ? sourced(availability, [ev.id]) : unknown(), utilities: [], amenities: [], evidence: [ev, titleEv],
    });
  });
  if (!listings.length) warnings.push('Lobos parser found no listing cards');
  return { listings, captures: [capture], warnings };
}

/** Parse a Lobos unit-detail page when the URL is a direct, public unit page. */
export function parseLobosDetail(capture: Capture): ParseResult {
  const $ = load(capture.html); const text = clean($('body').text()); const warnings: string[] = [];
  const title = clean($('h2').filter((_, x) => /unit|about this/i.test($(x).text()) === false).first().text()) || 'Lobos unit';
  const layout = text.match(/(\d+)\s*Beds?\s*[•·]\s*(\d+(?:\.5)?)\s*Baths?/i); const rentMatch = text.match(/\$(\d[\d,]*)\s*\/month/i); const amount = rentMatch ? moneyCents(rentMatch[0]) : null;
  const addressFirst = text.match(/\/month\s+(\d{1,6}\s+[^,]+?)(?:\s*APT\.?\s*([A-Z0-9-]+))?,\s*(PITTSBURGH,\s*PA\s*\d{5})/i);
  const unitAndAddress = text.match(/\/month\s+([A-Za-z0-9-]+)\s+([A-Z0-9][^\n]+?\bPA\s*\d{5})/i);
  const unit = addressFirst?.[2] ?? unitAndAddress?.[1] ?? null;
  const address = addressFirst ? `${addressFirst[1].trim()}, ${addressFirst[3].trim()}` : unitAndAddress?.[2]?.trim() ?? '';
  const availabilityRaw = text.match(/Availability:\s*([^\dA-Z]*Available\s*Now|\d{1,2}\/\d{1,2}\/\d{4})/i)?.[1] ?? text.match(/Availability:\s*(Available Now)/i)?.[1] ?? '';
  if (!layout || amount === null || !address) warnings.push('Lobos detail page did not expose a complete unit row; unknown fields retained');
  const pageSlug = capture.url.split('/').filter(Boolean).pop() ?? 'unknown';
  const detailSlug = pageSlug.toLowerCase().replace(/[^a-z0-9]+/g, '-');
  const buildingSlug = `${title}-${address}`.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || detailSlug;
  const scopeKey = `lobos-detail-${detailSlug}`;
  const buildingKey = `lobos-building-${buildingSlug}`;
  const ev = evidenceFor(capture, scopeKey, 'offer', `${title}; ${unit ?? ''}; ${address}; ${layout?.[0] ?? ''}; ${rentMatch?.[0] ?? ''}; Availability: ${availabilityRaw}`, 'detail unit summary');
  const buildingEv = evidenceFor(capture, buildingKey, 'building', `${title}; ${address}`, 'detail property heading', true);
  const amenityText = clean($('.jet-listing-dynamic-field__content').filter((_, x) => /hardwood|refrigerator|dishwasher|heat|carpet/i.test($(x).text())).first().text());
  const amenities: ObservedListing['amenities'] = amenityText ? amenityText.split(/\s*,\s*/).map(clean).filter(Boolean).map((label) => {
    const amenityEvidence = evidenceFor(capture, buildingKey, 'building', `${title}; ${address}; Amenity: ${label}`, '.jet-listing-dynamic-field__content', true);
    return { label, value: true, evidenceIds: [amenityEvidence.id] };
  }) : [];
  const image = $('img[src]').map((_, x) => $(x).attr('src') ?? '').get().map((src) => src.trim()).find((src) => /^https:\/\//i.test(src) && !/logo|equal-housing|better-business/i.test(src));
  let photo: ObservedListing['photo'] = null;
  if (image) { const photoEvidence = evidenceFor(capture, scopeKey, 'offer', `${title}; ${unit ?? ''}; Photo: ${image}`, 'detail image'); photo = { url: image, evidenceId: photoEvidence.id, alt: `${title} unit photo` }; }
  const listing: ObservedListing = { id: scopeKey, sourceId: capture.sourceId, sourceFamily: 'lobos-management', url: capture.url, scope: 'unit', buildingKey, offerKey: scopeKey, floorPlanKey: null, scopeKey,
    title: sourced(title, [buildingEv.id]), address: address ? sourced(address, [buildingEv.id]) : unknown(), unitLabel: unit ? sourced(unit, [ev.id]) : unknown(), propertyType: sourced('apartment', [buildingEv.id]), bedrooms: layout ? sourced(Number(layout[1]), [ev.id]) : unknown(), bathrooms: layout ? sourced(Number(layout[2]), [ev.id]) : unknown(), fullBaths: unknown(), halfBaths: unknown(), rent: { basis: 'whole_unit', period: 'month', amount: amount === null ? unknown() : sourced(amount, [ev.id]), upperAmount: unknown(), kind: amount === null ? 'unknown' : 'exact', semantics: 'base_rent' }, availability: availabilityRaw ? sourced(dateValue(availabilityRaw) ?? availabilityRaw, [ev.id]) : unknown(), utilities: [], amenities, evidence: [ev, buildingEv, ...amenities.flatMap((amenity) => amenity.evidenceIds.map((id) => ({ ...buildingEv, id, excerpt: `Amenity: ${amenity.label}`, locator: '.jet-listing-dynamic-field__content' }))), ...(photo ? [{ ...ev, id: photo.evidenceId, excerpt: `Photo: ${image}`, locator: 'detail image' }] : [])], photo };
  return { listings: [listing], captures: [capture], warnings };
}
