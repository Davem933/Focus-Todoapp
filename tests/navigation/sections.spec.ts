import { test, expect } from '@playwright/test';
import { LoginPage } from '../../pages/LoginPage';
import { SidebarPage } from '../../pages/SidebarPage';

const EMAIL = process.env.TEST_EMAIL;
const PASSWORD = process.env.TEST_PASSWORD;

if (!EMAIL || !PASSWORD) {
  throw new Error('TEST_EMAIL and TEST_PASSWORD must be set (see .env.example)');
}

test.describe('Workspace navigation', () => {
  test.beforeEach(async ({ page }) => {
    const loginPage = new LoginPage(page);
    await loginPage.goto();
    await loginPage.login(EMAIL, PASSWORD);
    await page.getByRole('tab', { name: /^Workspace \d+/ }).click();
  });

  test('user can navigate to every workspace section without console errors', async ({ page }) => {
    const consoleErrors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });

    const sidebar = new SidebarPage(page);

    await test.step('Týmy', async () => sidebar.goToTeams());
    await test.step('Kalendář', async () => sidebar.goToCalendar());
    await test.step('Tabulka', async () => sidebar.goToTable());
    await test.step('Poznámky', async () => sidebar.goToNotes());
    await test.step('Domů', async () => sidebar.goHome());

    // Known issue (see BUG_REPORT.md): task_labels upsert 500s are expected
    // whenever a mutation-triggered sync fires elsewhere in the app, but pure
    // navigation between sections should not touch that sync path at all.
    expect(consoleErrors, `Unexpected console errors during navigation: ${consoleErrors.join('; ')}`).toEqual([]);
  });
});
