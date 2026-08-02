import { defineConfig } from '@playwright/test';
import { config } from 'dotenv';

config({ path: '.env.local' });

export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  reporter: 'list',
  use: {
    baseURL: 'https://focus-todo-app-sigma.vercel.app/',
    trace: 'on-first-retry',
  },
});
