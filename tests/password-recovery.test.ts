import test from "node:test";
import assert from "node:assert/strict";
import {
  recoveryEmail,
  recoveryRedirect,
  newPassword,
} from "../lib/password-recovery";

test("recovery validates addresses and matching passwords without changing password whitespace", () => {
  assert.equal(
    recoveryEmail.parse(" Person@Example.com "),
    "person@example.com",
  );
  assert.equal(recoveryEmail.safeParse("not-an-email").success, false);
  assert.equal(
    newPassword.safeParse({ password: "short", confirmPassword: "short" })
      .success,
    false,
  );
  assert.equal(
    newPassword.safeParse({
      password: "DifferentPassword1!",
      confirmPassword: "DifferentPassword2!",
    }).success,
    false,
  );
  const password = "  A long password 123  ";
  assert.equal(
    newPassword.parse({ password, confirmPassword: password }).password,
    password,
  );
});

test("recovery redirects stay on the application origin and require HTTPS outside local development", () => {
  assert.equal(
    recoveryRedirect("http://localhost:3000"),
    "http://localhost:3000/reset-password",
  );
  assert.equal(
    recoveryRedirect("https://housing.example.org"),
    "https://housing.example.org/reset-password",
  );
  for (const origin of [
    null,
    "null",
    "javascript:alert(1)",
    "http://external.example.org",
    "https://user:password@example.org",
  ])
    assert.throws(() => recoveryRedirect(origin));
});
