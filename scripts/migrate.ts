import { readFile, readdir } from "node:fs/promises";
import { createHash } from "node:crypto";
import { pool, transaction } from "../lib/db";
try {
  await transaction(async (db) => {
    await db.query("SELECT pg_advisory_xact_lock(8246791)");
    await db.query(
      "CREATE TABLE IF NOT EXISTS schema_migrations(name text PRIMARY KEY,checksum text NOT NULL,applied_at timestamptz NOT NULL DEFAULT now())",
    );
    for (const name of (await readdir("migrations"))
      .filter((x) => x.endsWith(".sql"))
      .sort()) {
      const sql = await readFile(`migrations/${name}`, "utf8");
      const checksum = createHash("sha256").update(sql).digest("hex");
      const { rows } = await db.query(
        "SELECT checksum FROM schema_migrations WHERE name=$1",
        [name],
      );
      if (rows.length) {
        if (rows[0].checksum !== checksum)
          throw Error(`Applied migration changed: ${name}`);
        continue;
      }
      await db.query(sql);
      await db.query(
        "INSERT INTO schema_migrations(name,checksum) VALUES($1,$2)",
        [name, checksum],
      );
      console.log(`Applied ${name}`);
    }
  });
  console.log("Database schema is current.");
} finally {
  await pool.end();
}
