import { test, expect } from '@playwright/test';
import { LoginPage } from '../../pages/LoginPage';
import { TaskDetailPage, TaskListPage } from '../../pages/TaskListPage';

const EMAIL = process.env.TEST_EMAIL;
const PASSWORD = process.env.TEST_PASSWORD;

if (!EMAIL || !PASSWORD) {
  throw new Error('TEST_EMAIL and TEST_PASSWORD must be set (see .env.example)');
}

// Dedicated scratch list ("test") on the seeded account under the "Osobní" tab —
// kept empty between runs so CRUD assertions don't collide with the user's real
// personal tasks or team tasks.
const TEST_LIST_NAME = 'test';

test.describe.configure({ mode: 'serial' });

test.describe('Task CRUD', () => {
  let taskList: TaskListPage;

  test.beforeEach(async ({ page }) => {
    const loginPage = new LoginPage(page);
    await loginPage.goto();
    await loginPage.login(EMAIL, PASSWORD);

    taskList = new TaskListPage(page);
    // Navigated to via UI clicks, not a direct URL — see BUG_REPORT.md:
    // deep-linking straight to a personal list's URL does not reliably land there.
    await taskList.openPersonalList(TEST_LIST_NAME);
    await expect(page.getByRole('heading', { name: 'test', level: 2 })).toBeVisible();
  });

  test('user can create a task', async () => {
    const title = `PW create ${Date.now()}`;

    await test.step('When: přidá nový úkol', async () => {
      await taskList.addTask(title);
    });

    await test.step('Then: úkol se objeví v seznamu', async () => {
      await expect(taskList.taskButton(title)).toBeVisible();
    });

    await taskList.deleteTask(title);
  });

  test('user can mark a task as completed and un-complete it', async () => {
    const title = `PW complete ${Date.now()}`;
    await taskList.addTask(title);

    await test.step('When: označí úkol jako dokončený', async () => {
      await taskList.completeTask(title);
    });

    await test.step('Then: úkol je ve filtru Hotové', async () => {
      await taskList.filterByStatus('done');
      await expect(taskList.taskButton(title)).toBeVisible();
    });

    await test.step('When: zruší dokončení úkolu', async () => {
      await taskList.uncompleteTask(title);
    });

    await test.step('Then: úkol je zpět ve filtru Aktivní', async () => {
      await taskList.filterByStatus('active');
      await expect(taskList.taskButton(title)).toBeVisible();
    });

    await taskList.deleteTask(title);
  });

  test('user can set a task priority', async ({ page }) => {
    const title = `PW priority ${Date.now()}`;
    await taskList.addTask(title);

    await test.step('When: otevře úkol a nastaví prioritu na Vysoká', async () => {
      await taskList.openTask(title);
      const detail = new TaskDetailPage(page);
      await detail.setPriority('Vysoká');
      await expect(detail.priorityButton).toContainText('Vysoká');
    });

    await test.step('When: se vrátí do seznamu', async () => {
      const detail = new TaskDetailPage(page);
      await detail.goBack();
    });

    await taskList.deleteTask(title);
  });

  test('user can delete a task', async () => {
    const title = `PW delete ${Date.now()}`;
    await taskList.addTask(title);

    await test.step('When: smaže úkol', async () => {
      await taskList.deleteTask(title);
    });

    await test.step('Then: úkol zmizí ze seznamu', async () => {
      await expect(taskList.taskButton(title)).not.toBeVisible();
    });
  });
});
