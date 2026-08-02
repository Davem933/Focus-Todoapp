import { test, expect } from '@playwright/test';
import { LoginPage } from '../../pages/LoginPage';
import { ProfilePage } from '../../pages/ProfilePage';

const EMAIL = process.env.TEST_EMAIL;
const PASSWORD = process.env.TEST_PASSWORD;

if (!EMAIL || !PASSWORD) {
  throw new Error('TEST_EMAIL and TEST_PASSWORD must be set (see .env.example)');
}

async function getDataTheme(page: import('@playwright/test').Page) {
  return page.evaluate(() => document.documentElement.getAttribute('data-theme'));
}

test.describe('Profile, theme, logout', () => {
  test.beforeEach(async ({ page }) => {
    const loginPage = new LoginPage(page);
    await loginPage.goto();
    await loginPage.login(EMAIL, PASSWORD);
  });

  test('profile panel shows the signed-in user', async ({ page }) => {
    const profile = new ProfilePage(page);

    await test.step('When: otevře profil', async () => {
      await profile.open();
    });

    await test.step('Then: vidí své jméno a e-mail', async () => {
      await expect(page.getByRole('heading', { name: 'Dave' })).toBeVisible();
      await expect(page.getByText(EMAIL)).toBeVisible();
    });
  });

  test('toggling dark mode in the profile panel updates the app theme and topbar toggle', async ({ page }) => {
    const profile = new ProfilePage(page);
    await profile.open();
    const themeBefore = await getDataTheme(page);

    await test.step('When: přepne tmavý režim v profilu', async () => {
      await profile.toggleDarkModeFromProfile();
    });

    await test.step('Then: motiv aplikace se změní a topbar tlačítko odráží nový stav', async () => {
      await expect.poll(() => getDataTheme(page)).not.toBe(themeBefore);
      const expectedTopbarLabel = themeBefore === 'dark' ? 'Přepnout na tmavý režim' : 'Přepnout na světlý režim';
      await expect(page.getByRole('button', { name: expectedTopbarLabel })).toBeVisible();
    });

    await test.step('Cleanup: vrátí motiv do původního stavu', async () => {
      await profile.toggleDarkModeFromProfile();
      await expect.poll(() => getDataTheme(page)).toBe(themeBefore);
    });
  });

  test('toggling theme from the topbar also updates the profile switch', async ({ page }) => {
    const profile = new ProfilePage(page);
    const themeBefore = await getDataTheme(page);

    await test.step('When: přepne motiv přes topbar tlačítko', async () => {
      await profile.toggleThemeFromTopbar();
    });

    await test.step('Then: profilový přepínač odráží nový stav', async () => {
      await profile.open();
      const isDarkOn = await profile.isDarkModeOn();
      expect(isDarkOn).toBe(themeBefore !== 'dark');
    });

    await test.step('Cleanup: vrátí motiv do původního stavu', async () => {
      await profile.toggleDarkModeFromProfile();
    });
  });

  test('user can log out and lands back on the login screen', async ({ page }) => {
    const profile = new ProfilePage(page);
    await profile.open();

    await test.step('When: klikne na Odhlásit se', async () => {
      await profile.logout();
    });

    await test.step('Then: je odhlášen a vidí přihlašovací obrazovku', async () => {
      const loginPage = new LoginPage(page);
      await loginPage.expectStillOnLoginForm();
    });
  });
});
