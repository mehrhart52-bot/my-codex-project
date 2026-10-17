import { createHash } from "node:crypto";
import { z } from "zod";
import { pool, transaction } from "./db";
import { hashPassword, verifyPassword } from "./password";
import { RuleError, audit } from "./service";
const email = z.email().trim().toLowerCase().max(254);
export const registration = z
  .object({
    firstName: z.string().trim().min(1).max(80),
    lastName: z.string().trim().min(1).max(80),
    email,
    phone: z
      .string()
      .trim()
      .min(7)
      .max(30)
      .regex(/^[+\d().\s-]+$/, "Enter a valid phone number."),
    role: z.enum(["supporter", "social_worker"]),
    password: z
      .string()
      .min(12, "Use at least 12 characters for your password.")
      .max(128),
    confirmPassword: z.string(),
  })
  .refine((v) => v.password === v.confirmPassword, {
    message: "Passwords must match.",
    path: ["confirmPassword"],
  });
export async function throttle(
  scope: string,
  value: string,
  limit: number,
  minutes = 15,
) {
  const key = createHash("sha256").update(`${scope}:${value}`).digest("hex");
  const { rows } = await pool.query(
    `INSERT INTO login_limits(key,attempts,reset_at) VALUES($1,1,now()+$2*interval '1 minute') ON CONFLICT(key) DO UPDATE SET attempts=CASE WHEN login_limits.reset_at<=now() THEN 1 ELSE login_limits.attempts+1 END,reset_at=CASE WHEN login_limits.reset_at<=now() THEN now()+$2*interval '1 minute' ELSE login_limits.reset_at END RETURNING attempts`,
    [key, minutes],
  );
  if (rows[0].attempts > limit)
    throw new RuleError("Too many attempts. Please try again later.");
}
export async function register(input: unknown) {
  const data = registration.parse(input);
  await throttle("registration-email", data.email, 5, 60);
  const hash = await hashPassword(data.password);
  return transaction(async (db) => {
    const { rows } = await db.query(
      "INSERT INTO users(first_name,last_name,email,phone,role,approved,password_hash) VALUES($1,$2,$3,$4,$5,$6,$7) ON CONFLICT(email) DO NOTHING RETURNING id",
      [
        data.firstName,
        data.lastName,
        data.email,
        data.phone,
        data.role,
        data.role === "supporter",
        hash,
      ],
    );
    if (!rows[0])
      throw new RuleError(
        "Unable to create this account. Try signing in or contact an administrator.",
      );
    await audit(db, rows[0].id, "account.registered", null, {
      requestedRole: data.role,
    });
    return rows[0].id as string;
  });
}
export async function authenticate(
  emailInput: unknown,
  passwordInput: unknown,
) {
  const address = email.parse(emailInput);
  const password = z.string().min(1).max(128).parse(passwordInput);
  await throttle("login", address, 10);
  const { rows } = await pool.query(
    "SELECT id,password_hash,active FROM users WHERE email=$1",
    [address],
  );
  // Exercise the same password KDF even when an account does not exist.
  const fallback = "scrypt:00000000000000000000000000000000:" + "00".repeat(64);
  const valid = await verifyPassword(
    password,
    rows[0]?.password_hash ?? fallback,
  );
  if (!valid || !rows[0]?.active)
    throw new RuleError("Email or password is incorrect.");
  return rows[0].id as string;
}
