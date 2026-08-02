import { test, expect } from '@playwright/test';
import { LoginPage } from '../../pages/LoginPage';
import { TaskListPage } from '../../pages/TaskListPage';

const EMAIL = process.env.TEST_EMAIL;
const PASSWORD = process.env.TEST_PASSWORD;

if (!EMAIL || !PASSWORD) {
  throw new Error('TEST_EMAIL and TEST_PASSWORD must be set (see .env.example)');
}

const TEST_LIST_NAME = 'test';

test.describe.configure({ mode: 'serial' });

test.describe('Task filtering', () => {
  let taskList: TaskListPage;

  test.beforeEach(async ({ page }) => {
    const loginPage = new LoginPage(page);
    await loginPage.goto();
    await loginPage.login(EMAIL, PASSWORD);

    taskList = new TaskListPage(page);
    await taskList.openPersonalList(TEST_LIST_NAME);
    await expect(page.getByRole('heading', { name: 'test', level: 2 })).toBeVisible();
  });

  test('Vše/Aktivní/Hotové filters show a task in the right state only', async () => {
    const title = `PW filter ${Date.now()}`;
    await taskList.addTask(title);

    await test.step('Then: nedokončený úkol je vidět v Aktivní i Vše, ne v Hotové', async () => {
      await taskList.filterByStatus('active');
      await expect(taskList.taskButton(title)).toBeVisible();

      await taskList.filterByStatus('all');
      await expect(taskList.taskButton(title)).toBeVisible();

      await taskList.filterByStatus('done');
      await expect(taskList.taskButton(title)).not.toBeVisible();
    });

    await test.step('When: úkol je dokončen', async () => {
      await taskList.filterByStatus('active');
      await taskList.completeTask(title);
    });

    await test.step('Then: dokončený úkol je vidět v Hotové i Vše, ne v Aktivní', async () => {
      await taskList.filterByStatus('done');
      await expect(taskList.taskButton(title)).toBeVisible();

      await taskList.filterByStatus('all');
      await expect(taskList.taskButton(title)).toBeVisible();

      await taskList.filterByStatus('active');
      await expect(taskList.taskButton(title)).not.toBeVisible();
    });

    await taskList.filterByStatus('done');
    await taskList.deleteTask(title);
  });

  test('personal view "Důležité" only shows tasks with a priority set', async ({ page }) => {
    const highPriorityTitle = `PW important ${Date.now()}`;
    const plainTitle = `PW plain ${Date.now()}`;

    await taskList.addTask(plainTitle);
    await taskList.addTask(highPriorityTitle);

    await test.step('When: nastaví prioritu jednomu ze dvou úkolů', async () => {
      await taskList.openTask(highPriorityTitle);
      await page.getByRole('button', { name: 'Priorita', exact: true }).click();
      await page.getByRole('option', { name: 'Vysoká' }).click();
      await page.getByRole('button', { name: 'Zpět na seznam' }).click();
    });

    await test.step('Then: pohled "Důležité" zobrazí jen úkol s prioritou', async () => {
      await page.getByRole('button', { name: /^Důležité \d+/ }).click();
      await expect(page.getByRole('button', { name: highPriorityTitle, exact: true })).toBeVisible();
      await expect(page.getByRole('button', { name: plainTitle, exact: true })).not.toBeVisible();
    });

    await taskList.openPersonalList(TEST_LIST_NAME);
    await taskList.deleteTask(highPriorityTitle);
    await taskList.deleteTask(plainTitle);
  });
});
