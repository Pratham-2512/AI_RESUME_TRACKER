import { defineConfig, devices } from "@playwright/test";

const PORT = 3320;
const BASE_URL = `http://localhost:${PORT}`;

/**
 * E2E config. Spins up the Next dev server (loads .env.local for Supabase) and
 * runs Chromium flows against it. Screenshots land in screenshots/e2e/.
 */
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 60_000,
  reporter: [["list"]],
  use: {
    baseURL: BASE_URL,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: `npx next dev -p ${PORT}`,
    url: BASE_URL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    stdout: "ignore",
    stderr: "pipe",
  },
});
