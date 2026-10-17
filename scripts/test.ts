import { spawnSync } from "node:child_process";
import { readdirSync } from "node:fs";
const url = process.env.TEST_DATABASE_URL;
if (!url || !new URL(url).pathname.endsWith("_test")) {
  console.error(
    "Set TEST_DATABASE_URL to a dedicated database with a name ending in _test. Tests erase its data.",
  );
  process.exit(1);
}
const env = { ...process.env, DATABASE_URL: url };
for (const args of [
  ["--import", "tsx", "scripts/migrate.ts"],
  [
    "--import",
    "tsx",
    "--test",
    "--test-concurrency=1",
    ...readdirSync("tests")
      .filter((n) => n.endsWith(".test.ts"))
      .map((n) => `tests/${n}`),
  ],
]) {
  const result = spawnSync(process.execPath, args, { stdio: "inherit", env });
  if (result.status !== 0) process.exit(result.status ?? 1);
}
