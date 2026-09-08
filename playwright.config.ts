import { defineConfig, devices } from "@playwright/test";
const env = {
  DATABASE_URL:
    process.env.TEST_DATABASE_URL ??
    "postgresql://daily:local-development-only@127.0.0.1:54329/daily_test",
  BETTER_AUTH_URL: "http://localhost:3100",
  BETTER_AUTH_SECRET: "e2e-test-secret-32-characters-long-only",
  OWNER_EMAIL: "owner@test.example",
  LOCAL_PASSWORD_AUTH: "true",
  HOUSEHOLD_NAME: "우리 집",
  NEXT_DIST_DIR: ".next-e2e",
};
Object.assign(process.env, env);
export default defineConfig({
  testDir: "tests/e2e",
  globalSetup: "./tests/e2e/setup.ts",
  fullyParallel: false,
  workers: 1,
  timeout: 45000,
  retries: 0,
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL: "http://localhost:3100",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "desktop",
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 1440, height: 1000 },
      },
    },
    {
      name: "mobile",
      use: { ...devices["iPhone 13"], defaultBrowserType: "chromium" },
    },
  ],
  webServer: {
    command: "npm run dev -- --port 3100",
    url: "http://localhost:3100/login",
    reuseExistingServer: false,
    timeout: 60000,
    env,
  },
});
