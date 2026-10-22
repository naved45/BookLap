import { test, expect } from '@playwright/test';
// Needs backend + frontend running and a fresh/seeded database.
test('sign up, list a book, see it in Explore', async ({ page }) => {
  const email = `e2e${Date.now()}@example.com`;
  await page.goto('/signup');
  await page.getByLabel('Name').fill('E2E Reader'); await page.getByLabel('Email').fill(email); await page.getByLabel('Password').fill('password123');
  await page.getByRole('button', { name: 'Sign up' }).click();
  await page.getByRole('link', { name: 'Skip for now' }).click();
  await page.goto('/list');
  await page.getByLabel('Title').fill('E2E Test Book'); await page.getByLabel('Author').fill('Test Author');
  await page.getByRole('button', { name: 'List book' }).click();
  await expect(page.getByRole('heading', { name: 'E2E Test Book' })).toBeVisible();
  await page.goto('/explore?q=E2E'); await expect(page.getByText('E2E Test Book')).toBeVisible();
});
for (const path of ['/', '/explore', '/login', '/signup', '/how-it-works', '/community']) {
  test(`no horizontal scroll on ${path} at any screen size`, async ({ page }) => {
    await page.goto(path); await page.waitForLoadState('networkidle');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
  });
}
test('navigation matches the screen: bottom bar on phones, top links on laptops', async ({ page, isMobile }) => {
  await page.goto('/');
  if (isMobile) await expect(page.getByRole('navigation', { name: 'Mobile' })).toBeVisible();
  else await expect(page.getByRole('navigation', { name: 'Main' })).toBeVisible();
});
