# Later: a shareable preview or Vercel production deployment

This is separate from first-run testing. Start with [START_HERE.md](START_HERE.md).

No Vercel account, deployment, or public app address has been created. Obtain authorization for the specific hosting resource, its plan/cost, and intended audience before creating it.

## A shareable development preview

A deployed preview is a web-accessible application, even if its database contains only fictional information. Agree who may access it, review available deployment protection, and keep it connected only to the development Supabase project. Do not assume a preview URL is private.

## Vercel, when you are ready

1. Open [vercel.com](https://vercel.com/) and sign in with the GitHub account that can access this repository. Review plan eligibility, limits, and charges before selecting a plan.
2. Choose **Add New → Project**, then import `mehrhart52-bot/my-codex-project`. Allow Vercel access only to the repository you intend to deploy.
3. Keep the detected **Next.js** settings. Add the two application environment variables: `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`. Use the appropriate development or production Supabase project. Never add the management token or a secret/service-role key.
4. Select **Deploy**. A successful build gives you a Vercel app address.
5. Configure the exact address in Supabase **Authentication → URL Configuration**. Keep development and production redirect settings scoped appropriately.
6. Verify login, each role, private-data restrictions, a commitment, closure, and reopening on that deployed address. A successful build alone is not verification.

GitHub pushes can trigger new Vercel builds after that integration exists. SQL updates still require a separate authorized database step.

## Before real-world use

Use a separate production Supabase project. Review staff access, email confirmation, reliable email delivery, backups/restoration, retention, and organization-specific security/privacy requirements. Confirmation-enabled hosted registration and email delivery are not verified by the local fictional-data tests.

Password recovery is not implemented in this application. Do not invite users with a promise of a working recovery flow until one is implemented and tested.

Using Next.js, Supabase, or Vercel does not establish healthcare or privacy compliance.
