import { spawnSync } from "node:child_process";
const url = process.env.TEST_DATABASE_URL;
if (!url || !new URL(url).pathname.endsWith("_test")) {
  console.error(
    "Set TEST_DATABASE_URL to a dedicated database whose name ends in _test. Browser tests erase its data.",
  );
  process.exit(1);
}
const env = { ...process.env, DATABASE_URL: url };
for (const args of [
  ["--import", "tsx", "scripts/migrate.ts"],
  ["node_modules/@playwright/test/cli.js", "test"],
]) {
  const r = spawnSync(process.execPath, args, { env, stdio: "inherit" });
  if (r.status !== 0) process.exit(r.status ?? 1);
}
