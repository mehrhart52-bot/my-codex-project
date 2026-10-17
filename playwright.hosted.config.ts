import { defineConfig } from "@playwright/test";
import { existsSync, readFileSync } from "node:fs";

function privateAppSettings() {
  const values = Object.fromEntries(
    readFileSync(".env.local", "utf8")
      .split(/\r?\n/)
      .filter(Boolean)
      .map((line) => {
        const separator = line.indexOf("=");
        return [line.slice(0, separator), line.slice(separator + 1)];
      }),
  );
  const url = values.NEXT_PUBLIC_SUPABASE_URL;
  const key = values.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) throw new Error("Hosted app settings are incomplete.");
  if (new URL(url).hostname !== "naxlbpsjoonktjbieyft.supabase.co")
    throw new Error(
      "Refusing to run hosted tests against an unexpected project.",
    );
  return { url, key };
}

const app = privateAppSettings();
Object.assign(process.env, {
  HTA_HOSTED_TEST: "1",
  NODE_USE_ENV_PROXY: "1",
  NEXT_PUBLIC_SUPABASE_URL: app.url,
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: app.key,
});

export default defineConfig({
  testDir: "./tests/browser",
  fullyParallel: false,
  workers: 1,
  timeout: 90000,
  expect: { timeout: 15000 },
  reporter: "list",
  use: {
    baseURL: "http://127.0.0.1:3000",
    // Hosted browser traffic passes through the Codex environment's TLS proxy.
    ignoreHTTPSErrors: true,
    launchOptions: {
      executablePath:
        process.env.CHROMIUM_PATH ??
        (existsSync("/usr/bin/chromium") ? "/usr/bin/chromium" : undefined),
      args: ["--no-sandbox"],
    },
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
      HTA_HOSTED_TEST: "1",
      NODE_USE_ENV_PROXY: "1",
      NEXT_PUBLIC_SUPABASE_URL: app.url,
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: app.key,
    },
  },
});
