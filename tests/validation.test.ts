import { test } from "node:test";
import assert from "node:assert/strict";
import { registration } from "../lib/accounts";
import { itemInput, requestInput } from "../lib/service";
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
    narrative:
      "Private fictional circumstances for the assigned social worker.",
    items: [{ catalogId: 1, quantity: 2 }],
  };
  assert.equal(requestInput.parse(valid).items[0].quantity, 2);
  assert.throws(() => requestInput.parse({ ...valid, summary: "short" }));
  assert.throws(() => requestInput.parse({ ...valid, items: [] }));
  assert.throws(() => itemInput.parse({ catalogId: 1, quantity: 1.5 }));
  assert.throws(() => itemInput.parse({ catalogId: 1, quantity: 0 }));
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
