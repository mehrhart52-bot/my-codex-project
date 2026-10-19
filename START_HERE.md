# Start here — previewing Housing Transition Assistance

The application and its hosted Supabase development database are ready for fictional-data testing. Supabase keeps the accounts and requests when the app stops. Vercel has not been set up yet, so there is no public web address.

## Preview in your browser with GitHub Codespaces

1. Open [the GitHub repository](https://github.com/mehrhart52-bot/my-codex-project), select **Code → Codespaces**, and open your existing Codespace or create one on `main`.
2. In its terminal, run `npm run dev`. A fresh checkout connects to the shared fictional demo project automatically.
3. When port 3000 is detected, select **Open in Browser**. You can also open **Ports** and select the globe beside port 3000. Keep visibility **Private**.
4. The first page offers **Login** and **Create New Account**. Approved social workers get a choice to create or view requests; supporters go directly to existing requests. New social workers need administrator approval to create requests.

To update an existing Codespace after Codex pushes changes, stop the running app with **Control+C**, run `git pull --ff-only origin main`, and run `npm run dev` again. If Git reports local changes or a conflict, ask for help before discarding anything. Refresh the preview tab afterward.

Stop the Codespace when finished; GitHub applies usage allowances and possible charges according to your account.

## The easiest preview on your Mac

1. Install the current **LTS** version of Node.js from [nodejs.org](https://nodejs.org/) if it is not already installed. Open a new Terminal afterward. Node.js 22 or newer is required.
2. Open [the GitHub repository](https://github.com/mehrhart52-bot/my-codex-project). Select **Code → Download ZIP**, open the ZIP in Finder, and keep the extracted folder somewhere convenient, such as Documents.
3. In Finder, right-click the extracted project folder and choose **Services → New Terminal at Folder**. If that option is missing, open Terminal, type `cd ` (including the space), drag the folder into Terminal, and press Return.
4. Type `npm run dev` and press Return. The first run installs the app's packages automatically.
5. Wait for **Ready**, then open [http://localhost:3000](http://localhost:3000) in Safari or Chrome.

You should see **Housing Transition Assistance**, a login form, and a **Create New Account** link. The local address works only while `npm run dev` is running on that Mac.

Enter your email address and password, then select **Login**. The eye beside the password lets you check what you typed. Demo accounts use this same form as real accounts; there are no demo login buttons.

## Stop and restart

- **Stop:** select the Terminal window and press **Control+C**.
- **Restart:** open Terminal at the same project folder and run `npm run dev` again.
- **After restarting the Mac:** repeat the restart step. You do not need to recreate Supabase or enter its settings again.

`npm run dev` includes the public connection settings for the shared fictional demo project. A fresh download needs no setup, and an older download pointing to this demo project uses the verified public key automatically. You do not need to edit `.env.local` or copy a key.

If you explicitly configure a different project in `.env.local`, the app uses that project instead. Production builds and deployments require their own settings; the demo defaults apply only to `npm run dev`.

## Demo accounts

Use these accounts with the fictional development project (`naxlbpsjoonktjbieyft`). Each uses the same password: **`RescueDemo2026!`** (capital **R** and **D**, with an exclamation mark at the end).

| Role          | Email address                |
| ------------- | ---------------------------- |
| Administrator | `demo-admin@example.com`     |
| Social Worker | `demo-worker@example.com`    |
| Supporter     | `demo-supporter@example.com` |

Type the email and password into the login form and select **Login**. Replace any old password saved by your browser. These credentials are only for fictional development testing; a separate production Supabase project needs its own accounts and private passwords.

These demo accounts belong to the shared development project. They are not created automatically in other Supabase projects.

The app also allows you to register more fictional accounts. Social workers require administrator approval before they can create requests. Ordinary registration cannot create an administrator.

## A short fictional-data exercise

Use **Logout** before changing accounts, or use separate private browser windows.

1. Sign in as the administrator and open **Administration**.
2. Register a fictional social worker. Confirm that approval is pending.
3. As the administrator, approve that worker.
4. As the worker, create a request using only fictional details.
5. As a supporter, commit to an item. Confirm that private household information is hidden.
6. As the worker, review the commitments and close the request.
7. As the administrator, reopen it.

Codex has automated this entire workflow against the hosted project, including account registration, approval, commitments, cancellation, closure, reopening, and privacy checks.

## What each service does

| Service  | Purpose                                                    |
| -------- | ---------------------------------------------------------- |
| GitHub   | Stores the application code and change history.            |
| Supabase | Stores accounts, requests, commitments, and audit history. |
| Your Mac | Runs the app during local development.                     |
| Vercel   | Can host the app later and provide a public web address.   |

For project details, see [Supabase setup](SUPABASE_SETUP.md). For a later public deployment, see [Vercel deployment](DEPLOYMENT.md). Use only fictional information until production access, privacy, backups, email, and recovery requirements have been reviewed.
