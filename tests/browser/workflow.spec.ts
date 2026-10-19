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
  const password = page.getByLabel("Password", { exact: true });
  await password.fill("visible-password-check");
  await expect(password).toHaveAttribute("type", "password");
  await page.getByRole("button", { name: "Show password" }).click();
  await expect(password).toHaveAttribute("type", "text");
  await page.getByRole("button", { name: "Hide password" }).click();
  await expect(password).toHaveAttribute("type", "password");
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

test("all demo roles can sign in using the manual login form", async ({
  page,
}) => {
  for (const role of ["admin", "worker", "supporter"]) {
    await page.goto("/login");
    await expect(page.getByRole("button", { name: /Use .* Demo/ })).toHaveCount(
      0,
    );
    await login(page, {
      ...demos[role],
      role: role === "worker" ? "social_worker" : role,
    });
    if (role === "admin") {
      await expect(
        page.getByRole("link", { name: "Administration", exact: true }),
      ).toBeVisible();
    }
    await page.getByRole("button", { name: "Logout" }).click();
    await expect(page).toHaveURL(/\/\?message=/);
  }
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

test("worker signup → admin approval → request → supporter commitment → close → admin reopen", async ({
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
    await workerPage
      .getByRole("link", { name: "Check approval status" })
      .click();
    await workerPage
      .getByRole("link", { name: "＋ Create New Request", exact: true })
      .click();
    const itemSelect = workerPage.getByLabel("Item 1", { exact: true });
    await expect(itemSelect).toBeVisible();
    const itemChoices = await itemSelect.locator("option").allTextContents();
    expect(itemChoices).toEqual([
      "Select an item...",
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
    const requestNumber = (
      await workerPage.locator(".page-head .eyebrow").innerText()
    ).match(/HTA-\d+/)![0];
    await expect(workerPage.locator("section.card table thead th")).toHaveText([
      "Item",
      "Requested",
      "Committed",
      "Available to commit",
    ]);
    await expect(workerPage.getByText(/received|receipt/i)).toHaveCount(0);
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
    await expect(
      supporterPage.getByRole("region", { name: "How to help" }),
    ).toBeVisible();
    await supporterPage.getByLabel("Search requests").fill(requestNumber);
    await supporterPage
      .getByRole("button", { name: "Search", exact: true })
      .click();
    await supporterPage.getByRole("link", { name: "View Details" }).click();
    await expect(supporterPage).toHaveURL(new RegExp(path + "$"));
    const deliveryContact = supporterPage.locator(".page-head");
    await expect(
      deliveryContact.getByRole("link", { name: worker.email }),
    ).toHaveAttribute("href", `mailto:${worker.email}`);
    await expect(
      deliveryContact.getByRole("link", { name: "315-555-0123" }),
    ).toHaveAttribute("href", "tel:3155550123");
    await expect(deliveryContact).toContainText(
      "Requested by Fictional Tester",
    );
    await expect(
      supporterPage.getByRole("heading", { name: "Arrange delivery" }),
    ).toHaveCount(0);
    await expect(
      supporterPage.getByRole("button", { name: "Confirm commitment" }),
    ).toBeDisabled();
    await supporterPage
      .getByLabel("Quantity of Dining Chairs to provide")
      .fill("3");
    await supporterPage
      .getByRole("button", { name: "Confirm commitment" })
      .click();
    await expect(
      supporterPage.getByText("Thank you! Your commitment has been saved."),
    ).toBeVisible();
    await expect(
      supporterPage.getByRole("region", {
        name: "Your commitment and next steps",
      }),
    ).toContainText("3 × Dining Chairs");
    await expect(
      supporterPage.getByRole("region", {
        name: "Your commitment and next steps",
      }),
    ).toContainText("Contact the worker");
    await supporterPage.goto("/requests");
    const card = supporterPage
      .locator("article")
      .filter({ has: supporterPage.locator(`a[href="${path}"]`) });
    await expect(card.locator(".stats strong")).toHaveText(["3", "3"]);

    await login(otherPage, demos.other);
    await otherPage.goto(path);
    const unrelatedHtml = await otherPage.content();
    expect(unrelatedHtml.includes(supporter.email)).toBe(false);
    await expect(
      otherPage.locator(".page-head").getByRole("link", { name: worker.email }),
    ).toBeVisible();
    await expect(
      otherPage.getByRole("heading", { name: "Household circumstances" }),
    ).toHaveCount(0);

    // Regression: administrator reduces from request detail and remains on it.
    await adminPage.goto(path);
    await adminPage.getByRole("link", { name: "Edit request" }).click();
    await expect(adminPage.getByLabel(/Public summary/)).toHaveValue(summary);
    await adminPage.getByRole("button", { name: "Save request" }).click();
    await expect(adminPage).toHaveURL(new RegExp(path + "\\?message="));
    await expect(
      adminPage.locator(".page-head").getByRole("link", { name: worker.email }),
    ).toBeVisible();
    await expect(
      adminPage
        .locator(".page-head")
        .getByRole("link", { name: demos.admin.email }),
    ).toHaveCount(0);
    await adminPage.getByLabel("Reduce committed total").fill("2");
    await adminPage.getByRole("button", { name: "Update commitment" }).click();
    await expect(adminPage).toHaveURL(new RegExp(path + "\\?message="));
    await expect(
      adminPage.getByText(
        "Commitment updated; unneeded quantities are available again.",
      ),
    ).toBeVisible();
    await expect(adminPage.locator("article.commitment")).toContainText(
      "2 committed",
    );

    // Supporter reduction still returns to My Commitments.
    await supporterPage.goto("/commitments");
    await expect(supporterPage.getByText(/received|receipt/i)).toHaveCount(0);
    await expect(supporterPage.getByLabel(/New total quantity/)).toHaveValue(
      "",
    );
    await supporterPage.getByLabel(/New total quantity/).fill("1");
    await supporterPage
      .getByRole("button", { name: "Reduce / cancel commitment" })
      .click();
    await expect(supporterPage).toHaveURL(/\/commitments\?message=/);
    await expect(supporterPage.locator("article")).toContainText("1 committed");
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

    // An existing administrator can grant and later remove alternate access.
    await adminPage.goto("/admin");
    const ownAdminCard = adminPage
      .locator("article")
      .filter({ hasText: demos.admin.email });
    await expect(
      ownAdminCard.getByText(/Your administrator access is protected/),
    ).toBeVisible();
    await expect(
      ownAdminCard.getByRole("button", { name: "Save permissions" }),
    ).toHaveCount(0);
    const alternateAdminCard = adminPage
      .locator("article")
      .filter({ hasText: supporter.email });
    await alternateAdminCard.getByLabel("Role").selectOption("admin");
    await alternateAdminCard
      .getByRole("button", { name: "Save permissions" })
      .click();
    await expect(
      adminPage.getByText(
        "Permissions updated. The change takes effect immediately.",
      ),
    ).toBeVisible();

    await supporterPage.goto("/admin");
    await expect(
      supporterPage.getByRole("heading", { name: "Administrator access" }),
    ).toBeVisible();
    const alternateSelfCard = supporterPage
      .locator("article")
      .filter({ hasText: supporter.email });
    await expect(
      alternateSelfCard.getByText(/Your administrator access is protected/),
    ).toBeVisible();

    await adminPage.goto("/admin");
    const removableAdminCard = adminPage
      .locator("article")
      .filter({ hasText: supporter.email });
    await removableAdminCard.getByLabel("Role").selectOption("supporter");
    await removableAdminCard
      .getByRole("button", { name: "Save permissions" })
      .click();
    await expect(
      adminPage.getByText(
        "Permissions updated. The change takes effect immediately.",
      ),
    ).toBeVisible();
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

test("first-time guidance, draft recovery, competing offers, and mobile layout", async ({
  browser,
}) => {
  test.setTimeout(120000);
  const contexts = await Promise.all([
    browser.newContext(),
    browser.newContext(),
    browser.newContext(),
  ]);
  const [worker, supporter, other] = await Promise.all(
    contexts.map((c) => c.newPage()),
  );
  const capture = process.env.HTA_UX_SCREENSHOTS === "1";
  try {
    await worker.goto("/register");
    await expect(
      worker.getByText(/Workers’ names, phone numbers, and emails/),
    ).toBeVisible();
    if (capture)
      await worker.screenshot({
        path: ".local/ux-review/signup-after.png",
        fullPage: true,
        caret: "initial",
      });
    await login(worker, { ...demos.worker, role: "social_worker" });
    await worker
      .getByRole("link", { name: "View Existing Requests", exact: true })
      .first()
      .click();
    await expect(
      worker.getByRole("combobox", { name: "Show", exact: true }),
    ).toHaveValue("mine");
    await worker
      .getByRole("main")
      .getByRole("link", { name: /Create New Request/ })
      .click();
    await worker.getByRole("button", { name: "Remove item 1" }).click();
    await expect(
      worker.getByRole("button", { name: "Submit Request", exact: true }),
    ).toBeDisabled();
    await worker.getByRole("button", { name: "＋ Add Item" }).click();
    await expect(worker.getByLabel("Item 1", { exact: true })).toHaveValue("");
    await worker.getByLabel("Item 1", { exact: true }).selectOption("Lamp");
    await worker.getByRole("button", { name: "＋ Add Item" }).click();
    await expect(worker.getByLabel("Item 2", { exact: true })).toHaveValue("");
    await worker.getByLabel("Item 2", { exact: true }).selectOption("Other");
    await worker.getByLabel("Specify item").fill("Laundry basket");
    await worker.getByLabel("Quantity", { exact: true }).nth(1).fill("2");
    // HTML accepts the length, but the server trims the summary and rejects it.
    const shortSummary = "     abc     ";
    await worker.getByLabel(/Public summary/).fill(shortSummary);
    await worker
      .getByRole("button", { name: "Submit Request", exact: true })
      .click();
    await expect(worker.locator("form .flash.error")).toContainText(
      "Add a public summary of at least 10 characters.",
    );
    await expect(worker.locator("form .flash.error")).toBeFocused();
    await expect(worker.getByLabel(/Public summary/)).toHaveValue(shortSummary);
    await expect(worker.getByLabel("Item 1", { exact: true })).toHaveValue(
      "Lamp",
    );
    await expect(worker.getByLabel("Specify item")).toHaveValue(
      "Laundry basket",
    );
    await expect(
      worker.getByLabel("Quantity", { exact: true }).nth(1),
    ).toHaveValue("2");
    await worker
      .getByLabel(/Public summary/)
      .fill("Fictional usability review: a lamp and baskets for a new home.");
    await worker
      .getByRole("button", { name: "Submit Request", exact: true })
      .click();
    await expect(worker).toHaveURL(/\/requests\/\d+\?message=/);
    const path = new URL(worker.url()).pathname;
    const number = (
      await worker.locator(".page-head .eyebrow").innerText()
    ).match(/HTA-\d+/)![0];
    await login(supporter, demos.supporter);
    await supporter
      .getByLabel("Search requests")
      .fill("no-matches-" + Date.now());
    await supporter
      .getByRole("button", { name: "Search", exact: true })
      .click();
    await expect(
      supporter.getByRole("heading", { name: "No matching requests" }),
    ).toBeVisible();
    await supporter
      .getByRole("link", { name: "Clear filters", exact: true })
      .click();
    await expect(supporter.getByLabel("Search requests")).toHaveValue("");
    await supporter.getByLabel("Search requests").fill(number);
    await supporter
      .getByRole("button", { name: "Search", exact: true })
      .click();
    await supporter.getByRole("link", { name: "View Details" }).click();
    for (const width of [320, 375, 768, 1280]) {
      await supporter.setViewportSize({ width, height: 900 });
      expect(
        await supporter.evaluate(
          () => document.documentElement.scrollWidth <= window.innerWidth,
        ),
        `offer form fits ${width}px`,
      ).toBe(true);
    }
    await supporter.setViewportSize({ width: 375, height: 812 });
    const about = await supporter
      .getByRole("heading", { name: "A fresh start, with your help." })
      .boundingBox();
    const offerForm = await supporter
      .getByRole("heading", { name: "Commit to Providing Items" })
      .boundingBox();
    expect(about!.y).toBeLessThan(offerForm!.y);
    if (capture)
      await supporter.screenshot({
        path: ".local/ux-review/offer-mobile-after.png",
        fullPage: true,
        caret: "initial",
      });
    await supporter.setViewportSize({ width: 1280, height: 900 });
    await login(other, demos.other);
    await other.goto(path);
    await supporter.getByLabel("Quantity of Lamp to provide").fill("1");
    await supporter
      .getByLabel("Quantity of Laundry basket to provide")
      .fill("1");
    await other.getByLabel("Quantity of Lamp to provide").fill("1");
    await other.getByRole("button", { name: "Confirm commitment" }).click();
    await expect(
      other.getByText("Thank you! Your commitment has been saved.", {
        exact: true,
      }),
    ).toBeVisible();
    // The stale offer must fail atomically without losing the entered quantities.
    await supporter.getByRole("button", { name: "Confirm commitment" }).click();
    await expect(supporter.locator("form .flash.error")).toContainText(
      "An item is no longer available",
    );
    await expect(
      supporter.getByLabel("Quantity of Lamp to provide"),
    ).toHaveValue("1");
    await expect(
      supporter.getByLabel("Quantity of Laundry basket to provide"),
    ).toHaveValue("1");
    await supporter
      .getByRole("link", {
        name: "Reload the request to check current quantities",
      })
      .click();
    await expect(
      supporter.getByLabel("Quantity of Lamp to provide"),
    ).toHaveCount(0);
    await supporter
      .getByLabel("Quantity of Laundry basket to provide")
      .fill("1");
    await supporter.getByRole("button", { name: "Confirm commitment" }).click();
    await expect(
      supporter.getByText("Thank you! Your commitment has been saved.", {
        exact: true,
      }),
    ).toBeVisible();
    await expect(
      supporter.getByRole("region", { name: "Your commitment and next steps" }),
    ).toContainText("1 × Laundry basket");
    await expect(
      supporter.getByLabel("Quantity of Laundry basket to provide"),
    ).toHaveValue("0");
    await expect(
      supporter.getByRole("button", { name: "Confirm commitment" }),
    ).toBeDisabled();
    for (const width of [320, 375, 768, 1280]) {
      await supporter.setViewportSize({ width, height: 900 });
      expect(
        await supporter.evaluate(
          () => document.documentElement.scrollWidth <= window.innerWidth,
        ),
        `detail fits ${width}px`,
      ).toBe(true);
    }
    await supporter.setViewportSize({ width: 375, height: 812 });
    if (capture)
      await supporter.screenshot({
        path: ".local/ux-review/detail-mobile-after.png",
        fullPage: true,
        caret: "initial",
      });
    await worker.goto(path);
    const supporters = worker
      .getByRole("heading", { name: "Supporter commitments" })
      .locator("..");
    await expect(supporters).toContainText(demos.supporter.email);
    await expect(supporters).toContainText(demos.other.email);
    await worker.getByLabel("I confirm this request should be closed.").check();
    await worker.getByRole("button", { name: "Confirm closure" }).click();
    await expect(
      worker.getByText("Request closed. All records have been preserved.", {
        exact: true,
      }),
    ).toBeVisible();
    await supporter.goto(path);
    await expect(
      supporter.getByRole("heading", { name: "This request is closed" }),
    ).toBeVisible();
    await expect(
      supporter.getByRole("button", { name: "Confirm commitment" }),
    ).toHaveCount(0);
    await supporter
      .getByRole("link", { name: "View or change my commitments" })
      .click();
    const offer = supporter
      .locator("article")
      .filter({ has: supporter.locator(`a[href="${path}"]`) });
    await expect(offer.getByLabel(/New total quantity/)).toHaveValue("");
    await offer.getByLabel(/New total quantity/).fill("0");
    await offer
      .getByRole("button", { name: "Reduce / cancel commitment" })
      .click();
    await expect(offer.locator(".badge")).toHaveText("Cancelled");
    await supporter.goto(path);
    await expect(
      supporter.getByRole("region", { name: "Your commitment and next steps" }),
    ).toHaveCount(0);
  } finally {
    await Promise.all(contexts.map((c) => c.close()));
  }
});
