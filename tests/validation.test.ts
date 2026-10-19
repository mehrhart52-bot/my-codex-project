import { test } from "node:test";
import assert from "node:assert/strict";
import { registration, signInErrorMessage } from "../lib/accounts";
import { itemInput, requestInput, visibleCatalog } from "../lib/service";
import { canCreate, canManage, type User } from "../lib/types";

const baseRegistration = {
  firstName: "Taylor",
  lastName: "Neighbor",
  email: "taylor@example.test",
  phone: "315-555-0100",
  role: "supporter" as const,
  password: "a-secure-test-password",
  confirmPassword: "a-secure-test-password",
};

test("login distinguishes incorrect credentials from service failures", () => {
  assert.equal(
    signInErrorMessage({ code: "invalid_credentials", status: 400 }),
    "Email or password is incorrect.",
  );
  for (const status of [0, 401, 500, 503]) {
    assert.match(signInErrorMessage({ status }), /service is unavailable/);
  }
  assert.match(signInErrorMessage({ status: 429 }), /wait a few minutes/);
  assert.match(
    signInErrorMessage({ code: "email_not_confirmed", status: 400 }),
    /confirm your email/,
  );
});

test("registration accepts supporters and pending social workers only", () => {
  assert.equal(registration.parse(baseRegistration).role, "supporter");
  assert.equal(
    registration.parse({ ...baseRegistration, role: "social_worker" }).role,
    "social_worker",
  );
  assert.throws(() =>
    registration.parse({ ...baseRegistration, role: "admin" }),
  );
  assert.throws(() =>
    registration.parse({ ...baseRegistration, confirmPassword: "different" }),
  );
  assert.throws(() => registration.parse({ ...baseRegistration, phone: "" }));
});

test("request and item validation enforce useful descriptions and whole quantities", () => {
  const valid = {
    summary: "A fictional neighbor needs help furnishing a new apartment.",
    items: [{ catalogId: 1, quantity: 2 }],
  };
  assert.equal(requestInput.parse(valid).items[0].quantity, 2);
  assert.throws(() => requestInput.parse({ ...valid, summary: "short" }));
  assert.throws(() => requestInput.parse({ ...valid, items: [] }));
  assert.throws(() => itemInput.parse({ catalogId: 1, quantity: 1.5 }));
  assert.throws(() => itemInput.parse({ catalogId: 1, quantity: 0 }));
});

test("catalog presents the revised household essentials in a useful order", () => {
  const rows = [
    { id: 1, name: "Bed" },
    { id: 2, name: "Mattress" },
    { id: 3, name: "Cleaning Supplies" },
    { id: 4, name: "Full Bedding" },
    { id: 5, name: "Twin Mattress" },
    { id: 6, name: "Other" },
  ];

  const catalog = visibleCatalog(rows);
  assert.deepEqual(
    catalog.map(({ name }) => name),
    [
      "Twin Mattress",
      "Full Mattress",
      "Twin Bed Frame",
      "Full Bed Frame",
      "Twin Bedding",
      "Full Bedding",
      "Cleaning Supplies",
      "Other",
    ],
  );
  assert.deepEqual(
    catalog.find(({ name }) => name === "Full Mattress"),
    { id: 6, name: "Full Mattress", customName: "Full Mattress" },
  );
});

test("role helpers require approval and request ownership", () => {
  const worker: User = {
    id: "c1b21c3e-65bd-43d5-8347-b1b5071a3c4d",
    first_name: "Sam",
    last_name: "Worker",
    email: "sam@example.test",
    phone: "315-555-0101",
    role: "social_worker",
    approved: false,
    active: true,
  };
  assert.equal(canCreate(worker), false);
  assert.equal(canCreate({ ...worker, approved: true }), true);
  assert.equal(
    canManage({ ...worker, approved: true }, { owner_id: worker.id }),
    true,
  );
  assert.equal(
    canManage(
      { ...worker, approved: true },
      { owner_id: "3b59296f-1701-4ed1-ad12-7adc16686a75" },
    ),
    false,
  );
});
