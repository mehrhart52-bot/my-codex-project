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

## Using your own Supabase project

`npm run dev` already includes the shared fictional demo project's public connection settings. No account setup or key copying is needed for that preview.

To use a different project, open it in the Supabase dashboard and select **Connect**. Copy:

1. **Project URL** — starts with `https://` and ends with `.supabase.co`.
2. **Publishable key** — usually starts with `sb_publishable_`. A legacy `anon` key also works.

Copy `.env.example` to `.env.local` and enter those two values for your own project. The file is excluded from Git. Never enter a key labeled **secret** or **service_role**. Production builds and deployments always use explicitly configured settings; they do not load the shared demo defaults.

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

Email confirmation is disabled for this private fictional-data exercise. Password recovery is implemented and tested with the isolated mail inbox. Delivery to real inboxes on the hosted project has not been verified. Before real-world use, create a separate production project and review access, email, backups, retention, privacy, and organizational requirements.

## Password reset email

The app uses Supabase’s standard password-reset email and its default link template. No SQL, management token, service-role key, or new application secret is needed.

- For local testing, the allowed redirect addresses must include `http://localhost:3000/reset-password` (the existing `http://localhost:3000/**` entry also works). Use the same hostname when opening the app. The optional isolated test lab also allows `127.0.0.1`.
- After deploying to Vercel, add the app’s exact `https://…/reset-password` address under **Authentication → URL Configuration → Redirect URLs**. Set the production **Site URL** to the deployed app’s address.
- Real users need a working email sender. Supabase’s built-in sender may restrict recipients and send volume; configure a supported SMTP provider in the dashboard when needed for real users. Verify delivery with an account whose inbox you control before inviting testers to rely on recovery. No SMTP credential belongs in the app or in chat.
- Leave the reset email’s default confirmation link in place. It verifies the one-time email token and returns to the app’s reset screen. The app clears the returned credentials from the address bar, verifies the session on the server, and only changes the verified account’s password.

Recovery tests use `tests/browser/password-reset.spec.ts` and the isolated mail inbox on port 54324. The hosted browser suite intentionally excludes these tests so it never resets shared demo passwords or sends recovery email to real recipients.
