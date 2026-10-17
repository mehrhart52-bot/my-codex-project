import { z } from "zod";
import { RuleError } from "./service";
import { createClient } from "./supabase/server";

const email = z.email().trim().toLowerCase().max(254);

export const registration = z
  .object({
    firstName: z.string().trim().min(1).max(80),
    lastName: z.string().trim().min(1).max(80),
    email,
    phone: z
      .string()
      .trim()
      .min(7)
      .max(30)
      .regex(/^[+\d().\s-]+$/, "Enter a valid phone number."),
    role: z.enum(["supporter", "social_worker"]),
    password: z
      .string()
      .min(12, "Use at least 12 characters for your password.")
      .max(128),
    confirmPassword: z.string(),
  })
  .refine((value) => value.password === value.confirmPassword, {
    message: "Passwords must match.",
    path: ["confirmPassword"],
  });

export async function register(input: unknown) {
  const data = registration.parse(input);
  const supabase = await createClient();
  const { data: result, error } = await supabase.auth.signUp({
    email: data.email,
    password: data.password,
    options: {
      data: {
        first_name: data.firstName,
        last_name: data.lastName,
        phone: data.phone,
        requested_role: data.role,
      },
    },
  });

  if (error) {
    throw new RuleError(
      error.message.toLowerCase().includes("already")
        ? "Unable to create this account. Try signing in instead."
        : error.message,
    );
  }

  return { needsEmailConfirmation: !result.session, role: data.role };
}

export async function authenticate(
  emailInput: unknown,
  passwordInput: unknown,
) {
  const address = email.parse(emailInput);
  const password = z.string().min(1).max(128).parse(passwordInput);
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({
    email: address,
    password,
  });

  if (error) throw new RuleError("Email or password is incorrect.");

  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: profile } = await supabase
    .from("profiles")
    .select("active")
    .eq("id", user?.id ?? "")
    .maybeSingle();
  if (!profile?.active) {
    await supabase.auth.signOut();
    throw new RuleError(
      "This account is unavailable. Contact an administrator.",
    );
  }
}
