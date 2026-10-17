# Supabase setup

Return to **[START_HERE.md](START_HERE.md)** for the normal first run and restart instructions.

## Current development project

The authorized hosted project is configured for fictional development data. Codex has:

- applied `supabase/schema.sql` transactionally;
- enabled email/password sign-in with immediate fictional-account access and a 12-character password minimum;
- configured `http://localhost:3000` for local development;
- created fictional administrator, approved social-worker, supporter, and secondary supporter accounts;
- created a practice request; and
- verified the full browser workflow against the hosted database.

The app uses only the public project URL and publishable/anon key. It never uses the Supabase management token or a service-role key.

## Find the two public app settings

In the Supabase dashboard, open the project and select **Connect**. Copy:

1. **Project URL** — starts with `https://` and ends with `.supabase.co`.
2. **Publishable key** — usually starts with `sb_publishable_`. A legacy `anon` key also works.

Run `npm run dev` in a fresh project download. The first run asks for those values and stores them in the Git-ignored `.env.local` file. Never enter a key labeled **secret** or **service_role**.

## Management-token cleanup

The temporary management token was required only for assisted setup. After Codex confirms the final GitHub push and environment check:

1. Open [Supabase Account → Access Tokens](https://supabase.com/dashboard/account/tokens).
2. Revoke the token named **Codex development setup**.
3. In Codex **Environment settings → Network secrets**, remove the temporary Supabase token entries.
4. Save and publish that environment cleanup.

Revoking this token does not affect the app. The public URL and publishable key remain active.

## Database changes

New projects use [supabase/schema.sql](supabase/schema.sql). Existing projects based on commit `5f12de1` can apply [the dashboard fix](supabase/updates/20261017_fix_dashboard.sql) without recreating data. Updating GitHub code does not apply future SQL changes to a running database.

The setup helper `scripts/hosted-setup.mjs` refuses to initialize a non-empty project unless explicitly resuming the authorized setup. Do not rerun onboarding to install ordinary code changes.

## Operating notes

Everyone using the same project sees the same database, subject to their account role. Stopping the app does not erase Supabase data. A free Supabase project may pause after inactivity; resume it in the dashboard before retrying.

Email confirmation is disabled for this private fictional-data exercise. Hosted email delivery and password recovery are not implemented or verified. Before real-world use, create a separate production project and review access, email, backups, retention, privacy, and organizational requirements.
