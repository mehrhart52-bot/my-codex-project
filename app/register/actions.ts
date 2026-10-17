"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { landingPage } from "@/lib/types";
import { register } from "@/lib/accounts";
import { RuleError } from "@/lib/service";

type RegistrationState = {
  attempt: number;
  values: {
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
    role: string;
  };
  errors: Record<string, string>;
  message: string;
};

export async function registerAction(
  previous: RegistrationState,
  form: FormData,
): Promise<RegistrationState> {
  // Explicit allowlist: passwords never enter returned state, URLs, or logs.
  const value = (name: string, max: number) =>
    String(form.get(name) ?? "").slice(0, max);
  const values = {
    firstName: value("firstName", 80),
    lastName: value("lastName", 80),
    email: value("email", 254),
    phone: value("phone", 30),
    role: form.get("role") === "social_worker" ? "social_worker" : "supporter",
  };
  let result;
  try {
    result = await register(Object.fromEntries(form));
  } catch (error) {
    if (error instanceof Error && "digest" in error) throw error;
    const errors: Record<string, string> = {};
    if (error instanceof z.ZodError) {
      for (const issue of error.issues) {
        const field = String(issue.path[0]);
        errors[field] ??= issue.message;
      }
    }
    return {
      attempt: previous.attempt + 1,
      values,
      errors,
      message:
        error instanceof z.ZodError
          ? "Please correct the marked fields and enter your passwords again."
          : error instanceof RuleError
            ? error.message
            : "Unable to create your account. Please try again.",
    };
  }
  revalidatePath("/", "layout");
  const message = result.needsEmailConfirmation
    ? "Account created. Check your email to confirm your address, then log in."
    : result.role === "social_worker"
      ? "Account created. An administrator must approve your social worker access."
      : "Your account is ready. Thank you for helping.";
  redirect(
    `${result.needsEmailConfirmation ? "/login" : landingPage(result)}?message=${encodeURIComponent(message)}`,
  );
}
