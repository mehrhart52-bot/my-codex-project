"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { newPassword } from "@/lib/password-recovery";

export async function verifyRecoverySession(
  accessToken: string,
  refreshToken: string,
) {
  if (
    typeof accessToken !== "string" ||
    typeof refreshToken !== "string" ||
    accessToken.length > 16000 ||
    refreshToken.length > 2000
  )
    return null;
  try {
    const client = await createClient();
    const { error } = await client.auth.setSession({
      access_token: accessToken,
      refresh_token: refreshToken,
    });
    if (error) return null;
    const {
      data: { user },
      error: userError,
    } = await client.auth.getUser();
    if (userError || !user?.email) return null;
    return { id: user.id, email: user.email };
  } catch {
    return null;
  }
}

export async function updatePassword(
  previous: { attempt: number; error: string },
  form: FormData,
) {
  const failed = (error: string) => ({ attempt: previous.attempt + 1, error });
  const parsed = newPassword.safeParse({
    password: form.get("password"),
    confirmPassword: form.get("confirmPassword"),
  });
  if (!parsed.success) return failed(parsed.error.issues[0].message);
  try {
    const client = await createClient();
    const {
      data: { user },
      error,
    } = await client.auth.getUser();
    if (error || !user || user.id !== form.get("userId"))
      return failed(
        "Your reset session has expired or changed. Request a new reset link below.",
      );
    const { error: updateError } = await client.auth.updateUser({
      password: parsed.data.password,
    });
    if (updateError) {
      if (updateError.code === "same_password")
        return failed(
          "Choose a password different from your current password.",
        );
      if (updateError.code === "weak_password")
        return failed(
          "Choose a stronger password with at least 12 characters, including letters and numbers.",
        );
      return failed(
        "We couldn’t update your password. Try again, or request a new reset link below.",
      );
    }
    await client.auth.signOut();
  } catch {
    return failed(
      "We couldn’t update your password. Try again, or request a new reset link below.",
    );
  }
  revalidatePath("/", "layout");
  redirect(
    "/login?message=" +
      encodeURIComponent(
        "Your password has been updated. Log in with your new password.",
      ),
  );
}
