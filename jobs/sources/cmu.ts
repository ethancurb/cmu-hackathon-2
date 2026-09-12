import { load } from 'cheerio';
import type { Capture, ObservedListing, ParseResult } from './types.js';
import { clean, dateValue, elementText, evidenceFor, moneyCents, sourced, unknown } from './extract.js';

const utilityNames: Array<[RegExp, string]> = [[/heat/i, 'gas'], [/water sewer/i, 'water_sewer'], [/water/i, 'water_sewer'], [/trash/i, 'trash'], [/internet/i, 'internet'], [/cable/i, 'other'], [/snow removal/i, 'other'], [/laundry/i, 'other']];

function firstMatch(text: string, re: RegExp): string | null { const m = text.match(re); return m?.[1] ?? null; }

export function parseCmu(capture: Capture): ParseResult {
  const $ = load(capture.html); const listings: ObservedListing[] = []; const warnings: string[] = [];
  $('.c-list').each((index, node) => {
    const card = $(node);
    const name = clean(card.find('.desktopInfo h3').first().text() || card.find('.mobileHeader h3').first().text());
    const address = clean(card.find('.desktopInfo .ellipsis').first().next('span').text() || card.find('.mobileHeader .ellipsis').first().text());
    if (!name || !address) return;
    const scopeKey = `cmu-property-${card.attr('data-property-id') || index + 1}`;
    const text = clean(card.find('.desktopInfo').first().text());
    const rentText = clean(card.find('.priceSec h3').first().text());
    const amounts = [...rentText.replace(/,/g, '').matchAll(/\$(\d+(?:\.\d{1,2})?)/g)].map((m) => Math.round(Number(m[1]) * 100));
    const topBedText = clean(card.find('.topCampInfo').first().text());
    const topBeds = /^(\d+)\s*Bed$/i.test(topBedText) ? topBedText.match(/^(\d+)/)?.[1] ?? null : null;
    const availabilityText = clean(card.find('.priceSec span').first().text());
    const nameEv = evidenceFor(capture, scopeKey, 'building', `${name} ${address}`, `c-list[data-property-id="${card.attr('data-property-id') || index + 1}"]`);
    const rentEv = rentText ? evidenceFor(capture, scopeKey, 'floor_plan', `${name} ${address} ${rentText}`, `.priceSec h3`) : null;
    const availEv = availabilityText ? evidenceFor(capture, scopeKey, 'offer', `${name} ${address} ${availabilityText}`, `.priceSec span`) : null;
    const utilityFeature = card.find('.extra-feature').filter((_, x) => /Utilities\s*Included/i.test($(x).find('.amenityTitle').text())).first();
    const utilityText = clean(utilityFeature.text());
    const utilities = utilityText ? utilityText.split(/Utilities\s*Included/i)[1]?.split(/Unit\s*Amenities/i)[0].split(/(?=Heat|Trash|High Speed Internet|Water Sewer|Water|Cable TV|Hot Water|Snow Removal|Laundry Included)/i).map(clean).filter(Boolean).map((label) => {
      const pair = utilityNames.find(([re]) => re.test(label));
      const name = pair?.[1] ?? 'other';
      const ev = evidenceFor(capture, scopeKey, 'building', `Utilities Included ${label}`, '.extra-feature utilities', true);
      return { name, inclusion: 'included' as const, evidenceIds: [ev.id], terms: null };
    }).filter((utility, utilityIndex, all) => all.findIndex((candidate) => candidate.name === utility.name) === utilityIndex) : [];
    const evidence = [nameEv, ...(rentEv ? [rentEv] : []), ...(availEv ? [availEv] : []), ...utilities.flatMap((u) => u.evidenceIds.map((id) => ({ ...nameEv, id, excerpt: `Utilities Included`, locator: '.extra-feature utilities', appliesToAllUnits: true })) )];
    // The marketplace card is a building-scoped advertised offer. Keep its offer key
    // equal to the card scope because the page does not expose a unit-level row.
    const offerKey = scopeKey; const amount = amounts[0] ?? null; const upper = amounts.length > 1 ? amounts[amounts.length - 1] : amount;
    listings.push({
      id: `cmu-${card.attr('data-property-id') || index + 1}`, sourceId: capture.sourceId, sourceFamily: 'university-marketplace', url: capture.url,
      scope: 'building', buildingKey: scopeKey, offerKey, floorPlanKey: null, scopeKey,
      title: sourced(name, [nameEv.id]), address: sourced(address, [nameEv.id]), unitLabel: unknown(), propertyType: sourced('apartment', [nameEv.id]),
      bedrooms: topBeds ? sourced(Number(topBeds), [nameEv.id]) : unknown(), bathrooms: unknown(), fullBaths: unknown(), halfBaths: unknown(),
      rent: { basis: 'unknown', period: 'month', amount: amount === null ? unknown() : sourced(amount, [rentEv?.id ?? nameEv.id]), upperAmount: upper !== null && amounts.length > 1 ? sourced(upper, [rentEv?.id ?? nameEv.id]) : unknown(), kind: amounts.length === 1 ? 'exact' : amounts.length > 1 ? 'range' : 'unknown', semantics: 'advertised_unspecified' },
      availability: dateValue(availabilityText) ? sourced(dateValue(availabilityText)!, [availEv?.id ?? nameEv.id]) : availabilityText ? sourced(availabilityText.replace(/^Availability:\s*/i, ''), [availEv?.id ?? nameEv.id]) : unknown(),
      utilities, amenities: [], evidence,
    });
  });
  if (!listings.length) warnings.push('CMU parser found no c-list cards');
  return { listings, captures: [capture], warnings };
}
