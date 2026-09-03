import { defineConfig, devices } from "@playwright/test";

const playwrightPort = process.env.PLAYWRIGHT_PORT || "3000";
const playwrightBaseUrl = `http://localhost:${playwrightPort}`;
const playwrightServerCommand =
  process.env.PLAYWRIGHT_SERVER_COMMAND || `npm run dev -- -p ${playwrightPort}`;

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  workers: 1,
  reporter: "list",
  use: {
    baseURL: playwrightBaseUrl,
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: {
    command: playwrightServerCommand,
    url: playwrightBaseUrl,
    reuseExistingServer: process.env.PLAYWRIGHT_REUSE_EXISTING_SERVER === "true",
    timeout: 120000,
    env: {
      PROOF_UI_ENABLE_TEST_FIXTURES: "true",
      NEXT_DIST_DIR: process.env.PLAYWRIGHT_DIST_DIR || ".next-e2e",
    },
  },
});
