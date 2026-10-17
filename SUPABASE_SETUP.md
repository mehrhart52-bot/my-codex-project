# Supabase setup — step by step

You only need to do this once. Supabase has a free plan suitable for development and review. You will not install Supabase on your computer.

## 1. Create your Supabase account

1. Go to [supabase.com](https://supabase.com/) and select **Start your project**.
2. Sign up with GitHub or with your email address.
3. If Supabase asks for an organization, create one using any clear name, such as `Housing Transition Assistance`.

## 2. Create the project

1. In the Supabase dashboard, select **New project**.
2. Choose your organization.
3. Enter a project name, such as `housing-transition-assistance`.
4. Generate a strong database password and save it in a password manager. The app will not need this password, but you may need it for future database administration.
5. Select a region near Syracuse or your expected users.
6. Choose the Free plan while developing, then select **Create new project**.
7. Wait until the dashboard says the project is ready.

## 3. Create the application database

1. In the left sidebar, open **SQL Editor**.
2. Select **New query**.
3. On GitHub, open `supabase/schema.sql`, select the copy button, and paste the entire file into the query editor.
4. Select **Run**.
5. You should see a success message. Running this file in a new project creates the full application database and its security rules.

If Supabase reports an error, stop and copy the error message into this Codex chat. Do not keep rerunning a partially edited version.

## 4. Configure sign-in for local development

1. Open **Authentication**, then **URL Configuration**.
2. Set **Site URL** to `http://localhost:3000`.
3. Add `http://localhost:3000/**` to **Redirect URLs** if it is not already allowed.
4. Open **Authentication → Providers → Email**.
5. Keep email/password sign-in enabled.

For the easiest private preview, you may temporarily turn **Confirm email** off. New accounts can then sign in immediately. Before inviting real users, turn it back on and configure a production email provider in Supabase so confirmation and recovery messages are delivered reliably.

## 5. Connect the app

1. Open **Project Settings → API Keys**. In some dashboard layouts this is called **Settings → API**.
2. Find the **Project URL**. It looks like `https://abcdefgh.supabase.co`.
3. Find the **Publishable key**. A legacy `anon` key also works if that is what your dashboard shows. Do not use the `service_role` or secret key.
4. In the app's terminal, run:

   ```sh
   npm run dev
   ```

5. Paste the project URL and publishable key when prompted.
6. When the terminal says the server is ready, open [http://localhost:3000](http://localhost:3000).

The values are saved in `.env.local`, which Git ignores. You will not be asked again on that computer unless the file is removed.

## 6. Create the first administrator

1. In the running application, choose **Create New Account** and register yourself as a Supporter. Use the same email you want for the administrator account.
2. If email confirmation is enabled, open the confirmation email before continuing.
3. Return to Supabase's **SQL Editor** and create a new query.
4. Paste the following statement, replacing the example address with the exact lowercase email you registered:

   ```sql
   update public.profiles
   set role = 'admin', approved = true, updated_at = now()
   where email = lower('your-email@example.com');
   ```

5. Select **Run**. The result should say one row was affected.
6. Refresh the application. You should now see **Administration** in the navigation.

This SQL step is deliberately outside ordinary registration, so nobody can make themselves an administrator through the website. After the first administrator exists, use the Administration screen to approve social workers or appoint another administrator.

## 7. Check the main workflow

Use fictional information while developing:

1. Register a second account as a Social Worker.
2. In the administrator account, open **Administration**, approve that social worker, and save.
3. Log in as the social worker and create a request with two household items.
4. Register a Supporter account and commit to an item.
5. Return as the social worker, confirm a partial or complete receipt, then close the request.

Do not enter names or identifying details for real clients while testing.

## Sharing development with another person

Each developer can clone the GitHub repository and run `npm run dev`. On their first run, they paste the same project URL and publishable key. They do not need Docker, a local database, or your database password.

Everyone connected to the same Supabase project sees the same development data. Create a separate Supabase project later if you want development and production data kept apart; this is recommended before launch.

## Later: deploying to Vercel

Do this after local development is approved:

1. Go to [vercel.com](https://vercel.com/) and sign up with the GitHub account that can access this repository.
2. Select **Add New → Project** and import `mehrhart52-bot/my-codex-project`.
3. Vercel should detect Next.js automatically. Keep the default build settings.
4. Under **Environment Variables**, add:

   - `NEXT_PUBLIC_SUPABASE_URL` — your Supabase Project URL
   - `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` — your Supabase publishable key

5. Select **Deploy**. Vercel will build the app and provide an address ending in `.vercel.app`.
6. Return to Supabase **Authentication → URL Configuration**.
7. Change **Site URL** to the exact Vercel production address and add both of these redirect entries:

   - your exact Vercel address followed by `/**`
   - `http://localhost:3000/**` so local development continues to work

8. Test registration, login, each role, one commitment, and one receipt on the deployed site before inviting anyone.

For production, use a separate Supabase project, enable email confirmation, configure custom SMTP email delivery, turn on Supabase backups appropriate to your plan, and use Vercel's production environment-variable scope. The publishable key may be present in browser code; never add the Supabase secret/service-role key to this application.
