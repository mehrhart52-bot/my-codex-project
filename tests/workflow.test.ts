import { test, before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { pool } from "../lib/db";
import { hashPassword, verifyPassword } from "../lib/password";
import { register, authenticate } from "../lib/accounts";
import {
  createRequest,
  editRequest,
  commitItems,
  receiveItems,
  reduceCommitment,
  changeStatus,
  updateUser,
  requestDetails,
  listRequests,
} from "../lib/service";
import type { User } from "../lib/types";
let admin: User, worker: User, other: User, pending: User, a: User, b: User;
let catalogId: number;
let hash: string;
const password = "test-only-password-927!";
before(async () => {
  assert.ok(new URL(process.env.DATABASE_URL!).pathname.endsWith("_test"));
  hash = await hashPassword(password);
  catalogId = (await pool.query("SELECT id FROM catalog ORDER BY id LIMIT 1"))
    .rows[0].id;
});
beforeEach(async () => {
  await pool.query(
    "TRUNCATE users,requests,request_items,commitments,receipts,audit_history,sessions,login_limits RESTART IDENTITY CASCADE",
  );
  const users: User[] = [];
  for (const [name, role, approved] of [
    ["Admin", "admin", true],
    ["Worker", "social_worker", true],
    ["Other", "social_worker", true],
    ["Pending", "social_worker", false],
    ["Alice", "supporter", true],
    ["Bob", "supporter", true],
  ]) {
    const { rows } = await pool.query(
      "INSERT INTO users(first_name,last_name,email,phone,password_hash,role,approved) VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING *",
      [
        name,
        "Test",
        `${String(name).toLowerCase()}@example.test`,
        "3155550100",
        hash,
        role,
        approved,
      ],
    );
    users.push(rows[0]);
  }
  [admin, worker, other, pending, a, b] = users;
});
after(async () => {
  await pool.end();
});
async function fixture(quantity = 4) {
  const r = await createRequest(worker, {
    summary: "A fictional household needs a bed.",
    narrative: "Private narrative: only for the assigned worker.",
    items: [{ catalogId, quantity }],
  });
  const item = (
    await pool.query("SELECT id FROM request_items WHERE request_id=$1", [r.id])
  ).rows[0].id as string;
  return { ...r, item };
}
async function commitment(item: string, supporter = a) {
  return (
    await pool.query(
      "SELECT * FROM commitments WHERE item_id=$1 AND supporter_id=$2 ORDER BY id DESC",
      [item, supporter.id],
    )
  ).rows[0];
}
test("passwords are salted and verified without plaintext storage", async () => {
  assert.notEqual(hash, password);
  assert.equal(await verifyPassword(password, hash), true);
  assert.equal(await verifyPassword("incorrect", hash), false);
  assert.notEqual(await hashPassword(password), hash);
});
test("registration validates all fields and does not allow admin self-registration", async () => {
  const input = {
    firstName: "New",
    lastName: "Neighbor",
    email: "new@example.test",
    phone: "3155550101",
    role: "social_worker",
    password,
    confirmPassword: password,
  };
  const id = await register(input);
  const u = (await pool.query("SELECT * FROM users WHERE id=$1", [id])).rows[0];
  assert.equal(u.approved, false);
  await assert.rejects(
    register({ ...input, email: "bad@example.test", role: "admin" }),
  );
  await assert.rejects(
    register({
      ...input,
      email: "other@example.test",
      confirmPassword: "mismatch",
    }),
  );
  await assert.rejects(
    register({ ...input, email: "another@example.test", phone: "" }),
  );
  assert.equal(await authenticate(input.email, password), id);
  await assert.rejects(authenticate(input.email, "incorrect"));
  await assert.rejects(register(input));
});
test("login is throttled and inactive accounts cannot authenticate", async () => {
  for (let i = 0; i < 10; i++)
    await assert.rejects(authenticate(a.email, "wrong"));
  await assert.rejects(authenticate(a.email, password), /Too many/);
  await pool.query("UPDATE users SET active=false WHERE id=$1", [b.id]);
  await assert.rejects(authenticate(b.email, password), /incorrect/);
});
test("pending staff and supporters cannot create; administrators approve staff", async () => {
  const input = {
    summary: "A fictional household needs a bed.",
    narrative: "Private context for this request.",
    items: [{ catalogId, quantity: 1 }],
  };
  await assert.rejects(createRequest(pending, input), /approved/);
  await assert.rejects(createRequest(a, input), /approved/);
  await assert.rejects(
    updateUser(a, pending.id, "social_worker", true, true),
    /Administrator/,
  );
  await updateUser(admin, pending.id, "social_worker", true, true);
  assert.ok((await createRequest(pending, input)).number.startsWith("HTA-"));
});
test("private narratives and supporter contact information stay scoped", async () => {
  const r = await fixture();
  await commitItems(a, r.id, [{ itemId: r.item, quantity: 1 }]);
  const own = await requestDetails(worker, r.id);
  assert.match(own!.request.narrative!, /Private/);
  assert.equal(own!.commitments[0].email, a.email);
  for (const u of [a, b, other, pending]) {
    const d = await requestDetails(u, r.id);
    assert.equal(d!.request.narrative, null);
    assert.ok(d!.commitments.every((c) => c.email === null));
    if (u.id !== a.id) assert.equal(d!.commitments.length, 0);
  }
  const list = await listRequests(a, "all", "");
  assert.ok(list.every((r) => !("narrative" in r)));
  await assert.rejects(
    receiveItems(other, (await commitment(r.item)).id, 1),
    /cannot/,
  );
});
test("concurrent supporters cannot reserve more than the available quantity", async () => {
  const r = await fixture(1);
  const results = await Promise.allSettled([
    commitItems(a, r.id, [{ itemId: r.item, quantity: 1 }]),
    commitItems(b, r.id, [{ itemId: r.item, quantity: 1 }]),
  ]);
  assert.equal(results.filter((x) => x.status === "fulfilled").length, 1);
  assert.equal(
    (await pool.query("SELECT sum(quantity)::integer AS n FROM commitments"))
      .rows[0].n,
    1,
  );
});
test("database guard rejects direct SQL overcommitment", async () => {
  const r = await fixture(1);
  const results = await Promise.allSettled([
    pool.query(
      "INSERT INTO commitments(item_id,supporter_id,quantity) VALUES($1,$2,1)",
      [r.item, a.id],
    ),
    pool.query(
      "INSERT INTO commitments(item_id,supporter_id,quantity) VALUES($1,$2,1)",
      [r.item, b.id],
    ),
  ]);
  assert.equal(results.filter((x) => x.status === "fulfilled").length, 1);
  await assert.rejects(
    pool.query("UPDATE request_items SET quantity=0 WHERE id=$1", [r.item]),
  );
});
test("multi-item commitments are atomic when one quantity is unavailable", async () => {
  const r = await fixture(2);
  const second = (
    await pool.query(
      "INSERT INTO request_items(request_id,catalog_id,name,quantity) VALUES($1,$2,$3,1) RETURNING id",
      [r.id, catalogId, "Second item"],
    )
  ).rows[0].id;
  await commitItems(b, r.id, [{ itemId: second, quantity: 1 }]);
  await assert.rejects(
    commitItems(a, r.id, [
      { itemId: r.item, quantity: 1 },
      { itemId: second, quantity: 1 },
    ]),
    /available/,
  );
  assert.equal(
    (
      await pool.query(
        "SELECT count(*)::integer AS n FROM commitments WHERE supporter_id=$1",
        [a.id],
      )
    ).rows[0].n,
    0,
  );
});
test("partial receipts, reduction, cancellation, and availability reconcile", async () => {
  const r = await fixture();
  await commitItems(a, r.id, [{ itemId: r.item, quantity: 4 }]);
  let c = await commitment(r.item);
  await receiveItems(worker, c.id, 1);
  c = await commitment(r.item);
  assert.equal(c.received, 1);
  assert.equal(c.status, "committed");
  await assert.rejects(reduceCommitment(a, c.id, 0), /already received/);
  await assert.rejects(reduceCommitment(b, c.id, 1), /cannot/);
  await reduceCommitment(a, c.id, 2);
  await commitItems(b, r.id, [{ itemId: r.item, quantity: 2 }]);
  const d = await requestDetails(worker, r.id);
  assert.equal(d!.items[0].committed, 4);
  assert.equal(d!.items[0].received, 1);
  await reduceCommitment(b, (await commitment(r.item, b)).id, 0);
  assert.equal((await commitment(r.item, b)).status, "cancelled");
  await receiveItems(worker, c.id, 1);
  assert.equal((await commitment(r.item)).status, "received");
  await assert.rejects(reduceCommitment(a, c.id, 1), /unreceived/);
  const receipts = await pool.query(
    "SELECT sum(quantity)::integer AS n FROM receipts",
  );
  assert.equal(receipts.rows[0].n, 2);
});
test("concurrent receipts cannot record the same delivered item twice", async () => {
  const r = await fixture(1);
  await commitItems(a, r.id, [{ itemId: r.item, quantity: 1 }]);
  const c = await commitment(r.item);
  const results = await Promise.allSettled([
    receiveItems(worker, c.id, 1),
    receiveItems(worker, c.id, 1),
  ]);
  assert.equal(results.filter((x) => x.status === "fulfilled").length, 1);
  assert.equal(
    (await pool.query("SELECT sum(quantity)::integer AS n FROM receipts"))
      .rows[0].n,
    1,
  );
});
test("closure requires authorization and confirmation, blocks commitments, preserves history; only admin reopens", async () => {
  const r = await fixture();
  await commitItems(a, r.id, [{ itemId: r.item, quantity: 1 }]);
  await assert.rejects(changeStatus(other, r.id, "closed", true), /cannot/);
  await assert.rejects(changeStatus(worker, r.id, "closed", false), /Confirm/);
  await changeStatus(worker, r.id, "closed", true);
  await assert.rejects(
    commitItems(b, r.id, [{ itemId: r.item, quantity: 1 }]),
    /closed/,
  );
  await assert.rejects(
    receiveItems(worker, (await commitment(r.item)).id, 1),
    /Reopen/,
  );
  await assert.rejects(changeStatus(worker, r.id, "open", true), /cannot/);
  await changeStatus(admin, r.id, "open", true);
  await commitItems(b, r.id, [{ itemId: r.item, quantity: 1 }]);
  assert.equal(
    (await pool.query("SELECT count(*)::integer AS n FROM commitments")).rows[0]
      .n,
    2,
  );
  assert.ok(
    (
      await pool.query(
        "SELECT 1 FROM audit_history WHERE action='request.closed'",
      )
    ).rows.length,
  );
});
test("request numbers are unique under concurrency and validations reject invalid quantities", async () => {
  const rows = await Promise.all(Array.from({ length: 12 }, () => fixture(1)));
  assert.equal(new Set(rows.map((r) => r.number)).size, 12);
  assert.match(rows[0].number, /^HTA-\d{5,}$/);
  await assert.rejects(
    commitItems(a, rows[0].id, [{ itemId: rows[0].item, quantity: 1.5 }]),
  );
  await assert.rejects(
    commitItems(a, rows[0].id, [{ itemId: rows[0].item, quantity: -1 }]),
  );
});
test("edits enforce ownership, preserve item history, and cannot shrink below commitments", async () => {
  const r = await fixture();
  await commitItems(a, r.id, [{ itemId: r.item, quantity: 3 }]);
  const input = {
    summary: "A changed fictional public summary.",
    narrative: "An updated private household narrative.",
    items: [{ id: r.item, quantity: 4 }],
    newItems: [],
  };
  await assert.rejects(editRequest(other, r.id, input), /cannot/);
  await assert.rejects(
    editRequest(worker, r.id, {
      ...input,
      items: [{ id: r.item, quantity: 2 }],
    }),
    /lower/,
  );
  await editRequest(worker, r.id, {
    ...input,
    items: [{ id: r.item, quantity: 5 }],
    newItems: [{ catalogId, quantity: 1 }],
  });
  assert.equal((await requestDetails(worker, r.id))!.items.length, 2);
});
test("revoking approval takes effect even with a stale user object; last active admin stays protected", async () => {
  await updateUser(admin, worker.id, "social_worker", false, true);
  await assert.rejects(fixture(), /approved/);
  await assert.rejects(
    updateUser(admin, admin.id, "supporter", true, true),
    /at least one/,
  );
  await assert.rejects(
    updateUser(admin, admin.id, "admin", true, false),
    /at least one/,
  );
});
