import { expect, test } from '@playwright/test';

test('shared property pin lets the renter choose a floor plan and shows only its walking route', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('#home-cmu-floorplan-30562681')).toBeVisible();
  await expect(page.locator('.leaflet-overlay-pane path')).toHaveCount(0);
  await page.getByRole('button', { name: /Show all \d+ mapped options/ }).click();
  await page.locator('.home-marker').filter({ has: page.locator('.home-pin-count') }).first().click();
  const choices = page.locator('.map-choice-list');
  await expect(choices).toContainText('Webster Hall · B2');
  await expect(choices).toContainText('Webster Hall · B3');
  await choices.getByRole('button', { name: /Webster Hall · B2/ }).click();
  await expect(page.locator('.selected-foot-route')).toHaveCount(1);
  await expect(page.locator('.leaflet-overlay-pane path')).toHaveCount(1);
  await expect(page.locator('.map-caption-home')).toContainText('Webster Hall · B2');
  await expect(page.getByRole('button', { name: 'Focus selected route' })).toBeVisible();
});

test('mobile pin selection keeps the map visible until View details is chosen', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await expect(page.locator('#home-cmu-floorplan-30562681')).toBeVisible();
  await page.getByRole('button', { name: 'Map', exact: true }).click();
  await page.getByRole('button', { name: /Show all \d+ mapped options/ }).click();
  await page.getByRole('button', { name: 'Focus destination', exact: true }).click();
  await page.locator('.home-marker').filter({ has: page.locator('.home-pin-count') }).first().click();
  await page.locator('.map-choice-list').getByRole('button', { name: /Webster Hall · B2/ }).click();
  await expect(page.locator('.map-pane')).toBeVisible();
  await expect(page.locator('.map-caption-home')).toContainText('Webster Hall · B2');
  await page.getByRole('button', { name: 'View details for Webster Hall · B2' }).click();
  await expect(page.getByRole('region', { name: /Details for Webster Hall · B2/ })).toBeVisible();
});
