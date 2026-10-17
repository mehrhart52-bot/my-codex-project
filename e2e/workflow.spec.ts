import { test, expect, type Page } from "@playwright/test";
import { pool } from "../lib/db";
import { hashPassword } from "../lib/password";
const password = "Browser-test-password-91!";
async function login(page: Page, email: string) {
  await page.goto("/login");
  await page.getByLabel("Email address", { exact: true }).fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Login", exact: true }).click();
  await expect(page).toHaveURL(/\/requests/);
}
async function logout(page: Page) {
  await page.getByRole("button", { name: "Logout", exact: true }).click();
  await expect(
    page.getByRole("link", { name: "Login", exact: true }).first(),
  ).toBeVisible();
}
test.beforeAll(async () => {
  if (!new URL(process.env.DATABASE_URL!).pathname.endsWith("_test"))
    throw Error("Refusing to reset a non-test database");
  await pool.query(
    "TRUNCATE users,requests,request_items,commitments,receipts,audit_history,sessions,login_limits RESTART IDENTITY CASCADE",
  );
  await pool.query(
    "INSERT INTO users(first_name,last_name,email,phone,password_hash,role,approved) VALUES('Alex','Admin','admin@example.test','3155550100',$1,'admin',true)",
    [await hashPassword(password)],
  );
});
test.afterAll(async () => {
  await pool.end();
});
test("registration, staff approval, creation, commitment, receipt, editing, closure, and reopening", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: /A new home/ })).toBeVisible();
  await page
    .getByRole("link", { name: "Create New Account", exact: true })
    .first()
    .click();
  await page.getByLabel("First Name", { exact: true }).fill("Sam");
  await page.getByLabel("Last Name", { exact: true }).fill("Worker");
  await page
    .getByLabel("Email Address", { exact: true })
    .fill("staff@example.test");
  await page.getByLabel("Phone Number", { exact: true }).fill("3155550101");
  await page.getByLabel("User Type").selectOption("social_worker");
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByLabel("Confirm Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Create New Account" }).click();
  await expect(
    page.getByText("Your social worker approval is pending."),
  ).toBeVisible();
  await logout(page);
  await login(page, "admin@example.test");
  await page.getByRole("link", { name: "Administration", exact: true }).click();
  const staff = page
    .locator("article")
    .filter({ has: page.getByRole("heading", { name: "Sam Worker" }) });
  await staff.getByLabel("Approved for social work").check();
  await staff.getByRole("button", { name: "Save permissions" }).click();
  await expect(page.getByRole("status")).toContainText("Permissions updated");
  await logout(page);
  await login(page, "staff@example.test");
  await page
    .getByRole("link", { name: /Create New Request/ })
    .first()
    .click();
  await page
    .getByLabel("Public summary")
    .fill("A fictional neighbor needs a bed and towels for a fresh start.");
  await page
    .getByLabel("Private circumstances")
    .fill("PRIVATE_TEST_NARRATIVE: fictional confidential context only.");
  await page.getByRole("button", { name: "Add Item" }).click();
  await page
    .getByLabel("Item 2", { exact: true })
    .selectOption({ label: "Towels" });
  await page.getByLabel("Quantity", { exact: true }).nth(1).fill("2");
  await page.getByRole("button", { name: "Submit Request" }).click();
  await expect(page.getByRole("status")).toContainText("HTA-00001");
  const requestUrl = page.url().split("?")[0];
  await expect(
    page.getByText("PRIVATE_TEST_NARRATIVE", { exact: false }),
  ).toBeVisible();
  await logout(page);
  await page.goto("/register");
  await page.getByLabel("First Name", { exact: true }).fill("Taylor");
  await page.getByLabel("Last Name", { exact: true }).fill("Supporter");
  await page
    .getByLabel("Email Address", { exact: true })
    .fill("donor@example.test");
  await page.getByLabel("Phone Number", { exact: true }).fill("3155550102");
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByLabel("Confirm Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Create New Account" }).click();
  await expect(page).toHaveURL(/\/requests/);
  await page.goto(requestUrl);
  await expect(
    page.getByText("PRIVATE_TEST_NARRATIVE", { exact: false }),
  ).toHaveCount(0);
  const html = await page.content();
  expect(html).not.toContain("PRIVATE_TEST_NARRATIVE");
  await page
    .getByRole("spinbutton", {
      name: "Quantity of Bed to provide",
      exact: true,
    })
    .fill("1");
  await page
    .getByRole("spinbutton", {
      name: "Quantity of Towels to provide",
      exact: true,
    })
    .fill("2");
  await page.getByRole("button", { name: "Confirm commitment" }).click();
  await expect(page.getByRole("status")).toContainText(
    "Your commitment has been saved",
  );
  await page.getByRole("link", { name: "My Commitments", exact: true }).click();
  await expect(page.locator("article")).toHaveCount(2);
  const towels = page.locator("article").filter({
    has: page.getByRole("heading", { name: "Towels", exact: true }),
  });
  await towels.getByLabel("New total quantity").fill("1");
  await towels
    .getByRole("button", { name: "Reduce / cancel commitment" })
    .click();
  await expect(page.getByRole("status")).toContainText("Commitment updated");
  await logout(page);
  await login(page, "staff@example.test");
  await page.goto(requestUrl);
  await expect(
    page.getByText("donor@example.test", { exact: true }).first(),
  ).toBeVisible();
  const entries = page.locator("article.commitment");
  for (const name of ["Bed", "Towels"]) {
    const entry = entries.filter({
      has: page.getByRole("heading", { name, exact: true }),
    });
    await entry
      .getByRole("button", { name: "Confirm receipt", exact: true })
      .click();
    await expect(entry.getByText("Received", { exact: true })).toBeVisible();
  }
  await page.getByRole("link", { name: "Edit request" }).click();
  const qty = page
    .locator("label")
    .filter({ hasText: /Towels.*reserved/ })
    .getByRole("spinbutton");
  await qty.fill("1");
  await page.getByRole("button", { name: "Save request" }).click();
  await expect(
    page.getByText(/Every requested item has been received/),
  ).toBeVisible();
  await page.getByLabel("I confirm this request should be closed.").check();
  await page.getByRole("button", { name: "Confirm closure" }).click();
  await expect(page.getByRole("status")).toContainText("Request closed");
  await logout(page);
  await login(page, "donor@example.test");
  await page.goto(requestUrl);
  await expect(
    page.getByRole("heading", { name: "This request is closed" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Confirm commitment" }),
  ).toHaveCount(0);
  await page.goto("/admin");
  await expect(
    page.getByRole("heading", { name: "This page isn’t available." }),
  ).toBeVisible();
  await logout(page);
  await login(page, "admin@example.test");
  await page.goto(requestUrl);
  await page.getByLabel("Confirm reopening and allow new commitments.").check();
  await page
    .getByRole("button", { name: "Reopen request", exact: true })
    .click();
  await expect(page.getByRole("status")).toContainText("Request reopened");
  const receipts = await pool.query(
    "SELECT sum(quantity)::integer AS n FROM receipts",
  );
  expect(receipts.rows[0].n).toBe(2);
});
test("anonymous routes require login and mobile home has no horizontal overflow", async ({
  page,
}) => {
  for (const path of ["/requests", "/commitments", "/requests/new", "/admin"]) {
    await page.goto(path);
    await expect(page).toHaveURL(/\/login/);
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await expect(page.getByRole("heading", { name: /A new home/ })).toBeVisible();
});
