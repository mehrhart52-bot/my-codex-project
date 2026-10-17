# Housing Transition Assistance

Helping neighbors make a house a home.

An operational Next.js / TypeScript application for household furnishing requests, supporter commitments, and confirmed deliveries. Uses PostgreSQL 17, parameterized SQL via `pg`, versioned transactional migrations, and encrypted `iron-session` cookies backed by revocable database sessions. All application records persist in PostgreSQL; there is no in-memory data store or fake authentication. The interface uses responsive plain CSS to keep the dependency surface small.

## Local setup

Requirements: Node.js 22 or later, npm, PostgreSQL 17 (or Docker with Compose).

```sh
npm ci
cp .env.example .env.local
```

Edit `.env.local`: choose a unique `POSTGRES_PASSWORD`, put the same URL-encoded password in `DATABASE_URL` and `TEST_DATABASE_URL`, and set `SESSION_SECRET` to at least 32 random characters (`openssl rand -base64 48`). This file is ignored by Git. Do not use example credentials in production. When using an existing database, point `DATABASE_URL` at it and skip Docker.

```sh
docker compose --env-file .env.local up -d --wait db
npm run db:migrate
npm run dev
```

Open the development server at port 3000 in your local browser or hosting platform's authenticated preview. On cloud onboarding, localhost is used only for internal validation; the onboarding UI does not provide a web preview. An external preview requires your hosting platform's routing. Do not expose development mode to the public Internet. `npm run build` followed by `npm start` runs production mode; use HTTPS because production session cookies are Secure.

The database volume survives container restarts. **Do not run `docker compose down -v` unless you intend to erase all local records.** Migrations are repeatable and protected by a PostgreSQL advisory lock and checksums. Never edit an applied migration; add another migration instead.

### First administrator

Ordinary registration never grants administrator access. On a trusted machine with the intended `DATABASE_URL`, temporarily supply the following environment variables through a secure shell or secret manager:

- `BOOTSTRAP_ADMIN_EMAIL`
- `BOOTSTRAP_ADMIN_PASSWORD` (16–128 characters)
- `BOOTSTRAP_ADMIN_FIRST_NAME`
- `BOOTSTRAP_ADMIN_LAST_NAME`
- `BOOTSTRAP_ADMIN_PHONE`

Run `npm run admin:create`, then remove these bootstrap variables. The CLI refuses to run if an active administrator already exists and never promotes an existing self-registered account. There is no bootstrap HTTP endpoint. The first administrator can approve social workers and appoint additional administrators in Administration. Disabling or changing a user's permissions revokes their existing sessions. The last active administrator cannot be removed through the application.

### Optional fictional demonstration data

On an isolated development database, set `ALLOW_DEMO_SEED=true` and a unique `DEMO_PASSWORD` of 16–128 characters, then run `npm run db:seed`. This creates fictional households, an approved `worker@example.test` account, and a `supporter@example.test` account using that password. It includes a partial receipt example. It does not create an administrator, overwrite accounts, or run in production. Remove the temporary seed variables afterward. Never seed a production database or publish an environment containing credentials or records you do not intend to share.

## Workflow

1. Supporters self-register and can immediately browse authenticated public summaries.
2. Staff choose Social Worker during registration; an administrator must approve staff permissions.
3. Approved social workers create requests with a private narrative, a non-identifying summary, and any number of household items. Request numbers and timestamps are assigned by PostgreSQL.
4. Supporters commit to one or more available items. My Commitments allows reducing or cancelling undelivered quantities. A partial receipt establishes the minimum retained total.
5. The requesting worker or an administrator sees supporter contact details and records quantities delivered on each occasion. Receipt records and audit history are retained.
6. When every requested unit is received, the dashboard shows a ready-for-closure notice. Closure is manual and requires confirmation. Staff may also close an incomplete request when help is no longer needed. Only administrators can reopen it.

Public summaries are visible only after login. Private narratives are available only to the approved owning worker and administrators. Other workers have no automatic access to a colleague's private narrative. Supporters see only their own commitment records and never another supporter's contact details. Closed requests remain searchable history. Committed totals include received items; available-to-commit = requested minus committed, while still-needed = requested minus received.

Existing request items are retained for history. Owners can edit descriptions, increase/decrease quantities down to the committed amount, and add new items. To withdraw a committed need, coordinate a commitment reduction first; received quantities cannot be removed. Request date and owning worker are not editable.

## Verification

Create a **separate disposable database**, ending in `_test`. Both test commands erase its application records. Do not run the integration and browser suites concurrently against the same test database.

```sh
docker compose --env-file .env.local exec db createdb -U hta hta_test
# Ensure TEST_DATABASE_URL in .env.local points to that database.
npm test
npx playwright install chromium
npm run test:e2e
npm run typecheck
npm run build
npm audit --omit=dev
```

If Chromium is already installed, use `BROWSER_EXECUTABLE_PATH=/usr/bin/chromium npm run test:e2e` instead of downloading a browser. The browser runner starts its own development server on port 3101 with the disposable database. No production or demonstration data is used. Install Playwright's documented system dependencies if your machine lacks them. Browser downloads may require `cdn.playwright.dev` and its redirect destinations to be allowed by your network policy.

The integration suite covers authentication, registration, approval, server authorization, privacy, simultaneous commitments, database constraints, atomic multi-item commitments, simultaneous receipts, partial receipts, cancellations, ownership checks, unique request numbers, closure/reopening, stale-role revocation, and last-administrator protection. Browser tests exercise the actual forms and role transitions end to end, protected routes, and mobile overflow. `npm run format:check` checks source formatting.

## Security and data model

- Passwords use salted scrypt (`N=32768, r=8, p=3`); minimum length is 12 characters. Passwords and secret values are never logged.
- Cookie sessions expire after 12 hours, are HttpOnly and SameSite=Lax, and are Secure in production. A random session token is stored only as a SHA-256 digest in the database. Logout revokes it. Role and active status are looked up server-side on every request, and rechecked under a database lock for writes.
- Next.js Server Actions enforce same-origin action requests. Forms use browser validation plus Zod server validation. Queries are parameterized and React escapes rendered content. Security headers prohibit framing and restrict resource origins. CSP currently allows inline scripts/styles for Next.js hydration; consider nonce-based CSP as deployment hardening.
- Account login throttling is database-backed (10 attempts per email per 15 minutes); registration allows 5 attempts per email per hour. Put production behind a trusted edge with IP-based abuse protection as well. There is no external email, password reset email, payment, delivery scheduling, or analytics system.
- All inventory changes lock the parent request before reading quantities and writing records. PostgreSQL checks and inventory triggers provide additional guards. Multi-item reservations are all-or-nothing. Receipt inserts, totals, and audit events share one transaction. Application writes should go through `lib/service.ts`.
- Tables: users (role, approval, activity), sessions, login limits, catalog, requests, request items, commitments, receipts, audit history, schema migrations. Audit metadata records identifiers and quantities, not private narratives. Creation/update timestamps are stored on mutable entities; receipt/audit rows are immutable application events.
- Administrator audit view shows the latest 100 events; full history remains in PostgreSQL. Receipts are append-only through the application. No destructive delete feature is provided.

## Production deployment

Use any supported Node.js host (including Vercel) with a persistent managed PostgreSQL database. Supply `DATABASE_URL` and a strong, stable `SESSION_SECRET` through the host's secret settings. Do not commit `.env.local`, reuse demonstration passwords, or run demonstration seeding. Production does not need `POSTGRES_PASSWORD` if the database is managed externally. `TEST_DATABASE_URL` belongs only in development/CI.

1. Provision PostgreSQL, enable provider-supported verified TLS, configure backups and point-in-time recovery, and restrict network/database access to the application. Use the provider's verified connection instructions; do not disable certificate verification. A least-privilege runtime database role should have table/sequence DML access; use a separate migration owner for schema changes.
2. Run `npm ci`, provide the environment variables, run `npm run db:migrate` once as a deployment step, then `npm run build` and `npm start` (or use the host's Next.js integration). CLI commands currently read `.env.local`; in production create an empty ignored `.env.local` if variables are injected directly. Never place secrets in build logs or command arguments. The host can use `PORT` for its assigned port.
3. Create the first administrator with the secure CLI; remove bootstrap credentials and approve only verified staff. Confirm application routes and Server Actions work through the real HTTPS origin. Never trust arbitrary forwarded-host headers; if using a reverse proxy, forward only your configured host/origin.
4. Before handling real household information, establish staff verification, access review, data retention and audit policies, database restore drills, error monitoring that excludes private content, and a secure account-recovery procedure. There is no self-service password recovery in this version. Confirm privacy practices with the organization and perform a deployment-specific security review.

The code is a working first version, not a claim of production certification. Keep client names, contact details, exact addresses, and unnecessary identifying information out of both descriptions. Database backups and user contact information must be protected as sensitive data.

## Project structure

- `app/`: server-rendered pages, role-aware navigation, Server Actions, styles.
- `components/`: dynamic item editor, multi-item commitment form, pending states, shared UI.
- `lib/service.ts`: authorization, inventory transactions, privacy-scoped queries, audit writes.
- `lib/accounts.ts`, `lib/auth.ts`, `lib/password.ts`: account validation, throttling, encrypted/revocable sessions, password hashing.
- `migrations/`: relational schema and database constraints.
- `scripts/`: migrations, secure administrator bootstrap, opt-in demo seed, safe test runners.
- `tests/`, `e2e/`: real PostgreSQL integration tests and Chromium workflow tests.

Each cloud task is already isolated. Use the existing checkout; do not create a Git worktree unless explicitly requested.

## This cloud environment

For cloud onboarding, use the Compose override to store the PostgreSQL cluster in `/workspace/.hta-postgres`, which is outside the Git checkout and can be included in the environment filesystem snapshot:

```sh
npm run env:init  # creates random local secrets only if .env.local does not exist
npm ci --cache /workspace/.cache/npm
docker compose -f compose.yaml -f compose.cloud.yaml --env-file .env.local up -d --wait db
npm run db:migrate
npm run dev
```

Database files and `.env.local` are retained files; PostgreSQL and Next.js processes must restart in a new task. Do not run both Compose modes or another PostgreSQL container on port 5432 at once. Publication and restoration in a new task are separate from validation in this machine. For shared or production use, configure an external PostgreSQL service instead of treating a development snapshot as a managed database or backup service.
