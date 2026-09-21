import { test, expect, type Page } from '@playwright/test';
const owner = {
  id: 'owner',
  email: 'owner@example.test',
  name: 'Owner',
  phone: '0400000000',
  trade: 'Carpenter',
  location: 'Brisbane',
};
const applicant = { ...owner, id: 'applicant', email: '', phone: '', name: 'Applicant' };
const post = (id = 'p1') => ({
  id,
  ownerId: owner.id,
  kind: 'looking',
  trade: 'Carpenter',
  location: 'Brisbane',
  companyName: '',
  rate: 50,
  from: '2026-09-22',
  to: '2027-09-22',
  description: `Description ${id}`,
  createdAt: new Date().toISOString(),
  interested: ['applicant'],
  viewedInterestCount: 0,
  revision: 1,
});
async function setup(page: Page, state: (url: URL) => object) {
  await page.route('**/api/state?**', (route) =>
    route.fulfill({
      json: {
        email: owner.email,
        user: owner,
        profiles: [owner, applicant],
        hasMore: false,
        page: 0,
        unreadInterestCount: 1,
        ...state(new URL(route.request().url())),
      },
    }),
  );
}
async function refresh(page: Page) {
  await page.evaluate(() => window.dispatchEvent(new Event('focus')));
}
test('editing retains the original revision after another device saves', async ({ page }) => {
  let revision = 1;
  await setup(page, () => ({
    posts: [{ ...post(), revision, description: revision === 1 ? 'Original' : 'Other device' }],
  }));
  let submitted: { revision: number; description: string } | undefined;
  await page.route('**/api/posts/p1', async (route) => {
    submitted = route.request().postDataJSON();
    await route.fulfill({
      status: 409,
      json: { error: 'This post has changed. Reload it before saving.' },
    });
  });
  await page.goto('/posts/p1/edit');
  await page.getByRole('textbox', { name: 'Description', exact: true }).fill('My draft');
  revision = 2;
  const response = page.waitForResponse((r) => r.url().includes('/api/state?'));
  await refresh(page);
  await response;
  await page.getByRole('button', { name: 'Save changes' }).click();
  await expect(page.getByRole('alert')).toContainText('This post has changed');
  expect(submitted).toMatchObject({ revision: 1, description: 'My draft' });
});
test('refresh preserves loaded pages', async ({ page }) => {
  await setup(page, (url) => {
    const second = url.searchParams.get('page') === '1';
    return { posts: [post(second ? 'p2' : 'p1')], page: second ? 1 : 0, hasMore: !second };
  });
  await page.goto('/home');
  await page.getByRole('button', { name: /load more/i }).click();
  await expect(page.getByText('Description p2', { exact: true })).toBeVisible();
  const response = page.waitForResponse((r) => r.url().includes('page=1'));
  await refresh(page);
  await response;
  await expect(page.getByText('Description p1', { exact: true })).toBeVisible();
  await expect(page.getByText('Description p2', { exact: true })).toBeVisible();
});
test('authorized contact stays visible across background refresh', async ({ page }) => {
  await setup(page, () => ({ posts: [{ ...post(), viewedInterestCount: 1 }] }));
  await page.route('**/api/posts/p1/contacts/applicant', (route) =>
    route.fulfill({ json: { ...applicant, email: 'applicant@example.test', phone: '0412345678' } }),
  );
  await page.goto('/posts/p1/interested');
  await page.getByRole('button', { name: 'Contact', exact: true }).click();
  await expect(page.getByRole('dialog')).toContainText('0412345678');
  const response = page.waitForResponse((r) => r.url().includes('/api/state?'));
  await refresh(page);
  await response;
  await expect(page.getByRole('dialog')).toContainText('0412345678');
  await expect(page.getByRole('link', { name: 'Email', exact: true })).toHaveAttribute(
    'href',
    'mailto:applicant@example.test',
  );
});
test('failed read receipt can be retried without losing applicants', async ({ page }) => {
  let attempts = 0;
  let viewed = false;
  await setup(page, () => ({
    posts: [{ ...post(), viewedInterestCount: viewed ? 1 : 0 }],
    unreadInterestCount: viewed ? 0 : 1,
  }));
  await page.route('**/api/posts/p1/interests/viewed', (route) => {
    attempts++;
    viewed = attempts > 1;
    return route.fulfill({
      status: viewed ? 204 : 503,
      ...(viewed ? {} : { json: { error: 'Temporary failure' } }),
    });
  });
  await page.goto('/posts/p1/interested');
  await page.getByRole('button', { name: 'Retry notification update' }).click();
  await expect(page.locator('.notification-badge')).toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'Interested (1)' })).toBeVisible();
  expect(attempts).toBe(2);
});
test('mobile badge caps at 99+ and cards clamp descriptions', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await setup(page, () => ({
    posts: [{ ...post(), description: 'Long description '.repeat(30) }],
    unreadInterestCount: 120,
  }));
  await page.goto('/home');
  await expect(page.locator('.notification-badge')).toHaveText('99+');
  const box = await page.locator('.notification-badge').boundingBox();
  expect(box!.x + box!.width).toBeLessThanOrEqual(375);
  expect(
    await page
      .locator('.post-card .description')
      .evaluate((el) => getComputedStyle(el).webkitLineClamp),
  ).toBe('5');
});
