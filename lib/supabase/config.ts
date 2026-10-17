export function supabaseConfig() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if (!url || !key) {
    throw new Error(
      "Supabase is not configured. Run npm run dev and follow the setup prompts, or copy .env.example to .env.local.",
    );
  }

  return { url, key };
}
