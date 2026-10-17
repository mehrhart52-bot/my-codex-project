import { existsSync, writeFileSync } from "node:fs";
import { randomBytes } from "node:crypto";
if (existsSync(".env.local")) {
  console.log("Existing .env.local retained.");
} else {
  const password = randomBytes(24).toString("hex");
  writeFileSync(
    ".env.local",
    `POSTGRES_PASSWORD=${password}\nDATABASE_URL=postgresql://hta:${password}@localhost:5432/hta\nTEST_DATABASE_URL=postgresql://hta:${password}@localhost:5432/hta_test\nSESSION_SECRET=${randomBytes(48).toString("base64url")}\n`,
    { mode: 0o600, flag: "wx" },
  );
  console.log(
    "Created private development configuration in .env.local. Do not use it for production.",
  );
}
