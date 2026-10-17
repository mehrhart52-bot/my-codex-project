import { getIronSession } from "iron-session";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createHash, randomBytes } from "node:crypto";
import { pool } from "./db";
import type { User } from "./types";
const digest = (token: string) =>
  createHash("sha256").update(token).digest("hex");
export async function session() {
  const password = process.env.SESSION_SECRET;
  if (!password || password.length < 32)
    throw Error("SESSION_SECRET must have at least 32 characters.");
  return getIronSession<{ token?: string }>(await cookies(), {
    password,
    cookieName: "hta_session",
    ttl: 60 * 60 * 12,
    cookieOptions: {
      secure: process.env.NODE_ENV === "production",
      httpOnly: true,
      sameSite: "lax",
      path: "/",
    },
  });
}
export async function currentUser(): Promise<User | null> {
  const s = await session();
  if (!s.token) return null;
  const { rows } = await pool.query(
    "SELECT u.id,u.first_name,u.last_name,u.email,u.phone,u.role,u.approved,u.active FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token_hash=$1 AND s.expires_at>now() AND u.active=true",
    [digest(s.token)],
  );
  return rows[0] ?? null;
}
export async function requireUser() {
  const u = await currentUser();
  if (!u) redirect("/login");
  return u;
}
export async function signIn(id: string) {
  const s = await session();
  if (s.token)
    await pool.query("DELETE FROM sessions WHERE token_hash=$1", [
      digest(s.token),
    ]);
  s.token = randomBytes(32).toString("hex");
  await pool.query(
    "INSERT INTO sessions(token_hash,user_id,expires_at) VALUES($1,$2,now()+interval '12 hours')",
    [digest(s.token), id],
  );
  await s.save();
}
export async function signOut() {
  const s = await session();
  if (s.token)
    await pool.query("DELETE FROM sessions WHERE token_hash=$1", [
      digest(s.token),
    ]);
  s.destroy();
}
