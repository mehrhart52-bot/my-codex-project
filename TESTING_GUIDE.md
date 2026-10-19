# Try the app from start to finish

Use fictional household details while testing. Start the app with `npm run dev`.

## Social worker

1. Select **Create New Account**, choose **Social Worker**, and complete the form.
2. Ask your organization’s administrator to approve your account. They can do this in **Administration**, using **Approved for social work** and **Save permissions**. Select **Check approval status** on your home screen afterward.
3. Select **Create New Request**. Write a short household summary without client names or addresses, select each item and quantity, and submit.
4. Open the request to check that your name, phone number, and email are correct. Supporters can use these to coordinate delivery.
5. Use **View Existing Requests** to return to your requests. The **Show** menu also lets you browse all workers’ requests; select **Search** to apply your filters.
6. Return to request details to see supporter offers and their contact details. Contact supporters directly to coordinate delivery.
7. Close the request when further support is no longer needed. Closure stops new commitments; an administrator can reopen it if necessary.

## Supporter

1. Create an account with **Supporter** as your user type. Administrator approval is not required.
2. Browse requests or search by request number or household summary. Open **View Details** to read the need and see the worker’s contact details.
3. Enter quantities for items you can provide. Leave other quantities at zero, then select **Confirm commitment**.
4. Contact the worker using the phone number or email listed on the request to agree on delivery details. Saving an offer does not schedule delivery or send an email.
5. Use **My Commitments** to return to the request, reduce your quantity, or cancel an offer. Enter zero to cancel. If delivery arrangements have already been made, tell the worker when your plans change.

## Forgot your password?

1. On the login screen, select **Forgot password?**.
2. Enter the email address used for your account and select **Send reset link**.
3. Open the newest email and follow its link. You can use a different browser. When testing locally, keep the app running and open the email on the computer running the app.
4. Enter and confirm a new password of at least 12 characters. Select **Save new password**, then log in with it.

If a link is expired or already used, select **Request a new reset link**. Check the spam folder if the email does not arrive. The demo accounts use fictional addresses, so use an account with a real inbox to try recovery. The developer test lab captures reset mail in an isolated inbox and does not send mail to real recipients.

## Things to try

- Add several items, including **Other**, and remove a row before submitting.
- Try a quantity larger than the amount still needed. The app should stop it.
- Open the same request in two supporter sessions. If one commits first, the other should get a clear message rather than overcommitting the item. Reload the request to see what is still needed.
- Search for something that does not exist, then use **Clear filters**.
- Try the request details on a phone. Read the household summary, review items, and then make an offer.
- Check that a supporter cannot create a request, approve a worker, or see another supporter’s contact details.

## Current limits to plan for before public launch

- Approval and commitment notifications are not sent automatically. Administrators and workers check the app; delivery is coordinated by phone or email.
- Account contact editing is not available in the app yet. Password recovery is available; delivery to real inboxes depends on the project’s email settings. See [email setup notes](SUPABASE_SETUP.md#password-reset-email).
- Older requests without a saved worker contact snapshot remain unchanged. Newly created requests include the worker’s contact details.
- This app tracks commitments, not physical receipt or delivery completion.

The automated browser journey lives in `tests/browser/workflow.spec.ts`. It exercises real signup, approval, request creation, searching, offers, cancellation, closure, role permissions, validation recovery, competing offers, and narrow-screen layout. The optional developer test lab is documented in the README; testers do not need it to use the app.
