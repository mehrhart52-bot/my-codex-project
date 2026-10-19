import Link from "next/link";
import ForgotPasswordForm from "@/components/ForgotPasswordForm";

export const metadata = { title: "Forgot password" };
export default function ForgotPassword() {
  return (
    <div className="auth-shell">
      <p className="eyebrow">Account access</p>
      <h1>Forgot your password?</h1>
      <p className="muted">
        Enter the email address you used to create your account. We’ll send a
        link to choose a new password.
      </p>
      <ForgotPasswordForm />
      <Link className="text-link" href="/login">
        Back to login
      </Link>
    </div>
  );
}
