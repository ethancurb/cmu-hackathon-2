import { expect, test } from '@playwright/test';

test('Grok highlights a near match while rent arithmetic and reversible criteria stay in control', async ({ page, request }) => {
  const { snapshot } = await (await request.get('/api/bootstrap')).json();
  let calls = 0;
  await page.route('**/api/niche', async route => {
    calls++;
    const input = route.request().postDataJSON();
    expect(input.destinationVersion).toBeTruthy();
    await route.fulfill({ json: { query: input.query, snapshotId: snapshot.id, model: 'test-provider', generatedAt: new Date().toISOString(), degraded: null, homesWithoutData: 0, assessments: [{ homeId: 'cmu-floorplan-30562681', matches: true, confidence: 'partial', reason: 'AI interpretation for this controlled UI test.', provenance: 'model_assessment', citedPlaceIds: [], mitigates: null }] } });
  });
  await page.goto('/');
  await page.getByRole('button', { name: 'Ask Grok' }).click();
  await page.locator('#niche-query').fill('near a supermarket');
  await page.getByRole('button', { name: 'Find suggestions', exact: true }).click();
  const group = page.locator('.niche-group');
  await expect(group).toContainText('Webster Hall');
  await expect(group).toContainText('$7.50 over share cap');
  await expect(group).toContainText('Grok interpretation · verify');
  await expect(group).toContainText('1 possible fit');
  await expect(page.locator('.baseline-note')).toHaveCount(0);
  await expect(page.locator('.coverage-primary')).toContainText('0 meet requirements');
  await page.getByRole('button', { name: /Raise your share cap to \$1,207\.50/ }).click();
  await page.getByRole('button', { name: 'Apply this change' }).click();
  await expect(group).toContainText('Meets stated requirements');
  expect(calls).toBe(1);
  await page.getByRole('button', { name: 'Clear this request' }).click();
  await expect(group).toHaveCount(0);
  await expect(page.locator('.coverage-primary')).toContainText('1 meet requirements');
});

test('a Grok failure is distinct from no matching homes and preserves the inventory', async ({ page }) => {
  let calls = 0;
  await page.route('**/api/niche', route => { calls++; return route.fulfill({ status: 429, json: { error: { message: 'Please try again shortly.' } } }); });
  await page.goto('/');
  await page.getByRole('button', { name: 'Ask Grok' }).click();
  await page.locator('#niche-query').fill('hot tub');
  await page.getByRole('button', { name: 'Find suggestions', exact: true }).click();
  await expect(page.locator('.niche-group')).toContainText('Grok is unavailable');
  await expect(page.locator('.niche-group')).not.toContainText('No suggestions within this comparison range');
  await page.locator('.niche-group').getByRole('button', { name: 'Try again' }).click();
  await expect.poll(() => calls).toBe(2);
  await expect(page.locator('.niche-group')).toContainText('Grok is unavailable');
  await expect(page.locator('#home-cmu-floorplan-30562681')).toBeVisible();
  await expect(page.locator('.coverage-primary')).toContainText('0 meet requirements');
});
