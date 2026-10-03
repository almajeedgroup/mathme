import { expect, test } from '@playwright/test';

test('the home page lists projects and the chat box makes new ones', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByTestId('home')).toBeVisible();
  await expect(page.getByText('What shall we make today?')).toBeVisible();

  // describe something: a new project opens in the studio
  await page.getByTestId('chat-input').fill('50 red spheres in a circle');
  await page.getByTestId('chat-send').click();
  await expect(page.getByTestId('object-count')).toHaveText('50 objects');

  // back to all projects: it is in the list
  await page.getByTestId('go-home').click();
  await expect(page.getByTestId('project-card')).toHaveCount(1);
  await expect(page.getByTestId('project-card')).toContainText('50 red spheres in a circle');

  // an idea starts a second project
  await page.getByTestId('home-idea-dna').click();
  await expect(page.getByTestId('object-count')).toHaveText('120 objects');
  await page.goBack();
  await expect(page.getByTestId('project-card')).toHaveCount(2);

  // projects survive a reload and open again
  await page.reload();
  await page.getByRole('button', { name: 'Open 50 red spheres in a circle' }).click();
  await expect(page.getByTestId('object-count')).toHaveText('50 objects');
});

test('rename and delete a project', async ({ page }) => {
  await page.goto('/');
  await page.getByTestId('home-new-project').click();
  await expect(page.getByTestId('object-count')).toBeVisible();
  await page.getByTestId('go-home').click();
  await page.getByRole('button', { name: 'More for My 3D artwork' }).click();
  await page.getByRole('menuitem', { name: 'Rename' }).click();
  await page.getByRole('dialog', { name: 'Rename project' }).getByLabel('Name').fill('Bridge model');
  await page.getByRole('button', { name: 'Save' }).click();
  await expect(page.getByTestId('project-card')).toContainText('Bridge model');
  await page.getByRole('button', { name: 'More for Bridge model' }).click();
  await page.getByRole('menuitem', { name: 'Delete' }).click();
  await page
    .getByRole('dialog', { name: 'Delete this project?' })
    .getByRole('button', { name: 'Delete' })
    .click();
  await expect(page.getByTestId('project-card')).toHaveCount(0);
});

test('the chat box explains what it cannot read', async ({ page }) => {
  await page.goto('/');
  await page.getByTestId('chat-input').fill('blorps everywhere');
  await page.getByTestId('chat-send').click();
  await expect(page.getByTestId('chat-lines')).toContainText('Try something like');
  await expect(page.getByTestId('home')).toBeVisible();
});

test('inside claude.ai the chat box asks Claude, and only uses recipes MathMe can read', async ({ page }) => {
  // stand in for the claude.ai artifact viewer's `sample` capability
  await page.addInitScript(() => {
    const sample = Object.assign(async () => ({ text: '' }), {
      json: async (prompt: string) => {
        (window as unknown as { lastPrompt: string }).lastPrompt = prompt;
        return {
          reply: 'Here is a spiral galaxy! Each star turns a little further round.',
          commands: ['300 spheres → spiral → radius 15 → rainbow', 'blorps all over'],
          idea: 'not-a-real-idea',
          name: 'Spiral galaxy',
        };
      },
    });
    (window as unknown as { claude: unknown }).claude = {
      use: async (name: string) => (name === 'sample' ? sample : null),
    };
  });
  await page.goto('/');
  await expect(page.getByText('AI', { exact: true })).toBeVisible();
  await page.getByTestId('chat-input').fill('make me a galaxy');
  await page.getByTestId('chat-send').click();
  await expect(page.getByTestId('object-count')).toHaveText('300 objects');
  await expect(page.getByText('Here is a spiral galaxy!')).toBeVisible();
  const prompt = await page.evaluate(() => (window as unknown as { lastPrompt: string }).lastPrompt);
  expect(prompt).toContain('Student: make me a galaxy');
  await page.getByTestId('go-home').click();
  await expect(page.getByTestId('project-card')).toContainText('Spiral galaxy');
});
