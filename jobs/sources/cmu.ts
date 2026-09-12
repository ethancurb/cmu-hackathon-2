import { load } from 'cheerio';
import type { Capture, ObservedListing, ParseResult } from './types.js';
import { clean, dateValue, elementText, evidenceFor, moneyCents, sourced, unknown } from './extract.js';

const utilityNames: Array<[RegExp, string]> = [[/electric/i, 'electricity'], [/gas/i, 'gas'], [/heat/i, 'other'], [/water sewer|sewer|water/i, 'water_sewer'], [/trash/i, 'trash'], [/internet/i, 'internet'], [/cable/i, 'other'], [/snow removal/i, 'other'], [/laundry/i, 'other']];

export type CmuParseOptions = { destination?: { lat: number; lon: number }; bedrooms?: number; minBathrooms?: number; matchingLimit?: number; nearMissLimit?: number; maxWholeRentCents?: number };

function rentBasis(property: CmuProperty): ObservedListing['rent']['basis'] {
  if (property.rent_style === 'person' || property.per_person_property === true) return 'per_person';
  if (property.rent_style === 'unit' && !property.per_person_property) return 'whole_unit';
  return 'unknown';
}

export function parseCmu(capture: Capture, options: CmuParseOptions = {}): ParseResult {
  const $ = load(capture.html); const listings: ObservedListing[] = []; const warnings: string[] = []; const properties = embeddedData(capture.html) ?? {};
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
    const propertyData = properties[card.attr('data-property-id') || ''];
    const nameEv = evidenceFor(capture, scopeKey, 'building', `${name} ${address}`, `c-list[data-property-id="${card.attr('data-property-id') || index + 1}"]`);
    const category = clean(propertyData?.category_title ?? '');
    const categoryEv = category ? evidenceFor(capture, scopeKey, 'building', `${name} ${address}; Category: ${category}`, `listingData[${card.attr('data-property-id') || index + 1}].category_title`, true) : null;
    const rentEv = rentText ? evidenceFor(capture, scopeKey, 'floor_plan', `${name} ${address} ${rentText}`, `.priceSec h3`) : null;
    const availEv = availabilityText ? evidenceFor(capture, scopeKey, 'offer', `${name} ${address} ${availabilityText}`, `.priceSec span`) : null;
    const utilityFeature = card.find('.extra-feature').filter((_, x) => /Utilities\s*Included/i.test($(x).find('.amenityTitle').text())).first();
    const utilityText = clean(utilityFeature.text()); const utilityEvidence: ObservedListing['evidence'] = [];
    const utilities = utilityText ? utilityText.split(/Utilities\s*Included/i)[1]?.split(/Unit\s*Amenities/i)[0].split(/(?=Heat|Trash|High Speed Internet|Water Sewer|Water|Cable TV|Hot Water|Snow Removal|Laundry Included)/i).map(clean).filter(Boolean).map((label) => {
      const pair = utilityNames.find(([re]) => re.test(label));
      const name = pair?.[1] ?? 'other';
      const ev = evidenceFor(capture, scopeKey, 'building', `Utilities Included ${label}`, '.extra-feature utilities', true);
      utilityEvidence.push(ev);
      return { name, inclusion: (name === 'water_sewer' && !(/water/i.test(utilityText) && /sewer/i.test(utilityText)) ? 'partial' : 'included') as 'partial' | 'included', evidenceIds: [ev.id], terms: label, appliesToAllUnits: true };
    }).filter((utility, utilityIndex, all) => all.findIndex((candidate) => candidate.name === utility.name) === utilityIndex) : [];
    const evidence = [nameEv, ...(rentEv ? [rentEv] : []), ...(availEv ? [availEv] : []), ...utilityEvidence];
    // The marketplace card is a building-scoped advertised offer. Keep its offer key
    // equal to the card scope because the page does not expose a unit-level row.
    const offerKey = scopeKey; const amount = amounts[0] ?? null; const upper = amounts.length > 1 ? amounts[amounts.length - 1] : amount;
    listings.push({
      id: `cmu-${card.attr('data-property-id') || index + 1}`, sourceId: capture.sourceId, sourceFamily: 'cmu-offcampus', url: propertyUrl(properties[card.attr('data-property-id') || ''], capture.url),
      scope: 'building', buildingKey: scopeKey, offerKey, floorPlanKey: null, scopeKey,
      title: sourced(name, [nameEv.id]), address: sourced(address, [nameEv.id]), unitLabel: unknown(), propertyType: /apartment/i.test(category) ? sourced('apartment', [categoryEv!.id]) : /house/i.test(category) ? sourced('house', [categoryEv!.id]) : unknown(),
      bedrooms: topBeds ? sourced(Number(topBeds), [nameEv.id]) : unknown(), bathrooms: unknown(), fullBaths: unknown(), halfBaths: unknown(),
      rent: { basis: 'unknown', period: 'month', amount: amount === null ? unknown() : sourced(amount, [rentEv?.id ?? nameEv.id]), upperAmount: upper !== null && amounts.length > 1 ? sourced(upper, [rentEv?.id ?? nameEv.id]) : unknown(), kind: amounts.length === 1 ? 'exact' : amounts.length > 1 ? 'range' : 'unknown', semantics: 'advertised_unspecified' },
      availability: dateValue(availabilityText) ? sourced(dateValue(availabilityText)!, [availEv?.id ?? nameEv.id]) : availabilityText ? sourced(availabilityText.replace(/^Availability:\s*/i, ''), [availEv?.id ?? nameEv.id]) : unknown(),
      utilities, amenities: [], evidence: [...evidence, ...(categoryEv ? [categoryEv] : [])],
    });
  });
  const embedded = parseCmuListingData(capture, options);
  if (embedded.listings.length) listings.push(...embedded.listings);
  warnings.push(...embedded.warnings);
  if (!listings.length) warnings.push('CMU parser found no c-list cards');
  return { listings, captures: [capture], warnings };
}

type CmuFloorplan = { id?: number | string; title?: string; bed?: string | number; bath?: string | number; min_rent?: string | number; max_rent?: string | number | null; available_date?: string | null; status?: string };
type CmuProperty = { slug?: string; category_title?: string; title?: string; address?: string; lat?: number | string; lng?: number | string; floorplans?: CmuFloorplan[]; features?: Record<string, string[]>; utilities?: Record<string, string> | string[]; images?: string[]; rent_style?: string; per_person_property?: boolean; special_text?: string };

const CMU_DESTINATION = { lat: 40.4440338, lon: -79.9445593 };
const CMU_PHOTO_PREFIX = 'https://rcp-prod-uploads.s3.amazonaws.com/property_images/';

function distanceKm(lat: number, lon: number, destination = CMU_DESTINATION): number {
  const radians = Math.PI / 180; const dLat = (lat - destination.lat) * radians; const dLon = (lon - destination.lon) * radians;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(destination.lat * radians) * Math.cos(lat * radians) * Math.sin(dLon / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.sqrt(a));
}

function embeddedData(html: string): Record<string, CmuProperty> | null {
  const marker = 'var listingData = JSON.parse(JSON.stringify('; const markerStart = html.indexOf(marker); if (markerStart < 0) return null;
  const start = html.indexOf('{', markerStart); const end = html.indexOf('\n        const hiddenPriceLabelText', start); if (start < 0 || end < 0) return null;
  const json = html.slice(start, end).trim();
  try { return JSON.parse(json.endsWith('))') ? json.slice(0, -2) : json) as Record<string, CmuProperty>; } catch { return null; }
}

function propertyUrl(property: CmuProperty | undefined, fallback: string): string {
  return property?.slug ? new URL('/city/pittsburgh-pa/listing/' + encodeURIComponent(property.slug), fallback).href : fallback;
}

function valuesFor(property: CmuProperty, group: string): string[] {
  const featureValues = property.features?.[group] ?? [];
  const utilityValues = group === 'Utilities' && property.utilities ? Object.values(property.utilities) : [];
  return [...featureValues, ...utilityValues].map(clean).filter(Boolean).filter((value, index, all) => all.indexOf(value) === index);
}

function parseCmuListingData(capture: Capture, options: CmuParseOptions = {}): ParseResult {
  const data = embeddedData(capture.html); if (!data) return { listings: [], captures: [], warnings: ['CMU embedded listingData was absent or invalid'] };
  const candidates: Array<{ propertyId: string; property: CmuProperty; floorplan: CmuFloorplan; distance: number; bath: number; rent: number }> = [];
  const destination = options.destination ?? CMU_DESTINATION; const requestedBedrooms = options.bedrooms ?? 2; const minimumBathrooms = options.minBathrooms ?? 2;
  for (const [propertyId, property] of Object.entries(data)) {
    const lat = Number(property.lat); const lon = Number(property.lng); if (!Number.isFinite(lat) || !Number.isFinite(lon) || distanceKm(lat, lon, destination) > 5) continue;
    for (const floorplan of property.floorplans ?? []) {
      const bed = Number(floorplan.bed); const bath = Number(floorplan.bath); const rent = Number(floorplan.min_rent); if (String(floorplan.status).toLowerCase() !== 'active' || bed !== requestedBedrooms || !Number.isFinite(bath) || !Number.isFinite(rent) || rent <= 0 || floorplan.id == null) continue;
      candidates.push({ propertyId, property, floorplan, distance: distanceKm(lat, lon, destination), bath, rent });
    }
  }
  candidates.sort((a, b) => b.bath - a.bath || a.distance - b.distance || a.rent - b.rent);
  const matchingLimit = options.matchingLimit ?? 12; const nearMissLimit = options.nearMissLimit ?? 8; const selected: typeof candidates = []; const perProperty = new Map<string, number>();
  const matches = candidates.filter((candidate) => candidate.bath >= minimumBathrooms); const nearMisses = candidates.filter((candidate) => candidate.bath < minimumBathrooms);
  const take = (pool: typeof candidates, limit: number) => { if (limit <= 0) return; let taken = 0; for (const candidate of pool) { const count = perProperty.get(candidate.propertyId) ?? 0; if (count >= 2) continue; selected.push(candidate); perProperty.set(candidate.propertyId, count + 1); if (++taken >= limit) break; } };
  take(matches, matchingLimit); take(nearMisses, nearMissLimit);
  const selectedIds = new Set(selected.map((candidate) => String(candidate.floorplan.id)));
  const maxWholeRentCents = options.maxWholeRentCents ?? 240000;
  const extraExactWholeUnits = matches.filter((candidate) => rentBasis(candidate.property) === 'whole_unit' && candidate.rent * 100 <= maxWholeRentCents && (candidate.floorplan.max_rent == null || !Number.isFinite(Number(candidate.floorplan.max_rent)) || Number(candidate.floorplan.max_rent) === candidate.rent) && !selectedIds.has(String(candidate.floorplan.id)));
  const closestAffordable = [...extraExactWholeUnits].sort((a, b) => a.distance - b.distance || a.rent - b.rent);
  take(closestAffordable, 2);
  const afterClosest = extraExactWholeUnits.filter((candidate) => !selected.some((item) => String(item.floorplan.id) === String(candidate.floorplan.id))).sort((a, b) => a.rent - b.rent || a.distance - b.distance);
  take(afterClosest, 2);
  const listings: ObservedListing[] = [];
  for (const { propertyId, property, floorplan, bath, rent } of selected) {
    const buildingKey = `cmu-property-${propertyId}`; const offerKey = `cmu-floorplan-${floorplan.id}`; const propertyTitle = clean(property.title ?? 'CMU Off-Campus listing'); const propertyAddress = clean(property.address ?? ''); const planTitle = clean(floorplan.title ?? `${requestedBedrooms} Bedroom floorplan`);
    const rowExcerpt = `${propertyTitle}; ${propertyAddress}; ${planTitle}; ${requestedBedrooms} Beds; ${bath} Baths; $${rent.toFixed(2)}${Number(floorplan.max_rent) > rent ? `-$${Number(floorplan.max_rent).toFixed(2)}` : ''}${floorplan.available_date ? `; Available ${floorplan.available_date}` : ''}`;
    const buildingEvidence = evidenceFor(capture, buildingKey, 'building', `${propertyTitle}; ${propertyAddress}`, `listingData[${propertyId}]`, true);
    const offerEvidence = evidenceFor(capture, offerKey, 'floor_plan', rowExcerpt, `listingData[${propertyId}].floorplans[id=${floorplan.id}]`);
    const evidence: ObservedListing['evidence'] = [buildingEvidence, offerEvidence];
    const category = clean(property.category_title ?? ''); const categoryEvidence = category ? evidenceFor(capture, buildingKey, 'building', `${propertyTitle}; ${propertyAddress}; Category: ${category}`, `listingData[${propertyId}].category_title`, true) : null;
    if (categoryEvidence) evidence.push(categoryEvidence);
    const utilityRows: ObservedListing['utilities'] = [];
    for (const label of valuesFor(property, 'Utilities')) {
      const pair = utilityNames.find(([regexp]) => regexp.test(label)); const name = pair?.[1] ?? 'other'; if (utilityRows.some((utility) => utility.name === name)) continue;
      const explicitIncluded = /included/i.test(label) && /\b(?:all (?:units|apartments|floor\s?plans)|every (?:unit|apartment))\b/i.test(label); const utilityScopeKey = explicitIncluded ? buildingKey : `${buildingKey}-utility-context`; const utilityEvidence = evidenceFor(capture, utilityScopeKey, 'building', `${propertyTitle}; ${propertyAddress}; Utility: ${label}`, `listingData[${propertyId}].features.Utilities`, explicitIncluded); evidence.push(utilityEvidence);
      utilityRows.push({ name, inclusion: explicitIncluded ? 'included' : null, evidenceIds: [utilityEvidence.id], terms: label, appliesToAllUnits: explicitIncluded });
    }
    const amenities: ObservedListing['amenities'] = [];
    for (const label of [...valuesFor(property, 'Unit Features'), ...valuesFor(property, 'Property Features')].slice(0, 30)) {
      const amenityEvidence = evidenceFor(capture, buildingKey, 'building', `${propertyTitle}; ${propertyAddress}; Amenity: ${label}`, `listingData[${propertyId}].features`, false); evidence.push(amenityEvidence); amenities.push({ label, value: true, evidenceIds: [amenityEvidence.id], scope: 'building', applicability: 'unknown' });
    }
    const leaseValues = valuesFor(property, 'Lease Length'); let leaseTerms = undefined;
    if (leaseValues.length) { const leaseEvidence = evidenceFor(capture, buildingKey, 'building', `${propertyTitle}; ${propertyAddress}; Lease length: ${leaseValues.join(', ')}`, `listingData[${propertyId}].features['Lease Length']`, false); evidence.push(leaseEvidence); leaseTerms = sourced(leaseValues.join('; '), [leaseEvidence.id]); }
    let concessions = undefined; const special = clean(load(property.special_text ?? '').text());
    if (special) { const concessionEvidence = evidenceFor(capture, buildingKey, 'building', `${propertyTitle}; ${propertyAddress}; Special: ${special}`, `listingData[${propertyId}].special_text`, false); evidence.push(concessionEvidence); concessions = sourced(special, [concessionEvidence.id]); }
    const coordinateEvidence = evidenceFor(capture, buildingKey, 'building', `${propertyTitle}; ${propertyAddress}; Coordinates: {"lat":${Number(property.lat)},"lon":${Number(property.lng)}}`, `listingData[${propertyId}].lat/lng`, true); evidence.push(coordinateEvidence);
    const coordinates = sourced({ lat: Number(property.lat), lon: Number(property.lng) }, [coordinateEvidence.id]);
    let photo: ObservedListing['photo'] = null; const image = property.images?.map(clean).find(Boolean);
    if (image) { const photoEvidence = evidenceFor(capture, buildingKey, 'building', `${propertyTitle}; ${propertyAddress}; Photo: ${image}`, `listingData[${propertyId}].images`, false); evidence.push(photoEvidence); photo = { url: new URL(image, CMU_PHOTO_PREFIX).href, evidenceId: photoEvidence.id, alt: 'property photo' }; }
    const maxRent = Number(floorplan.max_rent); const hasRange = Number.isFinite(maxRent) && maxRent > rent; const amount = Math.round(rent * 100); const upperAmount = hasRange ? Math.round(maxRent * 100) : null;
    listings.push({ id: `cmu-floorplan-${floorplan.id}`, sourceId: capture.sourceId, sourceFamily: 'cmu-offcampus', url: propertyUrl(property, capture.url), scope: 'floor_plan', buildingKey, offerKey, floorPlanKey: offerKey, scopeKey: offerKey,
      title: sourced(`${propertyTitle} · ${planTitle}`, [buildingEvidence.id, offerEvidence.id]), address: sourced(propertyAddress, [buildingEvidence.id]), unitLabel: unknown(), propertyType: /apartment/i.test(category) ? sourced('apartment', [categoryEvidence!.id]) : /house/i.test(category) ? sourced('house', [categoryEvidence!.id]) : unknown(), bedrooms: sourced(requestedBedrooms, [offerEvidence.id]), bathrooms: sourced(bath, [offerEvidence.id]), fullBaths: unknown(), halfBaths: unknown(),
      rent: { basis: rentBasis(property), period: 'month', amount: sourced(amount, [offerEvidence.id]), upperAmount: hasRange ? sourced(upperAmount!, [offerEvidence.id]) : unknown(), kind: hasRange ? 'range' : 'exact', semantics: 'base_rent' }, availability: floorplan.available_date ? sourced(dateValue(floorplan.available_date) ?? floorplan.available_date, [offerEvidence.id]) : unknown(), utilities: utilityRows, amenities, evidence, coordinate: coordinates, concessions, concessionsScope: 'building', leaseTerms, leaseTermsScope: 'building', photo });
  }
  return { listings, captures: [], warnings: [`CMU embedded data: retained ${listings.length} nearby active ${requestedBedrooms}-bedroom floorplans from ${Object.keys(data).length} properties`] };
}
