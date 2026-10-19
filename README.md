# Housing Transition Assistance

Helping neighbors make a house a home.

**[Start here → START_HERE.md](START_HERE.md)** explains the current setup, opening and restarting the app, and a fictional-data exercise.

For a plain-language walkthrough of both roles, see [the testing guide](TESTING_GUIDE.md).

The app connects social workers managing household needs with supporters who provide items. It supports staff approval, public household summaries, commitments, reductions, cancellation, manual closure, administrator reopening, and audit records.

## Normal development

After the hosted Supabase project is configured, install Node.js 22 or newer, open a terminal in this project folder, and run:

```sh
npm run dev
```

The first run installs missing packages and prompts for the Supabase project URL and publishable (or legacy anon) key. Subsequent runs start directly. Docker and the Supabase CLI are **not required** for this hosted development path. See [Supabase setup](SUPABASE_SETUP.md) if the project is not connected yet.

The app runs on the computer where the command executes; authentication and data live in the selected Supabase project. A local address in Codex's remote workspace does not open the app on your Mac.

## Developer verification

```sh
npm run test:unit     # no database required
npm run typecheck
npm run format:check
npm run build
```

The complete `npm test` suite also runs real Supabase integration and Chromium browser tests. Prepare the optional isolated Docker test lab first; see [TESTING.md](TESTING.md). Missing prerequisites cause a failure, not silently skipped tests.

## Database and access control

New projects use [supabase/schema.sql](supabase/schema.sql). Existing projects at migration commit `5f12de1` can apply [the dashboard fix](supabase/updates/20261017_fix_dashboard.sql) without recreating tables. Updating code alone does not apply SQL.

All application mutations use database functions that verify the current account and role. Inventory operations lock the request to prevent competing commitments from exceeding demand. Row-level security and table permissions prevent direct reads of private request data. Owners and administrators can see private narratives; supporters receive public summaries and their own commitments.

Signed-in request viewers can see the submitting worker's phone number and email address directly below their name on request details. Email and phone links let supporters coordinate delivery with the worker.

New requests save a snapshot of the submitting worker's contact details with the existing public description. Saving a request again refreshes that snapshot from the worker's profile, including when an administrator edits it. Older requests are left untouched. No Supabase schema, permission, or token changes are required. The app reserves room for the contact details within the existing description length limit.

The app uses only a publishable/anon key. It never uses the management token or a service-role key. The optional isolated test-lab tooling uses local administrative credentials to prepare fictional fixtures.

[Later Vercel deployment](DEPLOYMENT.md) is separate from first-run testing. This stack does not establish healthcare or privacy compliance. Self-service password recovery is available from **Forgot password?** on the login screen. The complete email flow is tested against the isolated mail inbox; real inbox delivery must be verified with the project’s email provider. See [password reset email](SUPABASE_SETUP.md#password-reset-email).
