import { expect, type Locator, type Page } from '@playwright/test';

export class LoginPage {
  readonly page: Page;
  readonly heading: Locator;
  readonly emailInput: Locator;
  readonly passwordInput: Locator;
  readonly submitButton: Locator;
  readonly togglePasswordButton: Locator;
  readonly loggedInMarker: Locator;

  constructor(page: Page) {
    this.page = page;
    this.heading = page.getByRole('heading', { name: 'Vítej zpět' });
    this.emailInput = page.getByRole('textbox', { name: 'E-mailová adresa' });
    this.passwordInput = page.getByRole('textbox', { name: 'Heslo' });
    // Accessible name goes empty while the loading spinner replaces the label mid-submit,
    // so target the class instead of the role name for actions that must work during submit.
    this.submitButton = page.locator('button.auth-screen-card__submit');
    this.togglePasswordButton = page.getByRole('button', { name: /Zobrazit heslo|Skrýt heslo/ });
    this.loggedInMarker = page.getByText('Global admin');
  }

  async goto() {
    await this.page.goto('/');
    await expect(this.heading).toBeVisible();
  }

  async fillEmail(email: string) {
    await this.emailInput.fill(email);
  }

  async fillPassword(password: string) {
    await this.passwordInput.fill(password);
  }

  async submit() {
    await this.submitButton.click();
  }

  async login(email: string, password: string) {
    await this.fillEmail(email);
    await this.fillPassword(password);
    await this.submit();
    await this.expectLoginSuccess();
  }

  async expectLoginSuccess() {
    await this.page.waitForURL(/\/list\//);
    await expect(this.loggedInMarker).toBeVisible();
  }

  async expectStillOnLoginForm() {
    await expect(this.heading).toBeVisible();
  }

  async togglePasswordVisibility() {
    await this.togglePasswordButton.click();
  }
}
