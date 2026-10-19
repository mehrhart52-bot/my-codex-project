import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { spawn, spawnSync } from "node:child_process";
import { resolve } from "node:path";
import { createInterface } from "node:readline/promises";
import { developmentSettings } from "./development-settings.mjs";

const envPath = resolve(".env.local");
const nextBin = resolve("node_modules/next/dist/bin/next");

if (!existsSync(nextBin)) {
  console.log("Installing this app's packages for the first time…\n");
  const npmCli = process.env.npm_execpath;
  if (!npmCli) {
    console.error("npm could not be located. Install Node.js, then try again.");
    process.exit(1);
  }
  const install = spawnSync(process.execPath, [npmCli, "ci"], {
    stdio: "inherit",
  });
  if (install.status !== 0) process.exit(install.status ?? 1);
}

if (existsSync(envPath)) process.loadEnvFile(envPath);

const urlName = "NEXT_PUBLIC_SUPABASE_URL";
const keyName = "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY";
const settings = developmentSettings(
  process.env[urlName],
  process.env[keyName],
);
let { url, key } = settings;
if (settings.sharedDemo) {
  console.log(
    "Using the shared demo project. Sign in with your demo email and password.\n",
  );
}

if (!url || !key) {
  if (!process.stdin.isTTY) {
    console.error(
      "Supabase setup is required. Follow SUPABASE_SETUP.md, then run npm run dev again.",
    );
    process.exit(1);
  }

  console.log("\nFirst-time setup: connect this app to your Supabase project.");
  console.log(
    "SUPABASE_SETUP.md shows exactly where to find these two values.\n",
  );
  const prompt = createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  url = (await prompt.question("Supabase project URL: ")).trim();
  key = (await prompt.question("Supabase publishable key: ")).trim();
  prompt.close();

  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:") throw new Error();
  } catch {
    console.error("That project URL is not a valid HTTPS address.");
    process.exit(1);
  }
  if (key.length < 20) {
    console.error("That publishable key looks incomplete.");
    process.exit(1);
  }

  const existing = existsSync(envPath) ? readFileSync(envPath, "utf8") : "";
  const retained = existing
    .split(/\r?\n/)
    .filter(
      (line) =>
        line &&
        !line.startsWith(`${urlName}=`) &&
        !line.startsWith(`${keyName}=`),
    );
  retained.push(`${urlName}=${url}`, `${keyName}=${key}`);
  writeFileSync(envPath, `${retained.join("\n")}\n`, { mode: 0o600 });
  console.log("\nSaved to .env.local. This file is excluded from Git.\n");
}

const child = spawn(
  process.execPath,
  [nextBin, "dev", "--hostname", "0.0.0.0", ...process.argv.slice(2)],
  {
    stdio: "inherit",
    env: { ...process.env, [urlName]: url, [keyName]: key },
  },
);

child.on("exit", (code, signal) => {
  if (signal) process.kill(process.pid, signal);
  else process.exit(code ?? 1);
});
