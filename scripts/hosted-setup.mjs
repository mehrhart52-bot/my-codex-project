// Operator-assisted setup of an explicitly authorized EMPTY development project.
// The management token stays in secure environment settings, never in the app.
import { spawnSync } from "node:child_process";
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { randomBytes } from "node:crypto";
import { createClient } from "@supabase/supabase-js";

const token =
  process.env.SUPABASE_SETUP_TOKEN ?? process.env.SUPABASE_ACCESS_TOKEN;
if (!token)
  throw new Error(
    "Supply SUPABASE_SETUP_TOKEN through secure environment settings, never chat.",
  );
async function management(path, method = "GET", body) {
  // curl uses the cloud's supported HTTPS proxy and secret substitution.
  // Put the authorization header on stdin, not in process arguments or logs.
  if (/[\r\n"]/.test(token)) throw new Error("Invalid management token.");
  const args = [
    "--silent",
    "--show-error",
    "--fail-with-body",
    "--config",
    "-",
    "--request",
    method,
    "--header",
    "Content-Type: application/json",
    "https://api.supabase.com/v1" + path,
  ];
  if (body !== undefined) {
    mkdirSync(".local", { recursive: true, mode: 0o700 });
    writeFileSync(".local/management-body.json", JSON.stringify(body), {
      mode: 0o600,
    });
    args.push("--data-binary", "@.local/management-body.json");
  }
  const result = spawnSync("curl", args, {
    input: `header = "Authorization: Bearer ${token}"\n`,
    encoding: "utf8",
    maxBuffer: 10 * 1024 * 1024,
  });
  if (result.status !== 0)
    throw new Error(
      "Supabase management request failed (details withheld to protect credentials). Check project access and secure token configuration.",
    );
  return result.stdout ? JSON.parse(result.stdout) : null;
}
const projects = await management("/projects");
const mode = process.argv[2] ?? "setup";
if (mode === "list") {
  console.log(
    JSON.stringify(
      projects.map((p) => ({
        ref: p.id,
        name: p.name,
        region: p.region,
        status: p.status,
      })),
      null,
      2,
    ),
  );
} else {
  const ref = process.env.SUPABASE_PROJECT_REF;
  if (
    !ref ||
    !/^[a-z0-9]{20}$/.test(ref) ||
    !projects.some((p) => p.id === ref)
  )
    throw new Error(
      "Select the exact authorized project via SUPABASE_PROJECT_REF.",
    );
  if (process.env.HTA_AUTHORIZE_EMPTY_DEV_SETUP !== "yes")
    throw new Error(
      "Explicit authorization for this empty development project is required.",
    );
  const query = (sql) =>
    management(`/projects/${ref}/database/query`, "POST", { query: sql });
  const existing = await query(
    "select (select count(*) from information_schema.tables where table_schema='public' and table_type='BASE TABLE')::int as tables, (select count(*) from auth.users)::int as users;",
  );
  if (mode === "setup") {
    if (existing[0].tables !== 0 || existing[0].users !== 0)
      throw new Error(
        "Project is not empty. Stopped without changes; inspect before applying an update.",
      );
    // Single transaction: a schema error rolls back all application objects.
    await query(
      "begin;\n" +
        readFileSync("supabase/schema.sql", "utf8") +
        "\nNOTIFY pgrst, 'reload schema';\ncommit;",
    );
  } else if (mode === "resume") {
    const installed = await query(
      "select count(*)::int as tables from information_schema.tables where table_schema='public' and table_name in ('profiles','catalog','requests','request_items','commitments','receipts','audit_history');",
    );
    if (installed[0].tables !== 7)
      throw new Error(
        "The expected application schema is incomplete. Stopped before creating accounts.",
      );
  } else {
    throw new Error("Use list, setup, or resume.");
  }
  await management(`/projects/${ref}/config/auth`, "PATCH", {
    site_url: "http://localhost:3000",
    uri_allow_list: "http://localhost:3000/**",
    external_email_enabled: true,
    mailer_autoconfirm: true,
    password_min_length: 12,
  });
  const keys = await management(`/projects/${ref}/api-keys`);
  const key = keys.find((k) => k.name === "anon")?.api_key;
  if (!key)
    throw new Error(
      "Schema applied, but publishable/anon key was not available. Resume by retrieving the public app settings; do not reset the project.",
    );
  const url = `https://${ref}.supabase.co`;
  const envFile = ".env.local";
  if (existsSync(envFile) && !existsSync(".local/env-before-hosted-setup")) {
    writeFileSync(".local/env-before-hosted-setup", readFileSync(envFile), {
      mode: 0o600,
    });
  }
  const lines = existsSync(envFile)
    ? readFileSync(envFile, "utf8")
        .split(/\r?\n/)
        .filter(
          (l) => l && !/^NEXT_PUBLIC_SUPABASE_(URL|PUBLISHABLE_KEY)=/.test(l),
        )
    : [];
  writeFileSync(
    envFile,
    [
      ...lines,
      `NEXT_PUBLIC_SUPABASE_URL=${url}`,
      `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=${key}`,
      "",
    ].join("\n"),
    { mode: 0o600 },
  );
  const accountFile = ".local/hosted-demo-accounts.json";
  const accounts = existsSync(accountFile)
    ? JSON.parse(readFileSync(accountFile, "utf8"))
    : {};
  for (const role of ["admin", "worker", "supporter", "other"]) {
    const email = accounts[role]?.email ?? `demo-${role}@example.com`;
    const password =
      accounts[role]?.password ?? randomBytes(24).toString("base64url");
    accounts[role] ??= { email, password, id: null };
    // Save credentials before the remote call so an interrupted successful
    // registration can be reconciled without inventing a new password.
    writeFileSync(accountFile, JSON.stringify(accounts, null, 2), {
      mode: 0o600,
    });
    const api = createClient(url, key, { auth: { persistSession: false } });
    let data;
    if (accounts[role].id) {
      const login = await api.auth.signInWithPassword({ email, password });
      if (login.error)
        throw new Error(
          `Existing hosted demo ${role} account could not sign in; inspect before retrying.`,
        );
      data = login.data;
    } else {
      const signup = await api.auth.signUp({
        email,
        password,
        options: {
          data: {
            first_name: "Demo",
            last_name: role,
            phone: "315-555-0100",
            requested_role: role === "worker" ? "social_worker" : "supporter",
          },
        },
      });
      if (signup.error)
        throw new Error(
          `Hosted demo ${role} registration failed: ${signup.error.message}`,
        );
      if (!signup.data.session)
        throw new Error(
          "Hosted registration requires email confirmation; stop and inspect Auth configuration.",
        );
      data = signup.data;
    }
    accounts[role] = { email, password, id: data.user.id };
    writeFileSync(accountFile, JSON.stringify(accounts, null, 2), {
      mode: 0o600,
    });
    // UUID is supplied by Auth; strict validation avoids SQL interpolation hazards.
    if (!/^[a-f0-9-]{36}$/.test(data.user.id))
      throw new Error("Unexpected account identifier.");
    await query(
      `update public.profiles set role='${role === "admin" ? "admin" : role === "worker" ? "social_worker" : "supporter"}', approved=true where id='${data.user.id}';`,
    );
    if (role === "worker") {
      const existingRequest = await query(
        `select count(*)::int as requests from public.requests where owner_id='${data.user.id}' and summary='Fictional practice household: two chairs and a lamp for a fresh start.';`,
      );
      if (existingRequest[0].requests === 0) {
        const catalogRows = await query(
          "select id, name from public.catalog where name in ('Dining Chairs', 'Lamp');",
        );
        const catalogIds = Object.fromEntries(
          catalogRows.map((item) => [item.name, item.id]),
        );
        if (!catalogIds["Dining Chairs"] || !catalogIds.Lamp)
          throw new Error("Hosted demo request catalog items are missing.");
        const result = await api.rpc("create_request", {
          p_summary:
            "Fictional practice household: two chairs and a lamp for a fresh start.",
          p_narrative:
            "Fictional private circumstances for the assigned worker. No real client information.",
          p_items: [
            { catalogId: catalogIds["Dining Chairs"], quantity: 2 },
            { catalogId: catalogIds.Lamp, quantity: 1 },
          ],
        });
        if (result.error)
          throw new Error(
            "Hosted demo request failed. Inspect before retrying.",
          );
      }
    }
  }
  console.log(
    "Hosted development setup applied. App settings: .env.local. Fictional credentials: .local/hosted-demo-accounts.json. Browser verification is still required.",
  );
}
