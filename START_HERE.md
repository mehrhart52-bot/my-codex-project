# Start here — previewing Housing Transition Assistance

The application and its hosted Supabase development database are ready for fictional-data testing. Supabase keeps the accounts and requests when the app stops. Vercel has not been set up yet, so there is no public web address.

## The easiest preview on your Mac

1. Install the current **LTS** version of Node.js from [nodejs.org](https://nodejs.org/) if it is not already installed. Open a new Terminal afterward. Node.js 22 or newer is required.
2. Open [the GitHub repository](https://github.com/mehrhart52-bot/my-codex-project). Select **Code → Download ZIP**, open the ZIP in Finder, and keep the extracted folder somewhere convenient, such as Documents.
3. In Finder, right-click the extracted project folder and choose **Services → New Terminal at Folder**. If that option is missing, open Terminal, type `cd ` (including the space), drag the folder into Terminal, and press Return.
4. Type `npm run dev` and press Return. The first run installs the app's packages automatically.
5. When prompted, paste the **Project URL** and **Publishable key** from your Supabase project's **Connect** dialog. Never use a secret or service-role key.
6. Wait for **Ready**, then open [http://localhost:3000](http://localhost:3000) in Safari or Chrome.

You should see **Housing Transition Assistance** and **Helping neighbors make a house a home**. The local address works only while `npm run dev` is running on that Mac.

## Stop and restart

- **Stop:** select the Terminal window and press **Control+C**.
- **Restart:** open Terminal at the same project folder and run `npm run dev` again.
- **After restarting the Mac:** repeat the restart step. You do not need to recreate Supabase or enter its settings again.

The settings are stored in `.env.local` inside the project folder and excluded from Git.

## Demo accounts

Codex created four fictional hosted accounts: administrator, approved social worker, supporter, and another supporter. Their random passwords are stored only in the secure, Git-ignored file `.local/hosted-demo-accounts.json` in the Codex workspace. Save the details in your password manager before this cloud workspace is discarded.

The app also allows you to register more fictional accounts. Social workers require administrator approval before they can create requests. Ordinary registration cannot create an administrator.

## A short fictional-data exercise

Use **Logout** before changing accounts, or use separate private browser windows.

1. Sign in as the administrator and open **Administration**.
2. Register a fictional social worker. Confirm that approval is pending.
3. As the administrator, approve that worker.
4. As the worker, create a request using only fictional details.
5. As a supporter, pledge an item. Confirm that the private household circumstances are hidden.
6. As the worker, record a partial delivery and close the request.
7. As the administrator, reopen it.

Codex has automated this entire workflow against the hosted project, including account registration, approval, pledging, partial receipt, cancellation, closure, reopening, and privacy checks.

## What each service does

| Service  | Purpose                                                  |
| -------- | -------------------------------------------------------- |
| GitHub   | Stores the application code and change history.          |
| Supabase | Stores accounts, requests, pledges, and deliveries.      |
| Your Mac | Runs the app during local development.                   |
| Vercel   | Can host the app later and provide a public web address. |

For project details, see [Supabase setup](SUPABASE_SETUP.md). For a later public deployment, see [Vercel deployment](DEPLOYMENT.md). Use only fictional information until production access, privacy, backups, email, and recovery requirements have been reviewed.
