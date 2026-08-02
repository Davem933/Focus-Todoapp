import { test, expect } from '@playwright/test';
import { LoginPage } from '../../pages/LoginPage';

const EMAIL = process.env.TEST_EMAIL;

if (!EMAIL) {
  throw new Error('TEST_EMAIL must be set (see .env.example)');
}

test.describe('Login - negative scenarios', () => {
  let loginPage: LoginPage;

  test.beforeEach(async ({ page }) => {
    loginPage = new LoginPage(page);
    await test.step('Given: uživatel je na přihlašovací stránce DoNext', async () => {
      await loginPage.goto();
    });
  });

  test('empty form is blocked by required-field validation', async () => {
    await test.step('When: odešle zcela prázdný formulář', async () => {
      await loginPage.submit();
    });

    await test.step('Then: prohlížeč zablokuje odeslání kvůli povinným polím', async () => {
      expect(await loginPage.emailInput.evaluate((el: HTMLInputElement) => el.validationMessage)).not.toBe('');
      expect(await loginPage.emailInput.evaluate((el: HTMLInputElement) => el.validity.valid)).toBe(false);
      expect(await loginPage.passwordInput.evaluate((el: HTMLInputElement) => el.validity.valid)).toBe(false);

      // Browser blocked submission — still on the login form, not authenticated.
      await loginPage.expectStillOnLoginForm();
    });
  });

  test('email without @ is rejected by browser email-format validation', async () => {
    await test.step('When: zadá e-mail bez zavináče a nějaké heslo a odešle formulář', async () => {
      await loginPage.fillEmail('david.minarik.seznam.cz');
      await loginPage.fillPassword('NejakeHeslo123');
      await loginPage.submit();
    });

    await test.step('Then: prohlížeč zablokuje odeslání kvůli neplatnému formátu e-mailu', async () => {
      const validity = await loginPage.emailInput.evaluate((el: HTMLInputElement) => ({
        valid: el.validity.valid,
        typeMismatch: el.validity.typeMismatch,
      }));
      expect(validity.valid).toBe(false);
      expect(validity.typeMismatch).toBe(true);
      expect(await loginPage.emailInput.evaluate((el: HTMLInputElement) => el.validationMessage)).toContain('@');

      await loginPage.expectStillOnLoginForm();
    });
  });

  test('correct email with wrong password shows an error and does not log in', async ({ page }) => {
    await test.step('When: zadá správný e-mail se špatným heslem a odešle formulář', async () => {
      await loginPage.fillEmail(EMAIL);
      await loginPage.fillPassword('SpatneHeslo123');
      await loginPage.submit();
    });

    await test.step('Then: aplikace zobrazí chybu a uživatele nepřihlásí', async () => {
      await expect(page.getByText('Invalid login credentials')).toBeVisible();
      await loginPage.expectStillOnLoginForm();
      await expect(loginPage.loggedInMarker).not.toBeVisible();
    });
  });

  test('non-existent user shows an error and does not log in', async ({ page }) => {
    await test.step('When: zadá e-mail neexistujícího uživatele a odešle formulář', async () => {
      await loginPage.fillEmail('neexistuje_123456@seznam.cz');
      await loginPage.fillPassword('JakekoliHeslo123');
      await loginPage.submit();
    });

    await test.step('Then: aplikace zobrazí stejnou chybu jako u špatného hesla a uživatele nepřihlásí', async () => {
      await expect(page.getByText('Invalid login credentials')).toBeVisible();
      await loginPage.expectStillOnLoginForm();
      await expect(loginPage.loggedInMarker).not.toBeVisible();
    });
  });
});
