import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';
import { parseReinhold } from '../../jobs/sources/manager-page.js';
import { parseLobosDetail } from '../../jobs/sources/lobos.js';
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
});
