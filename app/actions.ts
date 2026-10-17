"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser, signOut } from "@/lib/auth";
import { authenticate } from "@/lib/accounts";
import {
  createRequest,
  editRequest,
  commitItems,
  reduceCommitment,
  receiveItems,
  changeStatus,
  updateUser,
  RuleError,
} from "@/lib/service";
export async function action(form: FormData) {
  const op = String(form.get("op") ?? "");
  const id = String(form.get("requestId") ?? "");
  let target = ["login", "register"].includes(op)
    ? `/${op}`
    : op === "user"
      ? "/admin"
      : op === "reduce"
        ? "/commitments"
        : /^[1-9]\d*$/.test(id)
          ? `/requests/${id}`
          : "/requests";
  let message = "Changes saved.";
  let error = false;
  try {
    if (op === "login") {
      await authenticate(form.get("email"), form.get("password"));
      target = "/requests";
      message = "Welcome back.";
    } else if (op === "logout") {
      await signOut();
      target = "/";
      message = "You have been signed out.";
    } else {
      const user = await requireUser();
      if (
        op === "reduce" &&
        user.role === "admin" &&
        /^[1-9]\d{0,17}$/.test(id)
      ) {
        target = `/requests/${id}`;
      }
      if (op === "create") {
        const r = await createRequest(user, {
          summary: form.get("summary"),
          narrative: form.get("narrative"),
          items: JSON.parse(String(form.get("items") ?? "[]")),
        });
        target = `/requests/${r.id}`;
        message = `Request ${r.number} created.`;
      } else if (op === "edit") {
        await editRequest(user, id, {
          summary: form.get("summary"),
          narrative: form.get("narrative"),
          items: JSON.parse(String(form.get("items") ?? "[]")),
          newItems: JSON.parse(String(form.get("newItems") ?? "[]")),
        });
        message = "Request updated.";
      } else if (op === "commit") {
        await commitItems(
          user,
          id,
          JSON.parse(String(form.get("selections") ?? "[]")),
        );
        message = "Thank you! Your commitment has been saved.";
      } else if (op === "reduce") {
        await reduceCommitment(
          user,
          String(form.get("commitmentId")),
          Number(form.get("quantity")),
        );
        message =
          "Commitment updated; unneeded quantities are available again.";
      } else if (op === "receive") {
        await receiveItems(
          user,
          String(form.get("commitmentId")),
          Number(form.get("quantity")),
        );
        message = "Receipt recorded. Thank you.";
      } else if (op === "close" || op === "reopen") {
        await changeStatus(
          user,
          id,
          op === "close" ? "closed" : "open",
          form.get("confirm") === "yes",
        );
        message =
          op === "close"
            ? "Request closed. All records have been preserved."
            : "Request reopened.";
      } else if (op === "user") {
        await updateUser(
          user,
          String(form.get("userId")),
          String(form.get("role")),
          form.get("approved") === "yes",
          form.get("active") === "yes",
        );
        message = "Permissions updated. The change takes effect immediately.";
      } else throw new RuleError("Unknown action.");
    }
  } catch (e) {
    if (e instanceof Error && "digest" in e) throw e;
    error = true;
    message =
      e instanceof RuleError
        ? e.message
        : e instanceof z.ZodError
          ? e.issues[0].message
          : e instanceof SyntaxError
            ? "The form could not be read. Please try again."
            : "Unable to save. Please try again or contact an administrator.";
    if (!(
      e instanceof RuleError ||
      e instanceof z.ZodError ||
      e instanceof SyntaxError
    ))
      console.error("Action failed:", {
        op,
        code: (e as { code?: string })?.code,
      });
    if (op === "create") target = "/requests/new";
    if (op === "edit" && /^[1-9]\d*$/.test(id)) target = `/requests/${id}/edit`;
  }
  revalidatePath("/", "layout");
  redirect(
    `${target}?${error ? "error" : "message"}=${encodeURIComponent(message)}`,
  );
}
