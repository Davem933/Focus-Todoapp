import { expect, type Locator, type Page } from '@playwright/test';

export class ProfilePage {
  readonly page: Page;
  readonly openProfileButton: Locator;
  readonly heading: Locator;
  readonly nicknameInput: Locator;
  readonly darkModeSwitch: Locator;
  readonly logoutButton: Locator;
  readonly topbarThemeToggle: Locator;

  constructor(page: Page) {
    this.page = page;
    this.openProfileButton = page.getByRole('button', { name: 'Otevřít profil' });
    this.heading = page.getByRole('region', { name: 'Profil uživatele' });
    this.nicknameInput = page.getByRole('textbox', { name: 'Jak ti máme říkat?' });
    this.darkModeSwitch = page.getByRole('switch', { name: 'Přepnout tmavý režim' });
    this.logoutButton = page.getByRole('button', { name: 'Odhlásit se' });
    this.topbarThemeToggle = page.getByRole('button', { name: /^Přepnout na (světlý|tmavý) režim$/ });
  }

  async open() {
    await this.openProfileButton.click();
    await expect(this.heading).toBeVisible();
  }

  async isDarkModeOn() {
    return (await this.darkModeSwitch.getAttribute('aria-checked')) === 'true';
  }

  async toggleDarkModeFromProfile() {
    await this.darkModeSwitch.click();
  }

  async toggleThemeFromTopbar() {
    await this.topbarThemeToggle.click();
  }

  async logout() {
    await this.logoutButton.click();
  }
}
