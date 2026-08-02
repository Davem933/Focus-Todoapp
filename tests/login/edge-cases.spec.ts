import { test, expect } from '@playwright/test';
import { LoginPage } from '../../pages/LoginPage';

const EMAIL = process.env.TEST_EMAIL;
const PASSWORD = process.env.TEST_PASSWORD;

if (!EMAIL || !PASSWORD) {
  throw new Error('TEST_EMAIL and TEST_PASSWORD must be set (see .env.example)');
}

test.describe('Login - edge cases', () => {
  let loginPage: LoginPage;

  test.beforeEach(async ({ page }) => {
    loginPage = new LoginPage(page);
    await test.step('Given: uživatel je na přihlašovací stránce DoNext', async () => {
      await loginPage.goto();
    });
  });

  test('email with surrounding whitespace and different casing still logs in', async () => {
    const mixedCaseEmail = `  ${EMAIL.toUpperCase()}  `;

    await test.step('When: zadá e-mail s mezerami kolem a velkými písmeny a odešle formulář', async () => {
      await loginPage.fillEmail(mixedCaseEmail);
      await loginPage.fillPassword(PASSWORD);
      await loginPage.submit();
    });

    await test.step('Then: je přesto úspěšně přihlášen', async () => {
      await loginPage.expectLoginSuccess();
    });
  });

  test('pressing Enter in the password field submits the login form', async () => {
    await test.step('When: vyplní platné údaje a stiskne Enter v poli hesla', async () => {
      await loginPage.fillEmail(EMAIL);
      await loginPage.passwordInput.fill(PASSWORD);
      await loginPage.passwordInput.press('Enter');
    });

    await test.step('Then: formulář se odešle a uživatel je přihlášen', async () => {
      await loginPage.expectLoginSuccess();
    });
  });

  test('password visibility toggle reveals and re-hides the typed password', async () => {
    await test.step('Given: uživatel zadá heslo do skrytého pole', async () => {
      await loginPage.fillPassword('SomeSecret123');
      await expect(loginPage.passwordInput).toHaveAttribute('type', 'password');
    });

    await test.step('When: klikne na "Zobrazit heslo"', async () => {
      await loginPage.togglePasswordVisibility();
    });

    await test.step('Then: heslo se zobrazí jako čitelný text', async () => {
      await expect(loginPage.passwordInput).toHaveAttribute('type', 'text');
      await expect(loginPage.passwordInput).toHaveValue('SomeSecret123');
    });

    await test.step('When: klikne na "Skrýt heslo"', async () => {
      await loginPage.togglePasswordVisibility();
    });

    await test.step('Then: heslo je opět skryté', async () => {
      await expect(loginPage.passwordInput).toHaveAttribute('type', 'password');
    });
  });

  test('password shorter than the minimum length is blocked by browser validation', async () => {
    await test.step('When: zadá heslo kratší než minimální délka a odešle formulář', async () => {
      await loginPage.fillEmail(EMAIL);
      await loginPage.fillPassword('123');
      await loginPage.submit();
    });

    await test.step('Then: prohlížeč zablokuje odeslání kvůli minimální délce hesla', async () => {
      const validity = await loginPage.passwordInput.evaluate((el: HTMLInputElement) => ({
        valid: el.validity.valid,
        tooShort: el.validity.tooShort,
      }));
      expect(validity.valid).toBe(false);
      expect(validity.tooShort).toBe(true);

      await loginPage.expectStillOnLoginForm();
    });
  });

  test('submit button is disabled while the login request is in flight', async ({ page }) => {
    await test.step('Given: síťová odpověď přihlašovacího požadavku je uměle zpožděná', async () => {
      await page.route(/\/auth\/v1\/token\?grant_type=password/, async (route) => {
        await new Promise((resolve) => setTimeout(resolve, 1000));
        await route.continue();
      });
      await loginPage.fillEmail(EMAIL);
      await loginPage.fillPassword(PASSWORD);
    });

    await test.step('When: odešle formulář', async () => {
      await loginPage.submit();
    });

    await test.step('Then: tlačítko je po dobu odesílání zablokované a po dokončení proběhne přihlášení', async () => {
      await expect(loginPage.submitButton).toBeDisabled();
      await page.waitForURL(/\/list\//, { timeout: 10000 });
    });
  });
});
