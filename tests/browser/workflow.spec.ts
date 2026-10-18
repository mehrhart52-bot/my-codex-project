import { test, expect, type Page } from "@playwright/test";
import { identity, settings } from "../support/lab";
import { readFileSync } from "node:fs";

const hosted = process.env.HTA_HOSTED_TEST === "1";
const demos = JSON.parse(
  readFileSync(
    hosted ? ".local/hosted-demo-accounts.json" : ".local/demo-accounts.json",
    "utf8",
  ),
);
async function login(
  page: Page,
  account: { email: string; password: string; role?: string },
) {
  await page.goto("/login");
  await page.getByLabel("Email address", { exact: true }).fill(account.email);
  await page.getByLabel("Password", { exact: true }).fill(account.password);
  await page.getByRole("button", { name: "Login", exact: true }).click();
  await expect(page).toHaveURL(
    account.role === "social_worker"
      ? /\/dashboard\?message=/
      : /\/requests\?message=/,
  );
  await expect(
    page.getByRole("heading", {
      name:
        account.role === "social_worker"
          ? "How can we help today?"
          : "A little help. A lasting impact.",
    }),
  ).toBeVisible();
}
async function register(page: Page, account: ReturnType<typeof identity>) {
  await page.goto("/register");
  await page.getByLabel("First Name").fill("Fictional");
  await page.getByLabel("Last Name").fill("Tester");
  await page.getByLabel("Email Address").fill(account.email);
  await page.getByLabel("Phone Number").fill("315-555-0123");
  await page.getByLabel("User Type").selectOption(account.role);
  await page.getByLabel("Password", { exact: true }).fill(account.password);
  await page
    .getByLabel("Confirm Password", { exact: true })
    .fill(account.password);
  await page.getByRole("button", { name: "Create New Account" }).click();
  await expect(page).toHaveURL(
    account.role === "social_worker"
      ? /\/dashboard\?message=/
      : /\/requests\?message=/,
  );
}

test("entry shows login and registration, protects requests, and supports a narrow screen", async ({
  page,
}) => {
  await page.goto("/");
  await expect(
    page.getByRole("heading", {
      name: "Housing Transition Assistance",
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Login", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "View Existing Requests" }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("link", { name: /Create New Request/ }),
  ).toHaveCount(0);
  await page.setViewportSize({ width: 375, height: 812 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page
    .getByRole("main")
    .getByRole("link", { name: "Create New Account" })
    .click();
  await expect(page).toHaveURL(/\/register$/);
  await page.goto("/requests");
  await expect(page).toHaveURL(/\/login$/);
});

test("returning workers choose an action and supporters go directly to requests", async ({
  page,
}) => {
  await login(page, { ...demos.worker, role: "social_worker" });
  await expect(
    page.getByRole("main").getByRole("link", { name: /Create New Request/ }),
  ).toBeVisible();
  await page
    .getByRole("main")
    .getByRole("link", { name: "View Existing Requests" })
    .click();
  await expect(page).toHaveURL(/\/requests$/);
  await page.goto("/");
  await expect(page).toHaveURL(/\/dashboard$/);
  await page.getByRole("button", { name: "Logout" }).click();
  await expect(
    page.getByRole("button", { name: "Login", exact: true }),
  ).toBeVisible();
  await login(page, demos.supporter);
  await expect(
    page.getByRole("link", { name: /Create New Request/ }),
  ).toHaveCount(0);
  await page.goto("/");
  await expect(page).toHaveURL(/\/requests$/);
  await page.goto("/dashboard");
  await expect(page).toHaveURL(/\/requests$/);
  await page.goto("/login");
  await expect(page).toHaveURL(/\/requests$/);
});

test("registration errors preserve non-sensitive values and role, clear passwords, and stay by the field", async ({
  page,
}) => {
  const account = identity("social_worker");
  await page.goto("/register");
  await page.getByLabel("First Name").fill("Casey");
  await page.getByLabel("Last Name").fill("Fictional");
  await page.getByLabel("Email Address").fill(account.email);
  await page.getByLabel("Phone Number").fill("315-555-0101");
  await page.getByLabel("User Type").selectOption("social_worker");
  await page.getByLabel("Password", { exact: true }).fill(account.password);
  await page
    .getByLabel("Confirm Password", { exact: true })
    .fill("different-valid-length-password");
  await page.getByRole("button", { name: "Create New Account" }).click();
  await expect(page).toHaveURL(/\/register$/);
  await expect(
    page.getByText("Passwords must match.", { exact: true }),
  ).toBeVisible();
  expect((await page.content()).includes(account.password)).toBe(false);
  await expect(
    page.getByLabel("Confirm Password", { exact: true }),
  ).toHaveAttribute("aria-describedby", "confirmPassword-error");
  for (const [label, value] of [
    ["First Name", "Casey"],
    ["Last Name", "Fictional"],
    ["Email Address", account.email],
    ["Phone Number", "315-555-0101"],
    ["User Type", "social_worker"],
  ]) {
    await expect(page.getByLabel(label, { exact: true })).toHaveValue(value);
  }
  expect(
    (await page.getByLabel("Password", { exact: true }).inputValue()) === "",
  ).toBe(true);
  expect(
    (await page
      .getByLabel("Confirm Password", { exact: true })
      .inputValue()) === "",
  ).toBe(true);
  // A second error exercises repeated submissions and continued preservation.
  await page.getByLabel("Password", { exact: true }).fill(account.password);
  await page
    .getByLabel("Confirm Password", { exact: true })
    .fill(account.password);
  await page.getByLabel("Phone Number").fill("not-a-number");
  await page.getByRole("button", { name: "Create New Account" }).click();
  await expect(
    page.getByText("Enter a valid phone number.", { exact: true }),
  ).toBeVisible();
  await expect(page.getByLabel("User Type")).toHaveValue("social_worker");
  await expect(page.getByLabel("Email Address")).toHaveValue(account.email);
});

test("worker signup → admin approval → request → supporter signup and pledge → receipt → close → admin reopen", async ({
  browser,
}) => {
  const contexts = await Promise.all([
    browser.newContext(),
    browser.newContext(),
    browser.newContext(),
    browser.newContext(),
  ]);
  const [workerPage, adminPage, supporterPage, otherPage] = await Promise.all(
    contexts.map((c) => c.newPage()),
  );
  try {
    const worker = identity("social_worker");
    const supporter = identity();
    await register(workerPage, worker);
    await expect(
      workerPage.getByText(/Your social worker approval is pending/),
    ).toBeVisible();
    await expect(
      workerPage.getByRole("link", { name: /Create New Request/ }),
    ).toHaveCount(0);
    await login(adminPage, demos.admin);
    await adminPage.goto("/admin");
    const workerCard = adminPage
      .locator("article")
      .filter({ hasText: worker.email });
    await workerCard.getByLabel("Approved for social work").check();
    await workerCard.getByRole("button", { name: "Save permissions" }).click();
    await expect(
      adminPage.getByText(
        "Permissions updated. The change takes effect immediately.",
      ),
    ).toBeVisible();
    await workerPage.reload();
    await workerPage
      .getByRole("link", { name: "＋ Create New Request", exact: true })
      .click();
    const itemSelect = workerPage.getByLabel("Item 1", { exact: true });
    await expect(itemSelect).toBeVisible();
    const itemChoices = await itemSelect.locator("option").allTextContents();
    expect(itemChoices).toEqual([
      "Twin Mattress",
      "Full Mattress",
      "Twin Bed Frame",
      "Full Bed Frame",
      "Twin Bedding",
      "Full Bedding",
      "Pillows",
      "Dishes",
      "Glasses",
      "Silverware",
      "Pots and Pans",
      "Cooking Utensils",
      "Microwave",
      "Television",
      "Lamp",
      "Kitchen Table",
      "Dining Chairs",
      "Sofa",
      "Coffee Table",
      "End Table",
      "Dresser",
      "Towels",
      "Cleaning Supplies",
      "Other",
    ]);
    const summary =
      "Fictional browser exercise: dining chairs for a fresh start.";
    await workerPage.getByLabel(/Public summary/).fill(summary);
    await expect(workerPage.getByLabel(/Private circumstances/)).toHaveCount(0);
    await workerPage
      .getByLabel("Item 1", { exact: true })
      .selectOption({ label: "Dining Chairs" });
    await workerPage.getByLabel("Quantity", { exact: true }).fill("3");
    await workerPage
      .getByRole("button", { name: "Submit Request", exact: true })
      .click();
    await expect(workerPage).toHaveURL(/\/requests\/\d+\?message=/);
    const path = new URL(workerPage.url()).pathname;
    await expect(
      workerPage.getByRole("heading", { name: "Household circumstances" }),
    ).toHaveCount(0);
    expect(
      (await workerPage.content()).includes(
        "No private circumstances provided.",
      ),
    ).toBe(false);
    await workerPage.getByRole("link", { name: "Edit request" }).click();
    await expect(workerPage.getByLabel(/Private circumstances/)).toHaveCount(0);
    await workerPage.getByRole("button", { name: "Save request" }).click();
    await expect(
      workerPage.getByText("Request updated.", { exact: true }),
    ).toBeVisible();

    await register(supporterPage, supporter);
    await supporterPage.goto(path);
    await supporterPage
      .getByLabel("Quantity of Dining Chairs to provide")
      .fill("3");
    await supporterPage
      .getByRole("button", { name: "Confirm commitment" })
      .click();
    await expect(
      supporterPage.getByText("Thank you! Your commitment has been saved."),
    ).toBeVisible();
    await supporterPage.goto("/requests");
    const card = supporterPage
      .locator("article")
      .filter({ has: supporterPage.locator(`a[href="${path}"]`) });
    await expect(card.locator(".stats strong")).toHaveText(["3", "3", "0"]);

    await login(otherPage, demos.other);
    await otherPage.goto(path);
    const unrelatedHtml = await otherPage.content();
    expect(unrelatedHtml.includes(supporter.email)).toBe(false);
    await expect(
      otherPage.getByRole("heading", { name: "Household circumstances" }),
    ).toHaveCount(0);

    await workerPage.goto(path);
    await workerPage.getByLabel("Delivered now").fill("1");
    await workerPage.getByRole("button", { name: "Confirm receipt" }).click();
    await expect(
      workerPage.getByText("Receipt recorded. Thank you."),
    ).toBeVisible();
    await expect(workerPage.locator("article.commitment")).toContainText(
      "3 committed · 1 received",
    );

    // Regression: administrator reduces from request detail and remains on it.
    await adminPage.goto(path);
    await adminPage.getByLabel("Reduce committed total").fill("2");
    await adminPage.getByRole("button", { name: "Update commitment" }).click();
    await expect(adminPage).toHaveURL(new RegExp(path + "\\?message="));
    await expect(
      adminPage.getByText(
        "Commitment updated; unneeded quantities are available again.",
      ),
    ).toBeVisible();
    await expect(adminPage.locator("article.commitment")).toContainText(
      "2 committed · 1 received",
    );

    // Supporter reduction still returns to My Commitments and preserves delivered units.
    await supporterPage.goto("/commitments");
    await supporterPage.getByLabel(/New total quantity/).fill("1");
    await supporterPage
      .getByRole("button", { name: "Reduce / cancel commitment" })
      .click();
    await expect(supporterPage).toHaveURL(/\/commitments\?message=/);
    await expect(supporterPage.locator("article")).toContainText(
      "1 total committed · 1 received",
    );
    await supporterPage.goto(path);
    await supporterPage
      .getByLabel("Quantity of Dining Chairs to provide")
      .fill("1");
    await supporterPage
      .getByRole("button", { name: "Confirm commitment" })
      .click();
    await expect(
      supporterPage.getByText("Thank you! Your commitment has been saved."),
    ).toBeVisible();
    await supporterPage.goto("/commitments");
    await supporterPage.getByLabel(/New total quantity/).fill("0");
    await supporterPage
      .getByRole("button", { name: "Reduce / cancel commitment" })
      .click();
    await expect(supporterPage.locator(".badge.cancelled")).toHaveText(
      "Cancelled",
    );

    await workerPage.goto(path);
    await workerPage
      .getByLabel("I confirm this request should be closed.")
      .check();
    await workerPage.getByRole("button", { name: "Confirm closure" }).click();
    await expect(
      workerPage.getByText("Request closed. All records have been preserved."),
    ).toBeVisible();
    await adminPage.goto(path);
    await adminPage
      .getByLabel("Confirm reopening and allow new commitments.")
      .check();
    await adminPage
      .getByRole("button", { name: "Reopen request", exact: true })
      .click();
    await expect(
      adminPage.getByText("Request reopened.", { exact: true }),
    ).toBeVisible();
    await expect(adminPage.locator(".page-head .badge")).toHaveText("Open");
  } finally {
    await Promise.all(contexts.map((c) => c.close()));
  }
});

test("login rejects a wrong password and email confirmation is explicitly off", async ({
  page,
  request,
}) => {
  const service = hosted
    ? {
        API_URL: process.env.NEXT_PUBLIC_SUPABASE_URL!,
        ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
      }
    : settings();
  if (hosted) {
    await page.setExtraHTTPHeaders({
      apikey: service.ANON_KEY,
      Authorization: `Bearer ${service.ANON_KEY}`,
    });
    const response = await page.goto(service.API_URL + "/auth/v1/settings");
    expect(response?.ok()).toBe(true);
    expect((await response!.json()).mailer_autoconfirm).toBe(true);
    await page.setExtraHTTPHeaders({});
  } else {
    const response = await request.get(service.API_URL + "/auth/v1/settings", {
      headers: {
        apikey: service.ANON_KEY,
        Authorization: `Bearer ${service.ANON_KEY}`,
      },
    });
    expect(response.ok()).toBe(true);
    expect((await response.json()).mailer_autoconfirm).toBe(true);
  }
  await page.goto("/login");
  await page.getByLabel("Email address").fill(demos.supporter.email);
  await page
    .getByLabel("Password", { exact: true })
    .fill("incorrect-test-password");
  await page.getByRole("button", { name: "Login", exact: true }).click();
  await expect(page.getByText("Email or password is incorrect.")).toBeVisible();
  await login(page, demos.supporter);
});
