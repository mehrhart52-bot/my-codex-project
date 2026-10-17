import { readFileSync } from "node:fs";
import { randomBytes, randomUUID } from "node:crypto";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import pg from "pg";
import assert from "node:assert/strict";

export function settings() {
  let config;
  try {
    config = JSON.parse(readFileSync(".local/test-stack.json", "utf8"));
  } catch {
    throw new Error(
      "Test lab is not configured. Run npm run lab:setup first. No tests were skipped.",
    );
  }
  for (const [field, port] of [
    ["API_URL", "54321"],
    ["DB_URL", "54322"],
  ]) {
    const url = new URL(config[field]);
    assert.ok(
      ["localhost", "127.0.0.1"].includes(url.hostname) && url.port === port,
      "Tests refuse hosted/shared databases",
    );
  }
  return config;
}
export function client() {
  const config = settings();
  return createClient(config.API_URL, config.ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
export async function database() {
  const db = new pg.Client({ connectionString: settings().DB_URL });
  await db.connect();
  return db;
}
export function identity(role = "supporter") {
  return {
    email: `test-${randomUUID()}@example.com`,
    password: randomBytes(24).toString("base64url"),
    role,
  };
}
export async function signup(role = "supporter") {
  const account = identity(role);
  const api = client();
  const { data, error } = await api.auth.signUp({
    email: account.email,
    password: account.password,
    options: {
      data: {
        first_name: "Fictional",
        last_name: role,
        phone: "315-555-0109",
        requested_role: role,
      },
    },
  });
  assert.equal(error, null, "Real Supabase signup must succeed");
  assert.ok(
    data.session,
    "The local test lab must have email confirmation disabled",
  );
  return { ...account, id: data.user!.id, api };
}
export async function rpc(
  api: SupabaseClient,
  name: string,
  args: Record<string, unknown> = {},
) {
  const { data, error } = await api.rpc(name, args);
  assert.equal(error, null, `${name}: ${error?.message ?? ""}`);
  return data;
}
export async function denied(
  api: SupabaseClient,
  name: string,
  args: Record<string, unknown>,
  message: RegExp,
) {
  const { error } = await api.rpc(name, args);
  assert.ok(error, `${name} should be denied`);
  assert.match(error.message, message);
}
export const requestArgs = {
  p_summary: "Fictional household needs chairs for a new beginning.",
  p_narrative:
    "PRIVATE-TEST-CONTEXT: fictional sensitive circumstances for the assigned worker.",
  p_items: [
    { catalogId: 15, quantity: 4 },
    { catalogId: 13, quantity: 2 },
  ],
};
