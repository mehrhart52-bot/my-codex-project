# Housing Transition Assistance

Helping neighbors make a house a home.

This application connects social workers managing household needs with community supporters who can provide individual items. It includes secure accounts, staff approval, private case narratives, commitments, partial receipts, request closure, and audit history.

## The simple development setup

The app uses Supabase for sign-in and data storage. You do **not** need Docker, PostgreSQL, a database password, or special command-line tools.

After creating the free Supabase project described in [SUPABASE_SETUP.md](SUPABASE_SETUP.md), open a terminal in this folder and run:

```sh
npm run dev
```

On the first run, the command:

1. installs the app's packages if they are missing;
2. asks for the Supabase project URL and publishable key;
3. saves those values in the private, Git-ignored `.env.local` file; and
4. starts the site at [http://localhost:3000](http://localhost:3000).

After that, `npm run dev` starts the app directly. Press `Control+C` in the terminal to stop it.

Node.js 22 or newer is the only local prerequisite. GitHub Codespaces already provides it. On a Mac, install the current LTS release from [nodejs.org](https://nodejs.org/) if the `npm` command is unavailable.

## Supabase

The complete database setup is in [supabase/schema.sql](supabase/schema.sql). Run it once in the Supabase SQL Editor. It creates the tables, indexes, account-profile trigger, audit records, row-level security, and transactional database functions used by the application.

The browser receives only Supabase's publishable key. This is intentional and safe to expose. The app does not use a Supabase service-role key, database password, or custom session secret. Supabase Auth stores passwords and manages secure sessions.

All data changes go through database functions that check the signed-in user again. Request inventory changes lock the parent request so simultaneous supporters cannot overcommit an item. Row-level security blocks direct access to private tables. Supporters receive only public summaries and their own commitments; a request's owner and administrators receive its private narrative and active supporter contact details.

## Useful commands

```sh
npm run dev          # install if needed, configure on first run, and start
npm test             # validation and permission-helper tests
npm run typecheck    # TypeScript checks
npm run format:check # formatting check
npm run build        # production build used by Vercel
```

## Roles

- Supporters can register, browse requests, make commitments, and reduce or cancel undelivered quantities.
- Social workers can register, but an administrator must approve them before they can create requests. They can manage only their own requests.
- Administrators can approve staff, manage permissions, see all requests, reopen closed requests, and review audit history.

Ordinary registration can never create an administrator. The one-time first-administrator step is performed in the Supabase SQL Editor and is documented in [SUPABASE_SETUP.md](SUPABASE_SETUP.md).

## Deployment

The intended production host is Vercel. Vercel builds the GitHub repository and needs the same two public Supabase settings used locally. No server or database needs to run on your computer. The complete guided deployment comes after local review in [SUPABASE_SETUP.md](SUPABASE_SETUP.md#later-deploying-to-vercel).

Before real client information is entered, enable email confirmation, configure reliable email delivery, review staff access, establish backup and retention policies, and complete an organization-specific privacy and security review. Continue to keep client names, contact details, exact addresses, and other unnecessary identifying information out of request descriptions.
