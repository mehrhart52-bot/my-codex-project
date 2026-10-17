import { pool, transaction } from "../lib/db";
import { hashPassword } from "../lib/password";
import { createRequest, commitItems, receiveItems } from "../lib/service";
import type { User } from "../lib/types";
try {
  if (
    process.env.NODE_ENV === "production" ||
    process.env.ALLOW_DEMO_SEED !== "true"
  )
    throw Error(
      "Demo seeding requires ALLOW_DEMO_SEED=true and is forbidden in production.",
    );
  const password = process.env.DEMO_PASSWORD;
  if (!password || password.length < 16 || password.length > 128)
    throw Error(
      "Set DEMO_PASSWORD to a unique 16–128 character development password.",
    );
  const hash = await hashPassword(password);
  const users = await transaction(async (db) => {
    await db.query("SELECT pg_advisory_xact_lock(8246793)");
    const existing = await db.query(
      "SELECT id FROM users WHERE email IN ('worker@example.test','supporter@example.test')",
    );
    if (existing.rows.length)
      throw Error("Demo users already exist; seed was not repeated.");
    const out: User[] = [];
    for (const [first, last, email, role] of [
      ["Morgan", "Demo", "worker@example.test", "social_worker"],
      ["Casey", "Demo", "supporter@example.test", "supporter"],
    ]) {
      const { rows } = await db.query(
        "INSERT INTO users(first_name,last_name,email,phone,password_hash,role,approved) VALUES($1,$2,$3,'315-555-0100',$4,$5,true) RETURNING *",
        [first, last, email, hash, role],
      );
      out.push(rows[0]);
    }
    return out;
  });
  const catalog = (await pool.query("SELECT * FROM catalog")).rows;
  const cid = (name: string) => catalog.find((c) => c.name === name).id;
  const first = await createRequest(users[0], {
    summary:
      "A neighbor is starting fresh in a new apartment and could use a comfortable place to rest and share a meal.",
    narrative:
      "Fictional demonstration household. This sample represents a single adult transitioning from shelter into permanent housing. No real client details are stored.",
    items: [
      { catalogId: cid("Bed"), quantity: 1 },
      { catalogId: cid("Dining Chairs"), quantity: 4 },
      { catalogId: cid("Kitchen Table"), quantity: 1 },
      { catalogId: cid("Towels"), quantity: 2 },
    ],
  });
  const chairs = (
    await pool.query(
      "SELECT id FROM request_items WHERE request_id=$1 AND name='Dining Chairs'",
      [first.id],
    )
  ).rows[0].id;
  await commitItems(users[1], first.id, [{ itemId: chairs, quantity: 2 }]);
  const commitment = (
    await pool.query("SELECT id FROM commitments WHERE item_id=$1", [chairs])
  ).rows[0].id;
  await receiveItems(users[0], commitment, 1);
  await createRequest(users[0], {
    summary:
      "A small household is making a new beginning. Kitchen essentials and warm bedding will help them settle in.",
    narrative:
      "Fictional demonstration only. A sample household needs basic items for a permanent housing transition.",
    items: [
      { catalogId: cid("Bedding"), quantity: 2 },
      { catalogId: cid("Dishes"), quantity: 1 },
      { catalogId: cid("Pots and Pans"), quantity: 1 },
      { catalogId: cid("Lamp"), quantity: 2 },
    ],
  });
  await createRequest(users[0], {
    summary:
      "Help a neighbor turn an empty living room into a welcoming space, with a sofa, a lamp, and a few everyday essentials.",
    narrative:
      "Fictional demonstration only. This sample illustrates a living-room furnishing request with no real client information.",
    items: [
      { catalogId: cid("Sofa"), quantity: 1 },
      { catalogId: cid("Lamp"), quantity: 1 },
      { catalogId: cid("Coffee Table"), quantity: 1 },
      { catalogId: cid("Other"), name: "Laundry basket", quantity: 1 },
    ],
  });
  console.log(
    "Fictional demonstration data created. Accounts: worker@example.test and supporter@example.test. Use your DEMO_PASSWORD.",
  );
} catch (e) {
  console.error(e instanceof Error ? e.message : "Seed failed.");
  process.exitCode = 1;
} finally {
  await pool.end();
}
