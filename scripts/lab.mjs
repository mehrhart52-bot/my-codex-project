// Optional developer test lab. Never connects to a hosted/shared database.
import { spawnSync, spawn } from "node:child_process";
import {
  readFileSync,
  writeFileSync,
  mkdirSync,
  existsSync,
  chmodSync,
} from "node:fs";
import { resolve } from "node:path";
import { randomBytes } from "node:crypto";
import pg from "pg";
import { createClient } from "@supabase/supabase-js";

mkdirSync(".local", { recursive: true, mode: 0o700 });
const mode = process.argv[2] ?? "setup";
const cli = resolve("node_modules/.bin/supabase");
const env = {
  ...process.env,
  SUPABASE_HOME: process.env.SUPABASE_HOME ?? resolve(".local/supabase-home"),
  SUPABASE_TELEMETRY_DISABLED: "1",
  SUPABASE_USE_SLIM_IMAGES: "true",
};
function command(args) {
  const result = spawnSync(cli, args, {
    env,
    encoding: "utf8",
    maxBuffer: 20 * 1024 * 1024,
  });
  if (result.status !== 0) {
    writeFileSync(".local/lab-error.log", result.stderr + result.stdout, {
      mode: 0o600,
    });
    throw new Error(
      "Local Supabase command failed. Details are in .local/lab-error.log (may contain local credentials).",
    );
  }
  return result.stdout;
}

if (mode === "stop") {
  command(["stop"]);
  console.log("Local Supabase stopped; its data is retained.");
} else {
  if (mode === "setup") {
    console.log(
      "Starting the isolated Supabase test lab. First run downloads container images.",
    );
    // Keep failed containers available for diagnosis; readiness is verified below.
    // Do not treat the CLI's zero exit status as a successful service check.
    command(["start", "--ignore-health-check"]);
    const authContainer = "supabase_auth_hta-fictional-development";
    const health = spawnSync(
      "docker",
      ["inspect", "--format", "{{json .State.Health}}", authContainer],
      { encoding: "utf8" },
    );
    if (health.status !== 0)
      throw new Error("Local Auth container was not created.");
    const status = JSON.parse(health.stdout);
    if (
      status.Status !== "healthy" &&
      status.Log?.some((entry) => entry.Output.includes("403 Forbidden"))
    ) {
      // Repair only the exact loopback health probe; all external traffic retains its proxy.
      chmodSync("scripts/local-auth-healthcheck.sh", 0o755);
      const repair = spawnSync(
        "docker",
        [
          "cp",
          "scripts/local-auth-healthcheck.sh",
          authContainer + ":/usr/local/bin/wget",
        ],
        { encoding: "utf8" },
      );
      if (repair.status !== 0)
        throw new Error(
          "Could not install the local Auth health-check workaround.",
        );
    }
    const deadline = Date.now() + 30000;
    let healthy = false;
    while (Date.now() < deadline) {
      const checks = ["auth", "db", "kong", "inbucket"].map((service) =>
        spawnSync(
          "docker",
          [
            "inspect",
            "--format",
            "{{.State.Health.Status}}",
            `supabase_${service}_hta-fictional-development`,
          ],
          { encoding: "utf8" },
        ),
      );
      if (
        checks.every(
          (check) => check.status === 0 && check.stdout.trim() === "healthy",
        )
      ) {
        healthy = true;
        break;
      }
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
    if (!healthy)
      throw new Error(
        "Local Supabase health checks failed. Setup is not complete.",
      );
    console.log(
      "Database, Auth, gateway, and local mail services passed their health checks.",
    );
  }
  const settings = JSON.parse(command(["status", "--output", "json"]));
  const dbUrl = new URL(settings.DB_URL);
  const apiUrl = new URL(settings.API_URL);
  if (
    !["127.0.0.1", "localhost"].includes(dbUrl.hostname) ||
    dbUrl.port !== "54322" ||
    !["127.0.0.1", "localhost"].includes(apiUrl.hostname) ||
    apiUrl.port !== "54321"
  ) {
    throw new Error(
      "Refusing to use anything except the configured local test stack.",
    );
  }
  writeFileSync(".local/test-stack.json", JSON.stringify(settings), {
    mode: 0o600,
  });
  chmodSync(".local/test-stack.json", 0o600);
  if (mode === "dev") {
    const child = spawn(
      process.execPath,
      ["scripts/dev.mjs", ...process.argv.slice(3)],
      {
        stdio: "inherit",
        env: {
          ...process.env,
          NEXT_PUBLIC_SUPABASE_URL: settings.API_URL,
          NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: settings.ANON_KEY,
        },
      },
    );
    for (const signal of ["SIGINT", "SIGTERM"])
      process.on(signal, () => child.kill(signal));
    child.on("exit", (code) => process.exit(code ?? 0));
  } else if (mode === "setup" || mode === "apply") {
    const db = new pg.Client({ connectionString: settings.DB_URL });
    await db.connect();
    try {
      await db.query("begin");
      await db.query(readFileSync("supabase/schema.sql", "utf8"));
      await db.query("NOTIFY pgrst, 'reload schema'");
      await db.query("commit");
      console.log(
        "Current application schema applied to the isolated local database.",
      );
      if (mode === "setup") {
        const client = createClient(
          settings.API_URL,
          settings.SERVICE_ROLE_KEY,
          { auth: { persistSession: false } },
        );
        const file = ".local/demo-accounts.json";
        const accounts = existsSync(file)
          ? JSON.parse(readFileSync(file, "utf8"))
          : {};
        for (const role of ["admin", "worker", "supporter", "other"]) {
          if (accounts[role]) {
            const found = await db.query(
              "select id from public.profiles where id=$1 and email=$2",
              [accounts[role].id, accounts[role].email],
            );
            if (found.rows.length) continue;
          }
          const email = accounts[role]?.email ?? `demo-${role}@example.test`;
          const password =
            accounts[role]?.password ?? randomBytes(24).toString("base64url");
          const { data, error } = await client.auth.admin.createUser({
            email,
            password,
            email_confirm: true,
            user_metadata: {
              first_name: "Demo",
              last_name: role,
              phone: "315-555-0100",
              requested_role: role === "worker" ? "social_worker" : "supporter",
            },
          });
          if (error)
            throw new Error(
              "Could not seed a demo account. Existing accounts were not overwritten.",
            );
          await db.query(
            "update public.profiles set role=$1, approved=true where id=$2",
            [
              role === "worker"
                ? "social_worker"
                : role === "admin"
                  ? "admin"
                  : "supporter",
              data.user.id,
            ],
          );
          accounts[role] = { email, password, id: data.user.id };
          writeFileSync(file, JSON.stringify(accounts, null, 2), {
            mode: 0o600,
          });
        }
        chmodSync(file, 0o600);
        const worker = createClient(settings.API_URL, settings.ANON_KEY, {
          auth: { persistSession: false },
        });
        const login = await worker.auth.signInWithPassword(accounts.worker);
        if (login.error) throw new Error("Demo worker sign-in failed.");
        const { rows } = await db.query(
          "select id from public.requests where summary=$1",
          [
            "Fictional practice household: two chairs and a lamp for a fresh start.",
          ],
        );
        if (!rows.length) {
          const { rows: catalogRows } = await db.query(
            "select id, name from public.catalog where name = any($1::text[])",
            [["Dining Chairs", "Lamp"]],
          );
          const catalogIds = Object.fromEntries(
            catalogRows.map((item) => [item.name, item.id]),
          );
          if (!catalogIds["Dining Chairs"] || !catalogIds.Lamp)
            throw new Error("Demo request catalog items are missing.");
          const result = await worker.rpc("create_request", {
            p_summary:
              "Fictional practice household: two chairs and a lamp for a fresh start.",
            p_narrative:
              "Fictional private context for the assigned worker. No real client information.",
            p_items: [
              { catalogId: catalogIds["Dining Chairs"], quantity: 2 },
              { catalogId: catalogIds.Lamp, quantity: 1 },
            ],
          });
          if (result.error)
            throw new Error(
              "Demo request creation failed: " + result.error.message,
            );
        }
        console.log(
          "Fictional demo accounts and practice request are ready. Credentials: .local/demo-accounts.json",
        );
      }
    } finally {
      await db.end();
    }
  } else throw new Error("Use setup, apply, dev, or stop.");
}
