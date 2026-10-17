import { z } from "zod";
import type { PoolClient } from "pg";
import { pool, transaction } from "./db";
import {
  canCreate,
  canManage,
  type User,
  type Item,
  type RequestRow,
  type Commitment,
} from "./types";
export class RuleError extends Error {}
function check(ok: unknown, message: string): asserts ok {
  if (!ok) throw new RuleError(message);
}
const idSchema = z
  .string()
  .regex(/^[1-9]\d*$/)
  .max(18);
export const validId = (id: unknown) => idSchema.parse(id);
const positive = z.number().int().min(1).max(10000);
export const itemInput = z.object({
  catalogId: z.number().int().positive(),
  name: z.string().trim().max(120).optional(),
  quantity: positive,
});
export const requestInput = z.object({
  summary: z
    .string()
    .trim()
    .min(10, "Add a public summary of at least 10 characters.")
    .max(2000),
  narrative: z
    .string()
    .trim()
    .min(10, "Add a private narrative of at least 10 characters.")
    .max(10000),
  items: z.array(itemInput).min(1, "Add at least one household item."),
});
export async function audit(
  db: PoolClient,
  actor: string,
  action: string,
  request: string | null,
  details: Record<string, unknown> = {},
) {
  await db.query(
    "INSERT INTO audit_history(actor_id,action,request_id,details) VALUES($1,$2,$3,$4)",
    [actor, action, request, JSON.stringify(details)],
  );
}
async function actor(db: PoolClient, user: User) {
  // Lock role while writing, so approval changes cannot race a privileged operation.
  const { rows } = await db.query(
    "SELECT id,role,approved,active FROM users WHERE id=$1 FOR SHARE",
    [user.id],
  );
  check(rows[0]?.active, "This account is unavailable.");
  return { ...user, ...rows[0] } as User;
}
async function lockedRequest(db: PoolClient, id: string) {
  const { rows } = await db.query(
    "SELECT * FROM requests WHERE id=$1 FOR UPDATE",
    [validId(id)],
  );
  check(rows[0], "Request not found.");
  return rows[0] as RequestRow;
}
async function insertItems(
  db: PoolClient,
  requestId: string,
  items: z.infer<typeof itemInput>[],
) {
  for (const item of items) {
    const { rows } = await db.query("SELECT name FROM catalog WHERE id=$1", [
      item.catalogId,
    ]);
    check(rows[0], "Choose an item from the catalog.");
    const name = rows[0].name === "Other" ? item.name?.trim() : rows[0].name;
    check(name && name.length <= 120, "Specify the Other item.");
    await db.query(
      "INSERT INTO request_items(request_id,catalog_id,name,quantity) VALUES($1,$2,$3,$4)",
      [requestId, item.catalogId, name, item.quantity],
    );
  }
}
export async function createRequest(user: User, input: unknown) {
  const data = requestInput.parse(input);
  return transaction(async (db) => {
    const u = await actor(db, user);
    check(
      canCreate(u),
      "Only approved social workers and administrators can create requests.",
    );
    const { rows } = await db.query(
      "INSERT INTO requests(owner_id,narrative,summary) VALUES($1,$2,$3) RETURNING id,number",
      [u.id, data.narrative, data.summary],
    );
    await insertItems(db, rows[0].id, data.items);
    await audit(db, u.id, "request.created", rows[0].id);
    return rows[0] as { id: string; number: string };
  });
}
export async function editRequest(user: User, id: string, input: unknown) {
  const data = z
    .object({
      summary: requestInput.shape.summary,
      narrative: requestInput.shape.narrative,
      items: z.array(z.object({ id: idSchema, quantity: positive })),
      newItems: z.array(itemInput).default([]),
    })
    .parse(input);
  return transaction(async (db) => {
    const u = await actor(db, user);
    const r = await lockedRequest(db, id);
    check(canManage(u, r), "You cannot edit this request.");
    check(r.status === "open", "Reopen the request before editing it.");
    const { rows: existing } = await db.query(
      "SELECT id FROM request_items WHERE request_id=$1",
      [id],
    );
    check(
      data.items.length === existing.length &&
        new Set(data.items.map((i) => i.id)).size === existing.length &&
        existing.every((i) => data.items.some((x) => x.id === i.id)),
      "Keep all existing items; quantities can be adjusted.",
    );
    for (const item of data.items) {
      const { rows } = await db.query(
        "SELECT COALESCE(sum(quantity),0)::integer AS n FROM commitments WHERE item_id=$1",
        [item.id],
      );
      check(
        item.quantity >= rows[0].n,
        "Quantity cannot be lower than existing commitments.",
      );
      await db.query(
        "UPDATE request_items SET quantity=$1,updated_at=now() WHERE id=$2",
        [item.quantity, item.id],
      );
    }
    await insertItems(db, id, data.newItems);
    await db.query(
      "UPDATE requests SET summary=$1,narrative=$2,updated_at=now() WHERE id=$3",
      [data.summary, data.narrative, id],
    );
    await audit(db, u.id, "request.edited", id);
  });
}
export async function commitItems(user: User, id: string, input: unknown) {
  const selections = z
    .array(z.object({ itemId: idSchema, quantity: positive }))
    .min(1, "Choose at least one item.")
    .parse(input);
  check(
    new Set(selections.map((s) => s.itemId)).size === selections.length,
    "Choose each item once.",
  );
  return transaction(async (db) => {
    const u = await actor(db, user);
    check(u.role === "supporter", "Only supporters may make commitments.");
    const r = await lockedRequest(db, id);
    check(r.status === "open", "This request is closed.");
    for (const s of selections) {
      const { rows } = await db.query(
        "SELECT i.quantity,COALESCE(sum(c.quantity),0)::integer AS reserved FROM request_items i LEFT JOIN commitments c ON c.item_id=i.id WHERE i.id=$1 AND i.request_id=$2 GROUP BY i.id",
        [s.itemId, id],
      );
      check(
        rows[0] && s.quantity <= rows[0].quantity - rows[0].reserved,
        "An item is no longer available in that quantity. Refresh and try again.",
      );
      await db.query(
        "INSERT INTO commitments(item_id,supporter_id,quantity) VALUES($1,$2,$3)",
        [s.itemId, u.id, s.quantity],
      );
    }
    await audit(db, u.id, "commitment.created", id, { items: selections });
  });
}
export async function reduceCommitment(
  user: User,
  commitmentId: string,
  quantity: number,
) {
  z.number().int().min(0).max(10000).parse(quantity);
  validId(commitmentId);
  return transaction(async (db) => {
    const u = await actor(db, user);
    const { rows: lookup } = await db.query(
      "SELECT i.request_id FROM commitments c JOIN request_items i ON i.id=c.item_id WHERE c.id=$1",
      [commitmentId],
    );
    check(lookup[0], "Commitment not found.");
    const r = await lockedRequest(db, lookup[0].request_id);
    const { rows } = await db.query(
      "SELECT * FROM commitments WHERE id=$1 FOR UPDATE",
      [commitmentId],
    );
    const c = rows[0];
    check(
      c.supporter_id === u.id || u.role === "admin",
      "You cannot manage this commitment.",
    );
    check(
      c.status === "committed",
      "Only commitments with unreceived items can be reduced.",
    );
    check(
      quantity < c.quantity && quantity >= c.received,
      "Reduce the total, keeping at least the quantity already received.",
    );
    const status =
      quantity === 0
        ? "cancelled"
        : quantity === c.received
          ? "received"
          : "committed";
    await db.query(
      "UPDATE commitments SET quantity=$1,status=$2,updated_at=now() WHERE id=$3",
      [quantity, status, commitmentId],
    );
    await audit(
      db,
      u.id,
      quantity === 0 ? "commitment.cancelled" : "commitment.reduced",
      r.id,
      { commitmentId, previous: c.quantity, quantity },
    );
  });
}
export async function receiveItems(
  user: User,
  commitmentId: string,
  quantity: number,
) {
  positive.parse(quantity);
  validId(commitmentId);
  return transaction(async (db) => {
    const u = await actor(db, user);
    const { rows: lookup } = await db.query(
      "SELECT i.request_id FROM commitments c JOIN request_items i ON i.id=c.item_id WHERE c.id=$1",
      [commitmentId],
    );
    check(lookup[0], "Commitment not found.");
    const r = await lockedRequest(db, lookup[0].request_id);
    check(canManage(u, r), "You cannot record receipts for this request.");
    check(r.status === "open", "Reopen the request before recording receipts.");
    const { rows } = await db.query(
      "SELECT * FROM commitments WHERE id=$1 FOR UPDATE",
      [commitmentId],
    );
    const c = rows[0];
    check(
      c.status === "committed" && quantity <= c.quantity - c.received,
      "Receipt exceeds the remaining committed quantity.",
    );
    await db.query(
      "INSERT INTO receipts(commitment_id,quantity,recorded_by) VALUES($1,$2,$3)",
      [commitmentId, quantity, u.id],
    );
    await db.query(
      "UPDATE commitments SET received=received+$1,status=CASE WHEN received+$1=quantity THEN 'received' ELSE 'committed' END,updated_at=now() WHERE id=$2",
      [quantity, commitmentId],
    );
    await audit(db, u.id, "items.received", r.id, { commitmentId, quantity });
  });
}
export async function changeStatus(
  user: User,
  id: string,
  status: "open" | "closed",
  confirmed: boolean,
) {
  check(status === "open" || status === "closed", "Invalid request status.");
  check(confirmed, "Confirm the status change.");
  return transaction(async (db) => {
    const u = await actor(db, user);
    const r = await lockedRequest(db, id);
    check(
      status === "open" ? u.role === "admin" : canManage(u, r),
      "You cannot change this request status.",
    );
    check(r.status !== status, "The request already has that status.");
    await db.query(
      "UPDATE requests SET status=$1,closed_at=CASE WHEN $1='closed' THEN now() ELSE NULL END,updated_at=now() WHERE id=$2",
      [status, id],
    );
    await audit(
      db,
      u.id,
      status === "closed" ? "request.closed" : "request.reopened",
      id,
    );
  });
}
export async function updateUser(
  user: User,
  id: string,
  role: string,
  approved: boolean,
  active: boolean,
) {
  validId(id);
  check(
    ["supporter", "social_worker", "admin"].includes(role),
    "Invalid role.",
  );
  return transaction(async (db) => {
    // Serialize administration, including last-administrator protection.
    await db.query("SELECT pg_advisory_xact_lock(8246792)");
    const u = await actor(db, user);
    check(u.role === "admin", "Administrator access required.");
    const { rows } = await db.query(
      "SELECT * FROM users WHERE id=$1 FOR UPDATE",
      [id],
    );
    check(rows[0], "User not found.");
    if (
      rows[0].role === "admin" &&
      rows[0].active &&
      (role !== "admin" || !active)
    ) {
      const { rows: count } = await db.query(
        "SELECT count(*)::integer AS n FROM users WHERE role='admin' AND active",
      );
      check(count[0].n > 1, "Keep at least one active administrator.");
    }
    await db.query(
      "UPDATE users SET role=$1,approved=$2,active=$3,updated_at=now() WHERE id=$4",
      [role, role === "social_worker" ? approved : true, active, id],
    );
    await db.query("DELETE FROM sessions WHERE user_id=$1", [id]);
    await audit(db, u.id, "user.permissions_updated", null, {
      userId: id,
      role,
      approved,
      active,
    });
  });
}
const totals = `SELECT i.request_id,sum(i.quantity)::text AS needed,sum(COALESCE(c.committed,0))::text AS committed,sum(COALESCE(c.received,0))::text AS received FROM request_items i LEFT JOIN (SELECT item_id,sum(quantity) AS committed,sum(received) AS received FROM commitments GROUP BY item_id) c ON c.item_id=i.id GROUP BY i.request_id`;
export async function listRequests(
  user: User,
  status: string,
  search: string,
): Promise<RequestRow[]> {
  // The list never selects a private narrative or a supporter's contact information.
  const { rows } = await pool.query(
    `SELECT r.id,r.number,r.owner_id,r.summary,r.status,r.created_at,r.updated_at,CASE WHEN $3::boolean OR r.owner_id=$4 THEN u.first_name||' '||u.last_name ELSE '' END AS owner_name,t.needed,t.committed,t.received FROM requests r JOIN users u ON u.id=r.owner_id JOIN (${totals}) t ON t.request_id=r.id WHERE ($1='all' OR r.status=$1) AND (r.number ILIKE $2 OR r.summary ILIKE $2) ORDER BY r.id DESC`,
    [status, `%${search.slice(0, 120)}%`, user.role === "admin", user.id],
  );
  return rows;
}
export async function requestDetails(user: User, id: string) {
  validId(id);
  const { rows } = await pool.query(
    `SELECT r.id,r.number,r.owner_id,r.summary,r.status,r.created_at,r.updated_at,CASE WHEN $2::boolean OR (r.owner_id=$3 AND $4::boolean) THEN r.narrative ELSE NULL END AS narrative,CASE WHEN $2::boolean OR (r.owner_id=$3 AND $4::boolean) THEN u.first_name||' '||u.last_name ELSE '' END AS owner_name FROM requests r JOIN users u ON u.id=r.owner_id WHERE r.id=$1`,
    [id, user.role === "admin", user.id, canCreate(user)],
  );
  if (!rows[0]) return null;
  const r = rows[0] as RequestRow;
  const { rows: items } = await pool.query(
    `SELECT i.id,i.catalog_id,i.name,i.quantity,COALESCE(sum(c.quantity),0)::integer AS committed,COALESCE(sum(c.received),0)::integer AS received FROM request_items i LEFT JOIN commitments c ON c.item_id=i.id WHERE i.request_id=$1 GROUP BY i.id ORDER BY i.id`,
    [id],
  );
  const manager = canManage(user, r);
  const { rows: commitments } = await pool.query(
    `SELECT c.*,i.name,i.request_id,r.number,CASE WHEN $3 THEN u.first_name END AS first_name,CASE WHEN $3 THEN u.last_name END AS last_name,CASE WHEN $3 THEN u.email END AS email,CASE WHEN $3 THEN u.phone END AS phone FROM commitments c JOIN request_items i ON i.id=c.item_id JOIN requests r ON r.id=i.request_id JOIN users u ON u.id=c.supporter_id WHERE i.request_id=$1 AND ($3 OR c.supporter_id=$2) ORDER BY c.created_at DESC,c.id DESC`,
    [id, user.id, manager],
  );
  const { rows: history } = manager
    ? await pool.query(
        "SELECT action,details,created_at FROM audit_history WHERE request_id=$1 ORDER BY id DESC LIMIT 100",
        [id],
      )
    : { rows: [] };
  return {
    request: r,
    items: items as Item[],
    commitments: commitments as Commitment[],
    history,
  };
}
export async function myCommitments(user: User): Promise<Commitment[]> {
  const { rows } = await pool.query(
    "SELECT c.*,i.name,i.request_id,r.number FROM commitments c JOIN request_items i ON i.id=c.item_id JOIN requests r ON r.id=i.request_id WHERE c.supporter_id=$1 ORDER BY c.created_at DESC,c.id DESC",
    [user.id],
  );
  return rows;
}
export async function catalog(): Promise<{ id: number; name: string }[]> {
  return (await pool.query("SELECT * FROM catalog ORDER BY id")).rows;
}
