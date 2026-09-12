import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';
import { parseReinhold } from '../../jobs/sources/manager-page.js';
import { parseLobosDetail } from '../../jobs/sources/lobos.js';
import { parseCmu } from '../../jobs/sources/cmu.js';
import { validateExtractedFact } from '../../jobs/sources/extract.js';
import { fetchPublicPage } from '../../jobs/sources/public-page.js';

const capture = (html: string) => ({ url: 'https://reinholdresidential.com/properties/shadyside-commons/', fetchedAt: '2026-09-12T09:00:00.000Z', html, captureHash: 'fixture-shadyside', sourceId: 'reinhold-residential' });

describe('source parsing', () => {
  it('keeps availability dates attached to their unit row', async () => {
    const result = parseReinhold(capture(await readFile('tests/fixtures/shadyside-commons.html', 'utf8')));
    expect(result.listings).toHaveLength(2);
    const one = result.listings.find((listing) => listing.unitLabel.value === '482-0345');
    const two = result.listings.find((listing) => listing.unitLabel.value === '482-0303');
    expect(one?.availability.value).toBe('2026-09-13');
    expect(two?.availability.value).toBe('2026-09-10');
    expect(two?.availability.evidenceIds.every((id) => two.evidence.find((evidence) => evidence.id === id)?.scopeKey === 'reinhold-482-0303')).toBe(true);
    const swapped = { field: 'availability', value: '2026-09-13', evidenceId: two!.availability.evidenceIds[0], scopeKey: 'reinhold-482-0303' };
    expect(validateExtractedFact(swapped, two!.evidence)).toEqual({ accepted: false, reason: 'value_not_in_evidence' });
    const wrongRent = { field: 'rent', value: 252500, evidenceId: two!.rent.amount.evidenceIds[0], scopeKey: 'reinhold-482-0303' };
    expect(validateExtractedFact(wrongRent, two!.evidence)).toEqual({ accepted: false, reason: 'value_not_in_evidence' });
  });

  it('rejects unregistered/private source hosts before requesting', async () => {
    await expect(fetchPublicPage('https://127.0.0.1/private')).rejects.toMatchObject({ code: 'unregistered_host' });
  });

  it('keeps a direct Lobos unit detail separate from a building card and preserves unknown utilities', () => {
    const html = '<main><h2>Bentley Apartments</h2><p>2 Beds • 1 Baths</p><p>$1699 /month A-3 6201 FIFTH AVENUE, PITTSBURGH, PA 15232</p><p>2 Beds 1 Baths Availability: 8/5/2026</p></main>';
    const result = parseLobosDetail({ url: 'https://lobosmanagement.com/units/bentley-apartments-021-a-03/', fetchedAt: '2026-09-12T09:49:00.000Z', html, captureHash: 'fixture-lobos-detail', sourceId: 'lobos-management' });
    expect(result.listings).toHaveLength(1);
    expect(result.listings[0].unitLabel.value).toBe('A-3');
    expect(result.listings[0].address.value).toBe('6201 FIFTH AVENUE, PITTSBURGH, PA 15232');
    expect(result.listings[0].rent.amount.value).toBe(169900);
    expect(result.listings[0].utilities).toHaveLength(0);
  });

  it('parses CMU embedded floorplan rows without inventing utility inclusion', () => {
    const data = { '123': { title: 'Oakland Example', slug: 'oakland-example-123', category_title: 'Apartment Building', address: '123 Example Ave, Pittsburgh, PA 15213', lat: 40.444, lng: -79.945, rent_style: 'unit', features: { Utilities: ['Water', 'Heat Included'], 'Unit Features': ['Dishwasher'], 'Property Features': ['Elevator'], 'Lease Length': ['12-month'] }, images: ['2026-01/example.jpg'], floorplans: [{ id: 456, title: '2x2 A', bed: '2', bath: '2', min_rent: '1800', max_rent: '1900', available_date: '2026-09-20', status: 'Active' }] } };
    const html = `<script>var listingData = JSON.parse(JSON.stringify(${JSON.stringify(data)}))\n        const hiddenPriceLabelText`;
    const result = parseCmu({ url: 'https://offcampus.housing.cmu.edu/listing', fetchedAt: '2026-09-12T09:00:00.000Z', html, captureHash: 'fixture-cmu-json', sourceId: 'cmu-offcampus' });
    const listing = result.listings.find((item) => item.id === 'cmu-floorplan-456');
    expect(listing?.bedrooms.value).toBe(2);
    expect(listing?.bathrooms.value).toBe(2);
    expect(listing?.rent.amount.value).toBe(180000);
    expect(listing?.rent.upperAmount.value).toBe(190000);
    expect(listing?.utilities.find((item) => item.name === 'water_sewer')?.inclusion).toBeNull();
    expect(listing?.utilities.find((item) => item.name === 'gas')).toBeUndefined();
    expect(listing?.utilities.find((item) => item.name === 'other')?.terms).toBe('Heat Included');
    expect(listing?.utilities.find((item) => item.name === 'other')?.inclusion).toBeNull();
    expect(listing?.utilities.find((item) => item.name === 'other')?.appliesToAllUnits).toBe(false);
    expect(listing?.url).toBe('https://offcampus.housing.cmu.edu/city/pittsburgh-pa/listing/oakland-example-123');
    expect(listing?.evidence.find(item => item.id === listing.photo?.evidenceId)).toMatchObject({scopeKind:'building', appliesToAllUnits:false});
    expect(listing?.photo?.url).toContain('example.jpg');
  });

  it('retains an affordable exact whole-unit match beyond the nearest twelve and leaves missing rent style unknown', () => {
    const records: Record<string, unknown> = {};
    for (let index = 0; index < 11; index += 1) records[`near-${index}`] = { title: `Near ${index}`, address: `${index} Near Ave, Pittsburgh, PA 15213`, lat: 40.444 + index * 0.0001, lng: -79.945, rent_style: 'unit', floorplans: [{ id: 600 + index, title: '2BR', bed: '2', bath: '2', min_rent: String(3000 + index), max_rent: String(3000 + index), status: 'Active' }] };
    records.missingStyle = { title: 'Missing Style', address: '12 Near Ave, Pittsburgh, PA 15213', lat: 40.4452, lng: -79.945, floorplans: [{ id: 611, bed: '2', bath: '2', min_rent: '2100', max_rent: '2100', status: 'Active' }] };
    records.affordableFarther = { title: 'Affordable Farther', address: '6350 Forward Ave, Pittsburgh, PA 15217', lat: 40.428486, lng: -79.919556, rent_style: 'unit', floorplans: [{ id: 612, title: '2BR', bed: '2', bath: '2', min_rent: '1200', max_rent: '1200', status: 'Active' }] };
    const html = `<script>var listingData = JSON.parse(JSON.stringify(${JSON.stringify(records)}))\n        const hiddenPriceLabelText`;
    const result = parseCmu({ url: 'https://offcampus.housing.cmu.edu/listing', fetchedAt: '2026-09-12T09:00:00.000Z', html, captureHash: 'fixture-cmu-selection', sourceId: 'cmu-offcampus' }, { matchingLimit: 12, nearMissLimit: 0 });
    const farther = result.listings.find((item) => item.id === 'cmu-floorplan-612');
    const missingStyle = result.listings.find((item) => item.id === 'cmu-floorplan-611');
    expect(farther?.rent.amount.value).toBe(120000);
    expect(farther?.rent.basis).toBe('whole_unit');
    expect(missingStyle?.rent.basis).toBe('unknown');
    expect(missingStyle?.title.value).toContain('2 Bedroom floorplan');
  });

  it('keeps the nearest affordable exact match when four cheaper matches are farther away', () => {
    const records: Record<string, unknown> = {};
    for (let index = 0; index < 12; index += 1) records[`over-cap-${index}`] = { title: `Over Cap ${index}`, address: `${index} High Ave, Pittsburgh, PA 15213`, lat: 40.444 + index * 0.0001, lng: -79.945, rent_style: 'unit', floorplans: [{ id: 700 + index, title: '2BR', bed: '2', bath: '2', min_rent: '2600', max_rent: '2600', status: 'Active' }] };
    records.nearestAffordable = { title: 'Nearest Affordable', address: '20 Near Ave, Pittsburgh, PA 15213', lat: 40.46, lng: -79.945, rent_style: 'unit', floorplans: [{ id: 712, title: '2BR', bed: '2', bath: '2', min_rent: '2390', max_rent: null, status: 'Active' }] };
    for (let index = 0; index < 4; index += 1) records[`far-cheap-${index}`] = { title: `Far Cheap ${index}`, address: `${30 + index} Far Ave, Pittsburgh, PA 15217`, lat: 40.47 + index * 0.0001, lng: -79.93, rent_style: 'unit', floorplans: [{ id: 720 + index, title: '2BR', bed: '2', bath: '2', min_rent: String(1200 + index * 100), max_rent: String(1200 + index * 100), status: 'Active' }] };
    const html = `<script>var listingData = JSON.parse(JSON.stringify(${JSON.stringify(records)}))\n        const hiddenPriceLabelText`;
    const result = parseCmu({ url: 'https://offcampus.housing.cmu.edu/listing', fetchedAt: '2026-09-12T09:00:00.000Z', html, captureHash: 'fixture-cmu-affordability-diversity', sourceId: 'cmu-offcampus' }, { matchingLimit: 12, nearMissLimit: 0, maxWholeRentCents: 240000 });
    expect(result.listings.some((item) => item.id === 'cmu-floorplan-712')).toBe(true);
    expect(result.listings.filter((item) => item.id.startsWith('cmu-floorplan-7')).length).toBe(16);
  });
});
