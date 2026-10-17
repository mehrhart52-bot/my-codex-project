import { test } from "node:test";
import assert from "node:assert/strict";
import {
  client,
  database,
  signup,
  rpc,
  denied,
  requestArgs,
} from "../support/lab";

test("real Supabase Auth, permissions, inventory, audit, and concurrent pledges", async (t) => {
  const db = await database();
  try {
    const admin = await signup();
    const worker = await signup("social_worker");
    const unrelated = await signup("social_worker");
    const supporter = await signup();
    const other = await signup();
    await db.query(
      "update public.profiles set role='admin', approved=true where id=$1",
      [admin.id],
    );
    let request: { id: string; number: string };
    let items: { id: string; quantity: number }[];
    let pledge: string;

    await t.test(
      "registration, password login, and pending worker approval",
      async () => {
        const fakeAdmin = await signup("admin");
        const profile = await fakeAdmin.api
          .from("profiles")
          .select("role,approved")
          .single();
        assert.equal(profile.data?.role, "supporter");
        assert.equal(profile.data?.approved, true);
        await denied(
          worker.api,
          "create_request",
          requestArgs,
          /Only approved social workers/,
        );
        const wrongLogin = await client().auth.signInWithPassword({
          email: supporter.email,
          password: "incorrect-test-password",
        });
        assert.ok(wrongLogin.error);
        const correctLogin = await client().auth.signInWithPassword(supporter);
        assert.equal(correctLogin.error, null);
        await rpc(admin.api, "update_user_permissions", {
          p_user_id: worker.id,
          p_role: "social_worker",
          p_approved: true,
          p_active: true,
        });
        await rpc(admin.api, "update_user_permissions", {
          p_user_id: unrelated.id,
          p_role: "social_worker",
          p_approved: true,
          p_active: true,
        });
        assert.ok(
          (await rpc(admin.api, "admin_users")).some(
            (u: { id: string }) => u.id === worker.id,
          ),
        );
      },
    );

    await t.test(
      "request creation and dashboard totals after pledge and partial delivery",
      async () => {
        request = await rpc(worker.api, "create_request", requestArgs);
        items = (
          await rpc(worker.api, "request_details", { p_request_id: request.id })
        ).items;
        await rpc(supporter.api, "commit_items", {
          p_request_id: request.id,
          p_selections: [{ itemId: items[0].id, quantity: 3 }],
        });
        pledge = (await rpc(supporter.api, "my_commitments"))[0].id;
        let rows = await rpc(supporter.api, "list_requests", {
          p_status: "all",
          p_search: request.number,
        });
        assert.equal(rows.length, 1);
        assert.deepEqual(
          [rows[0].needed, rows[0].committed, rows[0].received],
          ["6", "3", "0"],
        );
        await rpc(worker.api, "receive_items", {
          p_commitment_id: pledge,
          p_quantity: 1,
        });
        rows = await rpc(worker.api, "list_requests", {
          p_status: "all",
          p_search: request.number,
        });
        assert.deepEqual(
          [rows[0].needed, rows[0].committed, rows[0].received],
          ["6", "3", "1"],
        );
        const receipts = await db.query(
          "select quantity from public.receipts where commitment_id=$1",
          [pledge],
        );
        assert.equal(receipts.rows[0].quantity, 1);
      },
    );

    await t.test(
      "ownership, role enforcement, and private information at the API boundary",
      async () => {
        for (const api of [supporter.api, other.api, unrelated.api]) {
          const details = await rpc(api, "request_details", {
            p_request_id: request.id,
          });
          assert.equal(details.request.narrative, null);
          assert.equal(details.request.owner_name, "");
          assert.equal(details.history.length, 0);
          assert.ok(
            details.commitments.every(
              (c: { supporter_id: string; email: unknown; phone: unknown }) =>
                c.supporter_id === supporter.id &&
                api === supporter.api &&
                c.email === null &&
                c.phone === null,
            ),
          );
          await denied(
            api,
            "receive_items",
            { p_commitment_id: pledge, p_quantity: 1 },
            /cannot record receipts/,
          );
          await denied(
            api,
            "change_request_status",
            { p_request_id: request.id, p_status: "closed" },
            /cannot close/,
          );
          await denied(
            api,
            "edit_request",
            {
              p_request_id: request.id,
              p_summary: requestArgs.p_summary,
              p_narrative: requestArgs.p_narrative,
              p_items: items.map((i) => ({ id: i.id, quantity: i.quantity })),
              p_new_items: [],
            },
            /cannot edit/,
          );
          await denied(
            api,
            "update_user_permissions",
            {
              p_user_id: api === unrelated.api ? unrelated.id : supporter.id,
              p_role: "admin",
              p_approved: true,
              p_active: true,
            },
            /Administrator access required/,
          );
        }
        assert.ok(
          (
            await rpc(worker.api, "request_details", {
              p_request_id: request.id,
            })
          ).request.narrative.includes("PRIVATE-TEST"),
        );
        assert.equal(
          (
            await rpc(admin.api, "request_details", {
              p_request_id: request.id,
            })
          ).commitments[0].email,
          supporter.email,
        );
        await denied(
          other.api,
          "reduce_commitment",
          { p_commitment_id: pledge, p_quantity: 1 },
          /cannot manage/,
        );
        await denied(
          worker.api,
          "commit_items",
          {
            p_request_id: request.id,
            p_selections: [{ itemId: items[1].id, quantity: 1 }],
          },
          /Only supporters/,
        );
        for (const table of [
          "requests",
          "request_items",
          "commitments",
          "receipts",
          "audit_history",
        ]) {
          assert.ok(
            (await supporter.api.from(table).select("*")).error,
            "Private table reads must be denied",
          );
        }
        const profiles = await supporter.api.from("profiles").select("id");
        assert.deepEqual(
          profiles.data?.map((p) => p.id),
          [supporter.id],
        );
        assert.ok(
          (
            await supporter.api
              .from("profiles")
              .update({ role: "admin" })
              .eq("id", supporter.id)
          ).error,
        );
        assert.ok(
          (await client().rpc("list_requests")).error,
          "Anonymous callers must be denied",
        );
      },
    );

    await t.test(
      "reduction, cancellation, over-receipt rejection, and atomic multi-item pledges",
      async () => {
        await denied(
          worker.api,
          "receive_items",
          { p_commitment_id: pledge, p_quantity: 3 },
          /exceeds the remaining/,
        );
        await denied(
          supporter.api,
          "reduce_commitment",
          { p_commitment_id: pledge, p_quantity: 0 },
          /quantity already received/,
        );
        await rpc(supporter.api, "reduce_commitment", {
          p_commitment_id: pledge,
          p_quantity: 1,
        });
        const own = (await rpc(supporter.api, "my_commitments")).find(
          (c: { id: string }) => c.id === pledge,
        );
        assert.deepEqual(
          [own.quantity, own.received, own.status],
          [1, 1, "received"],
        );
        await denied(
          other.api,
          "commit_items",
          {
            p_request_id: request.id,
            p_selections: [
              { itemId: items[1].id, quantity: 1 },
              { itemId: items[0].id, quantity: 4 },
            ],
          },
          /no longer available/,
        );
        assert.equal(
          (await rpc(other.api, "my_commitments")).length,
          0,
          "Failed batch must reserve nothing",
        );
        await rpc(other.api, "commit_items", {
          p_request_id: request.id,
          p_selections: [{ itemId: items[1].id, quantity: 2 }],
        });
        const cancel = (await rpc(other.api, "my_commitments"))[0];
        await rpc(other.api, "reduce_commitment", {
          p_commitment_id: cancel.id,
          p_quantity: 0,
        });
        assert.equal(
          (await rpc(other.api, "my_commitments"))[0].status,
          "cancelled",
        );
      },
    );

    await t.test(
      "closure, closed-request protection, administrator reopening, and audit records",
      async () => {
        await rpc(worker.api, "change_request_status", {
          p_request_id: request.id,
          p_status: "closed",
        });
        await denied(
          supporter.api,
          "commit_items",
          {
            p_request_id: request.id,
            p_selections: [{ itemId: items[1].id, quantity: 1 }],
          },
          /closed/,
        );
        await denied(
          worker.api,
          "change_request_status",
          { p_request_id: request.id, p_status: "open" },
          /Only an administrator/,
        );
        await rpc(admin.api, "change_request_status", {
          p_request_id: request.id,
          p_status: "open",
        });
        assert.equal(
          (
            await rpc(worker.api, "request_details", {
              p_request_id: request.id,
            })
          ).request.status,
          "open",
        );
        const audit = await rpc(admin.api, "admin_audit");
        assert.ok(
          audit.some(
            (a: { action: string }) => a.action === "request.reopened",
          ),
        );
        await denied(
          supporter.api,
          "admin_audit",
          {},
          /Administrator access required/,
        );
      },
    );

    await t.test(
      "competing real API transactions cannot pledge the same remaining item",
      async () => {
        const race = await rpc(worker.api, "create_request", {
          ...requestArgs,
          p_items: [{ catalogId: 13, quantity: 1 }],
        });
        const item = (
          await rpc(worker.api, "request_details", { p_request_id: race.id })
        ).items[0];
        await db.query("begin");
        await db.query(
          "select id from public.requests where id=$1 for update",
          [race.id],
        );
        const args = {
          p_request_id: race.id,
          p_selections: [{ itemId: item.id, quantity: 1 }],
        };
        // Start both HTTP requests while the row is locked, then prove both reached PostgreSQL.
        const a = Promise.resolve(supporter.api.rpc("commit_items", args));
        const b = Promise.resolve(other.api.rpc("commit_items", args));
        let waiting = false;
        const deadline = Date.now() + 10000;
        while (Date.now() < deadline) {
          // PostgreSQL caches activity statistics within our lock-holding transaction.
          await db.query("select pg_stat_clear_snapshot()");
          const active = await db.query(
            "select count(*)::int n from pg_stat_activity where wait_event_type='Lock' and query like '%commit_items%'",
          );
          if (active.rows[0].n >= 2) {
            waiting = true;
            break;
          }
          await new Promise((resolve) => setTimeout(resolve, 25));
        }
        await db.query("commit");
        const results = await Promise.all([a, b]);
        assert.ok(waiting, "Both competing transactions must actually overlap");
        assert.equal(results.filter((r) => !r.error).length, 1);
        assert.match(
          results.find((r) => r.error)!.error!.message,
          /no longer available/,
        );
        const detail = await rpc(worker.api, "request_details", {
          p_request_id: race.id,
        });
        assert.equal(detail.items[0].committed, 1);
        assert.equal(detail.commitments.length, 1);
      },
    );

    await t.test(
      "deactivation takes effect for an existing authenticated session",
      async () => {
        await rpc(admin.api, "update_user_permissions", {
          p_user_id: other.id,
          p_role: "supporter",
          p_approved: true,
          p_active: false,
        });
        await denied(other.api, "list_requests", {}, /active account/);
      },
    );
  } finally {
    await db.query("rollback");
    await db.end();
  }
});
