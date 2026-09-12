import { test, expect, type Page } from '@playwright/test';

// Acceptance against the actual September 12 CMU snapshot. No mocked housing data.
const webster = '#home-cmu-floorplan-30562681';
const schenley = '#home-cmu-floorplan-51260';
const failures = new WeakMap<Page, string[]>();

test.beforeEach(async ({ page }) => {
  const errors: string[] = [];
  failures.set(page, errors);
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/');
  await expect(page.locator(webster)).toBeVisible();
});
test.afterEach(async ({ page }) => { expect(failures.get(page)).toEqual([]); });

test('real seed explains zero matches and applies the smallest price change reversibly', async ({ page, request }) => {
  const response = await request.get('/api/bootstrap');
  expect(response.ok()).toBe(true);
  const { snapshot, seed } = await response.json();
  expect(seed.personalRentCap).toBe(120000);
  expect(seed.allocation.occupants).toBe(2);
  expect(seed.destination.label).toContain('Gates Hillman');
  expect(snapshot.homes.length).toBeGreaterThanOrEqual(12);
  expect(snapshot.homes.every((home: { id: string }) => !home.id.startsWith('test:'))).toBe(true);
  expect(new Set(snapshot.sourceRuns.filter((run: { status: string }) => run.status === 'imported').map((run: { sourceId: string }) => run.sourceId)).size).toBeGreaterThanOrEqual(3);
  await expect(page.locator('.coverage-primary')).toContainText('0 meet requirements');
  await expect(page.locator(webster)).toContainText('$7.50 over share cap');
  await page.getByRole('button', { name: /Raise your share cap to \$1,207\.50/ }).click();
  await expect(page.locator('.alternative-preview')).toContainText('Webster Hall');
  await expect(page.locator('.alternative-preview')).not.toContainText('cmu-floorplan-');
  await page.getByRole('button', { name: 'Apply this change' }).click();
  await expect(page.locator('.coverage-primary')).toContainText('1 meet requirements');
  await expect(page.locator('.home-group').filter({ hasText: 'Meets requirements' }).locator(webster)).toBeVisible();
  await page.getByRole('button', { name: 'Revert to original' }).click();
  await expect(page.locator('.coverage-primary')).toContainText('0 meet requirements');
});

test('comparison opens independently of shortlist and saved decisions survive reload', async ({ page }) => {
  await page.locator(webster).getByRole('button', { name: /to comparison$/ }).click();
  await page.locator(schenley).getByRole('button', { name: /to comparison$/ }).click();
  await page.getByRole('button', { name: 'Compare options', exact: true }).click();
  const comparison = page.getByRole('dialog', { name: 'Compare homes' });
  await expect(comparison).toBeVisible();
  await expect(comparison).toContainText('Webster Hall');
  await expect(comparison).toContainText('Schenley House');
  await expect(comparison).toContainText('Water / sewer');
  await expect(comparison).toContainText('unresolved');
  await page.getByRole('button', { name: 'Close comparison' }).click();
  await page.locator(webster).getByRole('button', { name: /to shortlist$/ }).click();
  await page.reload();
  await expect(page.getByRole('complementary', { name: 'Saved shortlist' })).toContainText('Webster Hall');
  await expect(page.locator(webster).getByRole('button', { name: /from shortlist$/ })).toHaveAttribute('aria-pressed', 'true');
});

test('detail exposes scoped evidence, actual Gates routing and scheduled bus context', async ({ page }) => {
  await page.locator(webster).getByRole('button', { name: /details$/ }).click();
  const detail = page.getByRole('region', { name: /Details for Webster Hall/ });
  await expect(detail).toContainText('$1,207.50');
  await expect(detail).toContainText('floor plan');
  await expect(detail).toContainText('unresolved');
  await expect(detail).toContainText('Gates Hillman');
  await expect(detail).toContainText('2026-09-14');
  await expect(detail).toContainText('71D');
  await detail.locator('summary').filter({ hasText: 'View evidence' }).first().click();
  await expect(detail.locator('.evidence-citation').first()).toContainText('CMU Off-Campus Housing');
  await expect(detail.getByRole('link', { name: 'Original listing' })).toHaveAttribute('href', /webster-hall-103523/);
  // Protect the core geographic claim against SVG/marker projection drift.
  await expect.poll(async () => page.evaluate(() => {
    const path = document.querySelector<SVGPathElement>('.selected-foot-route');
    const marker = document.querySelector('.destination-square');
    if (!path || !marker || !path.getScreenCTM()) return Infinity;
    const end = path.getPointAtLength(path.getTotalLength());
    const position = new DOMPoint(end.x, end.y).matrixTransform(path.getScreenCTM()!);
    const bounds = marker.getBoundingClientRect();
    return Math.hypot(position.x - (bounds.x + bounds.width / 2), position.y - (bounds.y + bounds.height / 2));
  })).toBeLessThan(6);
});

test('coverage includes major sources and separates unsearched portals from imported data', async ({ page }) => {
  await page.locator('.coverage-disclosure > summary').click();
  const ledger = page.locator('.coverage-pop');
  await expect(ledger).toContainText('Zillow');
  await expect(ledger).toContainText('Homes.com');
  await expect(ledger).toContainText('not searched in this run');
  await expect(ledger).toContainText('CMU Off-Campus Housing');
  await expect(ledger).toContainText('Supporting geographic data');
});

test('mobile keeps criteria and options accessible without horizontal overflow', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.getByRole('button', { name: 'Edit current search requirements' })).toBeVisible();
  await expect(page.locator(webster)).toBeVisible();
  const dimensions = await page.evaluate(() => ({ content: document.documentElement.scrollWidth, viewport: innerWidth }));
  expect(dimensions.content).toBeLessThanOrEqual(dimensions.viewport + 1);
  await page.getByRole('button', { name: 'Edit current search requirements' }).click();
  await expect(page.getByRole('button', { name: 'Your share $1,200', exact: true })).toBeVisible();
});
