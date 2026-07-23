import { defineConfig, devices } from "@playwright/test";
import "dotenv/config";

const port = Number(process.env.PLAYWRIGHT_PORT ?? 3100);
const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? `http://127.0.0.1:${port}`;

export default defineConfig({
  testDir: "./tests/e2e",
  // Browser projekty používají stejnou databázi a jejich fixtures se po testu mažou.
  // Jeden worker brání souběhu cleanupu jednoho projektu s během druhého.
  workers: 1,
  fullyParallel: false,
  timeout: 45_000,
  expect: {
    timeout: 10_000,
  },
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL,
    screenshot: "only-on-failure",
    trace: "on-first-retry",
  },
  webServer: {
    command: `npm run start -- --hostname 127.0.0.1 --port ${port}`,
    url: baseURL,
    reuseExistingServer: process.env.PLAYWRIGHT_REUSE_EXISTING_SERVER === "1",
    timeout: 120_000,
    env: {
      ...process.env,
      NODE_ENV: "production",
      NEXT_PUBLIC_APP_URL: baseURL,
      NEXT_PUBLIC_MATOMO_ENABLED: "true",
      NEXT_PUBLIC_MATOMO_URL: "https://matomo.example.test/",
      NEXT_PUBLIC_MATOMO_SITE_ID: "1",
      NEXT_PUBLIC_META_PIXEL_ENABLED: "true",
      NEXT_PUBLIC_META_PIXEL_ID: "123456789",
      EMAIL_DELIVERY_MODE: "log",
      SITE_SETTINGS_SNAPSHOT_PATH: "/tmp/ppstudio-e2e-site-settings-snapshot.json",
    },
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "mobile-chrome",
      use: { ...devices["Pixel 5"] },
    },
  ],
});
