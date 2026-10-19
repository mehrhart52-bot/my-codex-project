import { z } from "zod";

export const recoveryEmail = z
  .string()
  .trim()
  .toLowerCase()
  .max(254)
  .pipe(z.email());
export const newPassword = z
  .object({
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

// Origin comes from the request validated by Next's Server Action origin check,
// never from a form field or a user-supplied return URL.
export function recoveryRedirect(origin: string | null) {
  if (!origin) throw new Error("Missing application origin");
  const url = new URL(origin);
  const local = ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
  if (
    (url.protocol !== "https:" && !(local && url.protocol === "http:")) ||
    url.username ||
    url.password
  ) {
    throw new Error("Invalid application origin");
  }
  return new URL("/reset-password", url.origin).href;
}

export const recoveryMessage =
  "If an account exists for that email, you’ll receive a password reset link shortly.";
