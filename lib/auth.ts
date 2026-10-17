import { redirect } from "next/navigation";
import { createClient } from "./supabase/server";
import type { User } from "./types";

export async function currentUser(): Promise<User | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile, error } = await supabase
    .from("profiles")
    .select("id,first_name,last_name,email,phone,role,approved,active")
    .eq("id", user.id)
    .maybeSingle();

  if (error || !profile?.active) return null;
  return profile as User;
}

export async function requireUser() {
  const user = await currentUser();
  if (!user) redirect("/login");
  return user;
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
}
