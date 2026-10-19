import {
  test,
  expect,
  type Page,
  type APIRequestContext,
} from "@playwright/test";
import { identity } from "../support/lab";
import { recoveryMessage } from "../../lib/password-recovery";

async function signup(page: Page, account: ReturnType<typeof identity>) {
  await page.goto("/register");
  await page.getByLabel("First Name").fill("Recovery");
  await page.getByLabel("Last Name").fill("Tester");
  await page.getByLabel("Email Address").fill(account.email);
  await page.getByLabel("Phone Number").fill("315-555-0101");
  await page.getByLabel("Password", { exact: true }).fill(account.password);
  await page
    .getByLabel("Confirm Password", { exact: true })
    .fill(account.password);
  await page
    .getByRole("button", { name: "Create New Account", exact: true })
    .click();
  await expect(page).toHaveURL(/\/requests\?message=/);
  await page.getByRole("button", { name: "Logout" }).click();
  await expect(page).toHaveURL(/\/\?message=/);
}

async function emailLink(request: APIRequestContext, email: string) {
  let id = "";
  await expect
    .poll(
      async () => {
        const response = await request.get(
          "http://127.0.0.1:54324/api/v1/search",
          { params: { query: `to:${email}` } },
        );
        if (!response.ok()) return false;
        const data = await response.json();
        id = data.messages?.[0]?.ID ?? "";
        return !!id;
      },
      { message: "A recovery email arrives in the isolated inbox" },
    )
    .toBe(true);
  const response = await request.get(
    `http://127.0.0.1:54324/api/v1/message/${id}`,
  );
  const mail = await response.json();
  const link = String(mail.HTML)
    .match(/href="([^"]+)"/)?.[1]
    ?.replaceAll("&amp;", "&");
  // Never include the link or token in assertion output.
  expect(!!link, "The email contains a reset link").toBe(true);
  const url = new URL(link!);
  expect(
    url.hostname === "127.0.0.1" && url.port === "54321",
    "Recovery stays inside the isolated test lab",
  ).toBe(true);
  return link!;
}

async function openEmailLink(page: Page, link: string) {
  try {
    await page.goto(link);
  } catch {
    throw new Error("The reset email link could not be opened.");
  }
  await expect
    .poll(() => page.evaluate(() => location.hash === ""), {
      message: "Recovery credentials are removed from the address bar",
    })
    .toBe(true);
}

test("email recovery works in another browser, validates passwords, and returns to manual login", async ({
  page,
  browser,
  request,
}) => {
  const account = identity();
  const replacement = identity().password;
  const newBrowser = await browser.newContext();
  const reset = await newBrowser.newPage();
  try {
    await signup(page, account);
    await page.getByRole("link", { name: "Forgot password?" }).click();
    await expect(page).toHaveURL(/\/forgot-password$/);
    await page.getByLabel("Email address").fill(account.email);
    await page
      .getByRole("button", { name: "Send reset link", exact: true })
      .click();
    await expect(page.getByRole("status")).toContainText(recoveryMessage);
    const link = await emailLink(request, account.email);
    await openEmailLink(reset, link);
    await expect(reset.locator(".account-email")).toHaveText(account.email);
    await reset.setViewportSize({ width: 320, height: 812 });
    expect(
      await reset.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await reset.getByLabel("New password", { exact: true }).fill(replacement);
    await reset
      .getByRole("button", { name: "Show password", exact: true })
      .click();
    await expect(
      reset.getByLabel("New password", { exact: true }),
    ).toHaveAttribute("type", "text");
    await reset
      .getByRole("button", { name: "Hide password", exact: true })
      .click();
    await reset
      .getByLabel("Confirm new password", { exact: true })
      .fill("different-valid-password");
    await reset.getByRole("button", { name: "Save new password" }).click();
    await expect(reset.locator(".flash.error")).toContainText(
      "Passwords must match.",
    );
    await expect(reset.getByLabel("New password", { exact: true })).toHaveValue(
      "",
    );
    await expect(
      reset.getByLabel("Confirm new password", { exact: true }),
    ).toHaveValue("");
    await reset.getByLabel("New password", { exact: true }).fill(replacement);
    await reset
      .getByLabel("Confirm new password", { exact: true })
      .fill(replacement);
    await reset.getByRole("button", { name: "Save new password" }).click();
    await expect.poll(() => new URL(reset.url()).pathname).toBe("/login");
    await expect(
      reset.getByText(
        "Your password has been updated. Log in with your new password.",
        { exact: true },
      ),
    ).toBeVisible();
    await reset
      .getByLabel("Email address", { exact: true })
      .fill(account.email);
    await reset.getByLabel("Password", { exact: true }).fill(account.password);
    await reset.getByRole("button", { name: "Login", exact: true }).click();
    await expect(
      reset.getByText("Email or password is incorrect.", { exact: true }),
    ).toBeVisible();
    await reset
      .getByLabel("Email address", { exact: true })
      .fill(account.email);
    await reset.getByLabel("Password", { exact: true }).fill(replacement);
    await reset.getByRole("button", { name: "Login", exact: true }).click();
    await expect(reset).toHaveURL(/\/requests\?message=/);
    await reset.getByRole("button", { name: "Logout" }).click();
    await expect(reset).toHaveURL(/\/\?message=/);
    await openEmailLink(reset, link);
    await expect(
      reset.getByText(/This reset link is invalid or has expired/),
    ).toBeVisible();
    await expect(
      reset.getByRole("button", { name: "Save new password" }),
    ).toHaveCount(0);
  } finally {
    await newBrowser.close();
  }
});

test("missing and invalid recovery links are rejected; unknown emails get the same confirmation", async ({
  page,
}) => {
  await page.goto("/reset-password");
  await expect(
    page.getByText(/This reset link is invalid or has expired/),
  ).toBeVisible();
  await page.goto(
    "/reset-password#type=recovery&access_token=invalid&refresh_token=invalid",
  );
  await expect(
    page.getByText(/This reset link is invalid or has expired/),
  ).toBeVisible();
  await expect.poll(() => page.evaluate(() => location.hash === "")).toBe(true);
  await page.getByRole("link", { name: "Request a new reset link" }).click();
  await page.getByLabel("Email address").fill(identity().email);
  await page
    .getByRole("button", { name: "Send reset link", exact: true })
    .click();
  await expect(page.getByRole("status")).toContainText(recoveryMessage);
});
