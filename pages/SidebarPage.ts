import { expect, type Page } from '@playwright/test';

export class SidebarPage {
  readonly page: Page;

  constructor(page: Page) {
    this.page = page;
  }

  async goToTeams() {
    await this.page.getByRole('button', { name: /^Týmy \d+/ }).click();
    await expect(this.page.getByRole('region', { name: 'Přehled týmů' })).toBeVisible();
  }

  async goToBoards() {
    await this.page.getByRole('button', { name: 'Nástěnky', exact: true }).click();
  }

  async goToCalendar() {
    await this.page.getByRole('button', { name: 'Kalendář', exact: true }).click();
    await expect(this.page.getByRole('heading', { name: /^[a-zá-ž]+ \d{4}$/i })).toBeVisible();
  }

  async goToTable() {
    await this.page.getByRole('button', { name: 'Tabulka', exact: true }).click();
    await expect(this.page.getByRole('region', { name: 'Tabulka úkolů' })).toBeVisible();
  }

  async goToNotes() {
    await this.page.getByRole('button', { name: 'Poznámky', exact: true }).click();
    await expect(this.page.getByRole('region', { name: 'Poznámky' })).toBeVisible();
  }

  async goHome() {
    await this.page.getByRole('button', { name: 'Domů', exact: true }).click();
    await expect(this.page.getByRole('region', { name: 'Domov pracovního prostoru' })).toBeVisible();
  }
}
