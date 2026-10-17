import { defineConfig } from "@playwright/test";
import { existsSync } from "node:fs";
import { settings } from "./tests/support/lab";

const lab = settings();
export default defineConfig({
  testDir: "./tests/browser",
  fullyParallel: false,
  workers: 1,
  timeout: 90000,
  expect: { timeout: 15000 },
  reporter: "list",
  use: {
    baseURL: "http://127.0.0.1:3000",
    launchOptions: {
      executablePath:
        process.env.CHROMIUM_PATH ??
        (existsSync("/usr/bin/chromium") ? "/usr/bin/chromium" : undefined),
      args: ["--no-sandbox"],
    },
    // Auth sessions/passwords must not be saved in traces, video, or screenshots.
    trace: "off",
    screenshot: "off",
    video: "off",
  },
  webServer: {
    command: "npm run dev",
    url: "http://127.0.0.1:3000",
    reuseExistingServer: false,
    timeout: 120000,
    env: {
      NEXT_PUBLIC_SUPABASE_URL: lab.API_URL,
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: lab.ANON_KEY,
    },
  },
});
