import { expect, test } from '@playwright/test';

// These tests mock only the same-origin session boundary. They intentionally
// do not exercise a live Auth0 tenant or hosted credential flow.
type Session = { status: 'disabled' } | { status: 'anonymous' } | { status: 'authenticated'; user: { sub: string; name?: string; email?: string; emailVerified: boolean } };
const accountSummary = (page: import('@playwright/test').Page) => page.locator('summary[aria-label="Open account menu"]');
const savedCount = (page: import('@playwright/test').Page) => page.locator('.shortlist-label > strong');

async function mockSession(page: import('@playwright/test').Page, current: () => Session | 'malformed' | 'failed') {
  await page.route('**/api/session', async route => {
    const next = current();
    if (next === 'failed') return route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ error: 'unavailable' }) });
    if (next === 'malformed') return route.fulfill({ contentType: 'application/json', body: JSON.stringify({ status: 'authenticated', user: { email: 'not-safe' } }) });
    return route.fulfill({ contentType: 'application/json', headers: { 'cache-control': 'no-store' }, body: JSON.stringify(next) });
  });
}

test('account menu shows a verified profile and stays compact on mobile', async ({ page }) => {
  await mockSession(page, () => ({ status: 'authenticated', user: { sub: 'auth0|renter', name: 'Mina Renter', email: 'mina@example.test', emailVerified: true } }));
  await page.goto('/');
  await expect(accountSummary(page)).toBeVisible();
  await accountSummary(page).click();
  await expect(page.locator('.account-popover .account-email')).toHaveText('mina@example.test');
  await expect(page.locator('.account-popover .account-verified')).toHaveText('Email verified');
  await expect(page.locator('.account-popover .account-copy')).toHaveText('Saved on this browser');
  await expect(page.locator('.account-popover a[href="/auth/logout"]')).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(accountSummary(page)).toBeVisible();
  const dimensions = await page.evaluate(() => ({ width: document.documentElement.scrollWidth, viewport: innerWidth }));
  expect(dimensions.width).toBeLessThanOrEqual(dimensions.viewport + 1);
});

test('an identity switch restores its own workspace without overwriting the earlier account', async ({ page }) => {
  let session: Session = { status: 'authenticated', user: { sub: 'auth0|user-a', email: 'a@example.test', emailVerified: false } };
  await mockSession(page, () => session);
  await page.addInitScript(() => localStorage.setItem('onestop-search-v2:account:auth0%7Cuser-b', JSON.stringify({ shortlistIds: ['user-b-only'] })));
  await page.goto('/');
  await expect(accountSummary(page)).toHaveText('a@example.test');
  const before = await page.evaluate(() => localStorage.getItem('onestop-search-v2:account:auth0%7Cuser-a'));
  expect(before).not.toBeNull();
  session = { status: 'authenticated', user: { sub: 'auth0|user-b', email: 'b@example.test', emailVerified: true } };
  await page.evaluate(() => window.dispatchEvent(new Event('focus')));
  await expect(accountSummary(page)).toHaveText('b@example.test');
  await expect.poll(() => page.evaluate(() => ({
    a: localStorage.getItem('onestop-search-v2:account:auth0%7Cuser-a'),
    b: JSON.parse(localStorage.getItem('onestop-search-v2:account:auth0%7Cuser-b') || '{}').shortlistIds,
  }))).toEqual({ a: before, b: ['user-b-only'] });
});

test('a failed or malformed account response leaves the public demo usable and does not create a guest workspace', async ({ page }) => {
  let session: Session | 'malformed' | 'failed' = 'malformed';
  await mockSession(page, () => session);
  await page.goto('/');
  await expect(page.locator('.account-error')).toContainText('Account unavailable');
  await expect(page.locator('.coverage-primary')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Retry account check' })).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem('onestop-search-v2:guest'))).toBeNull();
  session = 'failed';
  await page.getByRole('button', { name: 'Retry account check' }).click();
  await expect(page.locator('.account-error')).toContainText('Account unavailable');
  expect(await page.evaluate(() => localStorage.getItem('onestop-search-v2:guest'))).toBeNull();
});

test('private-browsing-style inaccessible storage keeps the public demo available', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(window, 'localStorage', { configurable: true, get: () => { throw new DOMException('Blocked', 'SecurityError'); } });
  });
  await mockSession(page, () => ({ status: 'anonymous' }));
  await page.goto('/');
  await expect(page.locator('.coverage-primary')).toBeVisible();
  await expect(accountSummary(page)).toBeVisible();
});

test('a failed account recheck preserves the visible workspace while writes are blocked', async ({ page }) => {
  let session: Session | 'failed' = { status: 'authenticated', user: { sub: 'auth0|keep-view', email: 'keep@example.test', emailVerified: false } };
  await mockSession(page, () => session);
  await page.goto('/');
  const shortlist = page.locator('.action-button[aria-label*=" to shortlist"]').first();
  await shortlist.click();
  await expect(savedCount(page)).toHaveText('1 saved option');
  await expect.poll(() => page.evaluate(() => localStorage.getItem('onestop-search-v2:account:auth0%7Ckeep-view'))).not.toBeNull();
  const before = await page.evaluate(() => localStorage.getItem('onestop-search-v2:account:auth0%7Ckeep-view'));
  session = 'failed';
  await page.evaluate(() => window.dispatchEvent(new Event('focus')));
  await expect(page.locator('.account-error')).toContainText('Account unavailable');
  await expect(savedCount(page)).toHaveText('1 saved option');
  await expect.poll(() => page.evaluate(() => localStorage.getItem('onestop-search-v2:account:auth0%7Ckeep-view'))).toBe(before);
});
