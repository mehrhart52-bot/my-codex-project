import { z } from "zod";
import { pool, transaction } from "../lib/db";
import { hashPassword } from "../lib/password";
try {
  const config = z
    .object({
      BOOTSTRAP_ADMIN_EMAIL: z.email().toLowerCase(),
      BOOTSTRAP_ADMIN_PASSWORD: z.string().min(16).max(128),
      BOOTSTRAP_ADMIN_FIRST_NAME: z.string().trim().min(1).max(80),
      BOOTSTRAP_ADMIN_LAST_NAME: z.string().trim().min(1).max(80),
      BOOTSTRAP_ADMIN_PHONE: z.string().trim().min(7).max(30),
    })
    .parse(process.env);
  const hash = await hashPassword(config.BOOTSTRAP_ADMIN_PASSWORD);
  await transaction(async (db) => {
    await db.query("SELECT pg_advisory_xact_lock(8246792)");
    const { rows } = await db.query(
      "SELECT id FROM users WHERE role='admin' AND active",
    );
    if (rows.length)
      throw Error(
        "An active administrator already exists. Use Administration to manage permissions.",
      );
    const result = await db.query(
      "INSERT INTO users(first_name,last_name,email,phone,password_hash,role,approved) VALUES($1,$2,$3,$4,$5,'admin',true) RETURNING id",
      [
        config.BOOTSTRAP_ADMIN_FIRST_NAME,
        config.BOOTSTRAP_ADMIN_LAST_NAME,
        config.BOOTSTRAP_ADMIN_EMAIL,
        config.BOOTSTRAP_ADMIN_PHONE,
        hash,
      ],
    );
    await db.query(
      "INSERT INTO audit_history(actor_id,action) VALUES($1,'admin.bootstrapped')",
      [result.rows[0].id],
    );
  });
  console.log(
    "Administrator created. Remove bootstrap credentials from your environment.",
  );
} catch (e) {
  console.error(
    e instanceof z.ZodError
      ? "Set all BOOTSTRAP_ADMIN_* variables documented in README; password must contain 16–128 characters."
      : e instanceof Error
        ? e.message
        : "Bootstrap failed.",
  );
  process.exitCode = 1;
} finally {
  await pool.end();
}
