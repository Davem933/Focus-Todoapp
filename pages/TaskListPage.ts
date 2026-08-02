import { expect, type Locator, type Page } from '@playwright/test';

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export class TaskListPage {
  readonly page: Page;
  readonly newTaskInput: Locator;
  readonly filterAll: Locator;
  readonly filterActive: Locator;
  readonly filterDone: Locator;
  readonly emptyState: Locator;

  constructor(page: Page) {
    this.page = page;
    this.newTaskInput = page.getByPlaceholder('Přidat úkol...');
    this.filterAll = page.getByRole('tab', { name: /^Vše \d+$/ });
    this.filterActive = page.getByRole('tab', { name: /^Aktivní \d+$/ });
    this.filterDone = page.getByRole('tab', { name: /^Hotové \d+$/ });
    this.emptyState = page.getByText('Tento seznam je zatím prázdný');
  }

  /**
   * Hard navigation straight to a list URL. Only reliable for team/workspace
   * lists on first load — see BUG_REPORT.md: deep-linking to a personal-mode
   * list silently falls back to the last-active team's default list because
   * getInitialActiveTeamId() reads localStorage independently of the route.
   */
  async gotoDirect(listId: string) {
    await this.page.goto(`/list/${listId}`);
  }

  /** Reaches a personal list the way a real user would: switch to the
   * "Osobní" tab, then click the list by name, so client state (active
   * team) stays in sync with the visible list. */
  async openPersonalList(name: string) {
    await this.page.getByRole('tab', { name: new RegExp(`^Osobní \\d+`) }).click();
    await this.page.getByRole('button', { name: new RegExp(`^${name} \\d+`) }).click();
  }

  // Accessible name flips between "dokončený" (mark done) and "otevřený"
  // (mark open) depending on current completion state — match both.
  private taskCheckboxName(title: string) {
    return new RegExp(`^Označit úkol ${escapeRegExp(title)} jako (dokončený|otevřený)$`);
  }

  taskRow(title: string) {
    return this.page.getByRole('checkbox', { name: this.taskCheckboxName(title) }).locator('..');
  }

  taskCheckbox(title: string) {
    return this.page.getByRole('checkbox', { name: this.taskCheckboxName(title) });
  }

  taskButton(title: string) {
    return this.page.getByRole('button', { name: title, exact: true });
  }

  taskMenuButton(title: string) {
    return this.page.getByRole('button', { name: `Otevřít menu úkolu ${title}` });
  }

  async addTask(title: string) {
    await this.newTaskInput.fill(title);
    await this.newTaskInput.press('Enter');
    await expect(this.taskButton(title)).toBeVisible();
  }

  async openTask(title: string) {
    await this.taskButton(title).click();
  }

  // Uses .click() rather than .check()/.uncheck(): this is a custom animated
  // checkbox component, and Playwright's checked-state auto-retry after those
  // calls hangs against it — a locator quirk, not an app bug.
  async completeTask(title: string) {
    await this.taskCheckbox(title).click();
  }

  async uncompleteTask(title: string) {
    await this.taskCheckbox(title).click();
  }

  async deleteTask(title: string) {
    await this.taskMenuButton(title).click();
    await this.page.getByRole('menuitem', { name: 'Smazat' }).click();
  }

  async filterByStatus(status: 'all' | 'active' | 'done') {
    const tab = status === 'all' ? this.filterAll : status === 'active' ? this.filterActive : this.filterDone;
    await tab.click();
  }
}

export class TaskDetailPage {
  readonly page: Page;
  readonly backButton: Locator;
  readonly priorityButton: Locator;
  readonly moveToButton: Locator;
  readonly moreActionsButton: Locator;

  constructor(page: Page) {
    this.page = page;
    this.backButton = page.getByRole('button', { name: 'Zpět na seznam' });
    this.priorityButton = page.getByRole('button', { name: 'Priorita', exact: true });
    this.moveToButton = page.getByRole('button', { name: 'Přesunout do', exact: true });
    this.moreActionsButton = page.getByRole('button', { name: 'Další akce' });
  }

  async setPriority(level: 'Žádná' | 'Nízká' | 'Střední' | 'Vysoká') {
    await this.priorityButton.click();
    await this.page.getByRole('option', { name: level }).click();
  }

  async goBack() {
    await this.backButton.click();
  }
}
