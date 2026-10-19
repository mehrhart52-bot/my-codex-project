"use server";
import { headers } from "next/headers";
import { createClient } from "@supabase/supabase-js";
import { supabaseConfig } from "@/lib/supabase/config";
import {
  recoveryEmail,
  recoveryMessage,
  recoveryRedirect,
} from "@/lib/password-recovery";

export async function requestPasswordReset(
  _previous: { email: string; error: string; message: string },
  form: FormData,
) {
  const email = String(form.get("email") ?? "").slice(0, 254);
  const parsed = recoveryEmail.safeParse(email);
  if (!parsed.success)
    return { email, error: "Enter a valid email address.", message: "" };
  try {
    const { url, key } = supabaseConfig();
    // Supabase's default recovery email supports opening in another browser.
    // No admin key, custom email template, or stored PKCE verifier is needed.
    const client = createClient(url, key, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        flowType: "implicit",
      },
    });
    const { error } = await client.auth.resetPasswordForEmail(parsed.data, {
      redirectTo: recoveryRedirect((await headers()).get("origin")),
    });
    if (error && error.code !== "user_not_found") {
      return {
        email,
        message: "",
        error:
          error.status === 429
            ? "Too many reset requests. Please wait a few minutes before trying again."
            : "We couldn’t send the reset email. Please try again later or contact your administrator.",
      };
    }
    return { email: parsed.data, error: "", message: recoveryMessage };
  } catch {
    return {
      email,
      error:
        "We couldn’t send the reset email. Please try again later or contact your administrator.",
      message: "",
    };
  }
}
