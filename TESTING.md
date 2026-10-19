# Developer / Codex test lab

The nontechnical starting guide is [START_HERE.md](START_HERE.md). This optional lab is for reproducible verification. It does not add Docker requirements to the normal hosted-Supabase `npm run dev` path.

## Prerequisites and setup

- Node.js 22 or newer.
- Docker-compatible engine, available to the current user.
- Chromium for browser tests. The runner uses `CHROMIUM_PATH`, then `/usr/bin/chromium` when present, otherwise Playwright's installed Chromium.

From the existing checkout:

```sh
npm ci
npm run lab:setup
npm test
```

If Chromium is not installed, run `npx playwright install chromium` once; Linux may also require its browser system dependencies. The Codex environment already has system Chromium.

The CLI is pinned in the lockfile. Setup starts the project `hta-fictional-development` on API port 54321 and database port 54322, applies the current schema to that isolated database, and creates fictional accounts and a practice request. It never uses hosted app settings and refuses non-loopback database endpoints.

The lab uses Supabase's smaller service images because the standard PostgreSQL image exceeded this cloud container engine's storage limit. Unused storage/realtime/analytics/studio/edge services are disabled. TLS and image verification remain enabled for downloads.

In this cloud environment, BusyBox wget ignores `no_proxy`. If Auth's health probe returns the observed proxy 403, setup installs `scripts/local-auth-healthcheck.sh` inside that container. The wrapper bypasses the proxy only for the exact loopback Auth health probe. Other destinations retain their proxy. The CLI initially retains unhealthy containers for diagnosis; setup independently requires actual healthy database/Auth/gateway/mail containers before applying the schema or reporting success.

## Start, stop, restart

```sh
npm run lab:dev     # start Next.js with this lab's public settings
# Control+C stops the app
npm run lab:stop    # stop this Supabase project, retaining data
npm run lab:setup   # restart, apply current schema, reuse demo accounts
npm run lab:dev
```

The remote Codex onboarding UI does not expose an app preview. Use browser automation or local requests for validation; do not give the user this remote machine's loopback URL as a working address.

The database is in Docker volume `supabase_db_hta-fictional-development`. Existing PostgreSQL containers and their data are untouched. A new Codex machine may not retain Docker volumes even if workspace files are restored; this has not been verified. If the volume is absent, setup creates a new fictional lab and reconciles its demo-account file. It is not a backup of user data.

Local-only files:

- `.local/demo-accounts.json`: random fictional demo passwords, mode 0600.
- `.local/test-stack.json`: local database/API credentials, mode 0600.
- `.local/lab-error.log`: troubleshooting output; may contain local credentials.
- `.env.local`: independent hosted app settings, if configured. The lab does not overwrite it.

Never commit these files or paste their contents into reports.

## Checks

| Command                    | What it proves                                                                                                                                       |
| -------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm run test:unit`        | Validation, roles, contact snapshots, development settings, and password-recovery rules                                                              |
| `npm run test:integration` | Real Supabase Auth and API, approval, dashboard totals, inventory transactions, privacy, permissions, audit, deactivation, and competing commitments |
| `npm run test:browser`     | Chromium signup/approval, requests, offers, draft recovery, mobile layout, and real password-reset email captured in the isolated inbox              |
| `npm run test:hosted`      | The shared-project workflow against hosted Supabase; excludes recovery tests to avoid sending real email or resetting demo passwords                 |
| `npm test`                 | All three suites, sequentially; missing lab/browser prerequisites fail                                                                               |
| `npm run lab:apply`        | Apply the current schema to the local lab and reload the API schema cache                                                                            |
| `npm run typecheck`        | TypeScript verification                                                                                                                              |
| `npm run format:check`     | Formatting                                                                                                                                           |
| `npm run build`            | Production compilation, not an authenticated workflow test                                                                                           |

The browser runner starts and stops its own app server and refuses to reuse an unknown server. Stop your lab app before running browser tests. Traces, screenshots, and videos are disabled to avoid saving passwords or sessions. Failure context and generated artifacts are Git-ignored.

Fixtures use random fictional addresses/passwords and remain in this isolated lab for inspection. Tests do not erase the database. Browser selectors identify their particular request so repeated runs do not collide with earlier records.

The concurrency test locks a request, starts two real HTTP commitments, verifies both are waiting in PostgreSQL, then releases the lock. Exactly one must succeed, and the final committed quantity must not exceed demand. It does not approximate concurrency with sequential requests.

## Dashboard regression and existing databases

The original `list_requests` function was reproduced in a fresh PostgreSQL test database. The SQL regression and full Supabase integration test verify requested and committed totals after a supporter commitment.

`tests/supabase-bootstrap.sql` creates an imitation Auth schema solely for disposable plain-PostgreSQL checks. **Never apply it to Supabase.** The main integration/browser suites use real Supabase Auth instead.

For an existing authorized app database at `5f12de1`, apply `supabase/updates/20261017_fix_dashboard.sql` in a transaction. It replaces one function and reloads the API cache. Verify dashboard totals afterward. The complete `supabase/schema.sql` is the new-project baseline; changing it in Git does not change a running database.

## Verification limits

Local Supabase has email confirmation disabled and captures mail locally; fictional registration requires no email. Tests assert that configuration and successful immediate sign-in. They do not prove hosted email delivery or confirmation-enabled registration.

The hosted browser suite verifies project connectivity and the complete fictional workflow. Password recovery is verified separately against the isolated Mailpit inbox on port 54324, including a different browser, mismatched passwords, old-password rejection, invalid/reused links, and the same confirmation for unknown addresses. This does not establish real inbox delivery from hosted Supabase. Vercel, a user's Mac first run, and fresh-cloud-machine restoration must be verified separately.
