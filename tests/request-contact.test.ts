import { test } from "node:test";
import assert from "node:assert/strict";
import {
  contactFromUser,
  readRequestSummary,
  summaryLimit,
  summaryWithContact,
  type WorkerContact,
} from "../lib/request-contact";
import type { User } from "../lib/types";

const user: User = {
  id: "11111111-1111-4111-8111-111111111111",
  first_name: "Sam",
  last_name: "Worker",
  email: "worker@example.com",
  phone: "315-555-0100",
  role: "social_worker",
  approved: true,
  active: true,
};
const contact = contactFromUser(user);
const summary = "A fictional neighbor needs household essentials.";

test("worker contact survives saving in the existing public description", () => {
  const stored = summaryWithContact(summary, contact);
  assert.deepEqual(readRequestSummary(stored, user.id), { summary, contact });
  assert.equal(stored.includes(user.email), true);
  assert.equal(stored.includes("approved"), false);
  assert.equal(stored.includes("social_worker"), false);
});

test("editing refreshes one worker contact snapshot without duplicating it", () => {
  const stored = summaryWithContact(summary, contact);
  const refreshed = { ...contact, phone: "315-555-0123" };
  const edited = summaryWithContact(stored, refreshed);
  assert.deepEqual(readRequestSummary(edited, user.id), {
    summary,
    contact: refreshed,
  });
  assert.equal(edited.split("[HTA worker contact v1]").length, 2);
});

test("legacy, malformed, and another worker's contact text is preserved", () => {
  const legacy = summary + "\n\n[HTA worker contact v1]\nnot-json";
  assert.deepEqual(readRequestSummary(summary, user.id), { summary });
  assert.deepEqual(readRequestSummary(legacy, user.id), { summary: legacy });
  const other = summaryWithContact(summary, {
    ...contact,
    ownerId: "22222222-2222-4222-8222-222222222222",
  });
  assert.deepEqual(readRequestSummary(other, user.id), { summary: other });
  const invalid =
    summary + '\n\n[HTA worker contact v1]\n{"ownerId":"invalid"}';
  assert.deepEqual(readRequestSummary(invalid, user.id), { summary: invalid });
});

test("contact storage respects the existing 2000-character database limit without truncating", () => {
  const special: WorkerContact = { ...contact, name: 'Sam "S" \\ Worker' };
  const limit = summaryLimit(special);
  const body = "x".repeat(limit);
  assert.equal(summaryWithContact(body, special).length, 2000);
  assert.deepEqual(
    readRequestSummary(summaryWithContact(body, special), user.id),
    { summary: body, contact: special },
  );
  assert.throws(() => summaryWithContact(body + "x", special), RangeError);
});
