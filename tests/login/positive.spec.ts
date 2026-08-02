import { test, expect } from '@playwright/test';
import { LoginPage } from '../../pages/LoginPage';

const EMAIL = process.env.TEST_EMAIL;
const PASSWORD = process.env.TEST_PASSWORD;

if (!EMAIL || !PASSWORD) {
  throw new Error('TEST_EMAIL and TEST_PASSWORD must be set (see .env.example)');
}

test('user can log in with email and password', async ({ page }) => {
  const loginPage = new LoginPage(page);

  await test.step('Given: uživatel otevře přihlašovací stránku DoNext', async () => {
    await loginPage.goto();
  });

  await test.step('When: vyplní platný e-mail a heslo a odešle formulář', async () => {
    await loginPage.fillEmail(EMAIL);
    await loginPage.fillPassword(PASSWORD);
    await loginPage.submit();
  });

  await test.step('Then: je přihlášen a vidí svůj seznam úkolů', async () => {
    await loginPage.expectLoginSuccess();
    await expect(page.getByRole('heading', { name: 'Úkoly' })).toBeVisible();
  });
});
