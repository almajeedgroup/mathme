import { readFileSync } from 'node:fs';

import { expect, type Page, test } from '@playwright/test';

/** Sign in without Google (the account service runs with AUTH_TEST_LOGIN=1 in these tests). */
async function signIn(page: Page, email: string, name = 'Test user') {
  const r = await page.request.post('/api/auth/test-login', {
    data: { email, name },
    headers: { 'X-MathMe': '1' },
  });
  expect(r.ok()).toBe(true);
}

/** An empty project file, as the app saves it. */
const projectFile = (name: string) => ({
  app: 'mathme-3d-studio',
  version: 1,
  name,
  author: '',
  units: 'cm',
  background: '#f6f3ff',
  nodes: [],
  library: [],
  meshes: [],
});

let n = 0;
const unique = (who: string) => `${who}-${Date.now()}-${n++}@example.com`;

test('signed out: browse freely, sign in to export', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByTestId('signin')).toBeVisible();
  await page.getByTestId('home-new-project').click();
  await page.getByTestId('add-shape-box').click();
  await page.getByTestId('open-export').click();
  await page.getByTestId('export-png').click();
  await expect(page.getByTestId('upgrade-prompt')).toContainText('Sign in');
});

test('Free plan limits, then Plus through checkout with GST', async ({ page }) => {
  await signIn(page, unique('asha'), 'Asha Rao');
  await page.goto('/');
  await expect(page.getByTestId('plan-badge')).toHaveText('Free');
  await page.getByTestId('home-new-project').click();
  await page.getByTestId('add-shape-box').click();

  // STL is a Plus export
  await page.getByTestId('open-export').click();
  await page.getByTestId('export-stl').click();
  const prompt = page.getByTestId('upgrade-prompt');
  await expect(prompt).toContainText('3D printing (STL)');
  await expect(prompt).toContainText('Plus');
  await prompt.getByTestId('prompt-see-plans').click();

  // plans → Plus monthly → billing details → the test checkout
  await page.getByTestId('choose-plus').click();
  await page.getByLabel('Mobile number').fill('9876543210');
  await page.getByTestId('checkout-state').click();
  await page.getByRole('option', { name: 'Kerala' }).click();
  await expect(page.getByTestId('checkout-total')).toContainText('IGST 18%');
  await expect(page.getByTestId('checkout-total')).toContainText('₹352.82');
  await page.getByTestId('checkout-pay').click();
  await expect(page.getByText('Test payment')).toBeVisible();
  await page.getByTestId('fake-pay').click();

  // back in MathMe with Plus
  await expect(page.getByText('Payment received. Welcome to Plus!')).toBeVisible();
  await expect(page.getByTestId('plan-badge')).toHaveText('Plus');
  await expect(page.getByTestId('invoice-list')).toContainText('₹352.82');
  await page.keyboard.press('Escape');

  // the STL export now works
  await page.getByTestId('home-new-project').click();
  await page.getByTestId('add-shape-box').click();
  await page.getByTestId('open-export').click();
  const [stl] = await Promise.all([page.waitForEvent('download'), page.getByTestId('export-stl').click()]);
  expect(stl.suggestedFilename()).toMatch(/\.stl$/);
});

test('cloud saves: three on Free, the fourth stays on this device', async ({ page }) => {
  await signIn(page, unique('ravi'));
  // three cloud projects already
  for (const id of ['project_c1', 'project_c2', 'project_c3']) {
    const r = await page.request.put(`/api/projects/${id}`, {
      headers: { 'X-MathMe': '1' },
      data: {
        name: id,
        objects: 1,
        baseVersion: 0,
        data: projectFile(id),
      },
    });
    expect(r.ok()).toBe(true);
  }
  await page.goto('/');
  // the cloud projects show on the home page, marked Cloud
  await expect(page.getByTestId('project-card')).toHaveCount(3);
  await expect(page.getByTestId('cloud-badge').first()).toHaveText('Cloud');
  // a fourth project is saved on the device only
  await page.getByTestId('home-new-project').click();
  await expect(page.getByText('Saved on this device')).toBeVisible({ timeout: 15_000 });
  await page.getByTestId('go-home').click();
  await expect(page.getByTestId('cloud-badge').filter({ hasText: 'This device' })).toHaveCount(1);
  // opening a cloud-only project downloads it
  await page.getByRole('button', { name: 'Open project_c2' }).click();
  await expect(page.getByTestId('object-count')).toBeVisible();
});

test('Campus pilot: licence, join codes, shared projects, owner dashboard', async ({ page, browser }) => {
  // the owner creates a licence on the dashboard
  await signIn(page, 'owner@mathme.app', 'Owner');
  await page.goto('/#admin');
  await expect(page.getByTestId('metrics')).toBeVisible();
  await page.getByRole('tab', { name: 'Campus licences' }).click();
  await page.getByTestId('new-org').click();
  const school = `Green Valley ${Date.now()}`;
  await page.getByTestId('org-name').fill(school);
  await page.getByTestId('create-org').click();
  const row = page.getByTestId('orgs').getByRole('row').filter({ hasText: school });
  const teacherCode = (await row.getByTestId('org-code-teacher').innerText()).split(': ')[1];
  const studentCode = (await row.getByTestId('org-code-student').innerText()).split(': ')[1];

  // a teacher and a student join in their own browsers
  const join = async (email: string, code: string) => {
    const ctx = await browser.newContext({
      storageState: {
        cookies: [],
        origins: [
          { origin: new URL(page.url()).origin, localStorage: [{ name: 'mathme.tour.done', value: '1' }] },
        ],
      },
    });
    const p = await ctx.newPage();
    await signIn(p, email, email.split('@')[0]);
    await p.goto('/');
    await p.getByTestId('account-row').click();
    await p.getByRole('menuitem', { name: 'Join a class' }).click();
    await p.getByTestId('join-code').fill(code);
    await p.getByTestId('join-class').click();
    await expect(p.getByTestId('class-page')).toBeVisible();
    await p.keyboard.press('Escape');
    return p;
  };
  const teacher = await join(unique('teacher'), teacherCode);
  await expect(teacher.getByTestId('plan-badge')).toHaveText('Pro');
  const student = await join(unique('student'), studentCode);
  await expect(student.getByTestId('plan-badge')).toHaveText('Plus');

  // the student makes a project; it saves to the cloud and is shared with the class
  await student.getByTestId('home-new-project').click();
  await student.waitForTimeout(4500); // autosave, then the cloud copy
  await student.getByTestId('go-home').click();
  await expect(student.getByTestId('cloud-badge').first()).toHaveText('Cloud', { timeout: 10_000 });
  await student
    .getByRole('button', { name: /^More for/ })
    .first()
    .click();
  await student.getByRole('menuitem', { name: 'Share with my class' }).click();
  await expect(student.getByText('Shared with your class.')).toBeVisible();

  // the teacher sees it on the class page, with the class list
  await teacher.reload();
  await teacher.getByTestId('account-row').click();
  await teacher.getByRole('menuitem', { name: 'My class' }).click();
  await expect(teacher.getByTestId('class-project')).toHaveCount(1);
  await expect(teacher.getByTestId('roster')).toContainText('student-');

  // the owner sees the licence and its members
  await page.reload();
  await page.getByRole('tab', { name: 'Campus licences' }).click();
  await expect(page.getByTestId('orgs').getByRole('row').filter({ hasText: school })).toContainText(
    '1/100 students',
  );
});

test('owner dashboard numbers and the revenue calculator', async ({ page }) => {
  await signIn(page, 'owner@mathme.app', 'Owner');
  await page.goto('/#admin');
  await expect(page.getByTestId('metrics')).toContainText('MRR');
  await page.getByRole('tab', { name: 'Revenue calculator' }).click();
  await expect(page.getByText('₹86,125')).toBeVisible();
  await expect(page.getByText('₹10,33,495')).toBeVisible();
  await page.getByTestId('calc-plus').fill('200');
  await expect(page.getByText('₹1,16,025')).toBeVisible();
});

test('an invoice PDF downloads', async ({ page }) => {
  await signIn(page, unique('meera'));
  await page.goto('/');
  const body = { plan: 'pro', period: 'annual', name: 'Meera', phone: '9876543210', state: 'Karnataka' };
  const r = await (
    await page.request.post('/api/billing/checkout', { data: body, headers: { 'X-MathMe': '1' } })
  ).json();
  await page.goto(r.url);
  await page.getByTestId('fake-pay').click();
  await expect(page.getByTestId('plan-badge')).toHaveText('Pro');
  const [pdf] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: 'PDF' }).click(),
  ]);
  expect(
    readFileSync(await pdf.path())
      .subarray(0, 4)
      .toString(),
  ).toBe('%PDF');
});
