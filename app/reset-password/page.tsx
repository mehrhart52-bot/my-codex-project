import ResetPasswordForm from "@/components/ResetPasswordForm";
export const metadata = {
  title: "Reset password",
  referrer: "no-referrer" as const,
};
export default function ResetPassword() {
  return (
    <div className="auth-shell">
      <p className="eyebrow">Account access</p>
      <h1>Choose a new password</h1>
      <ResetPasswordForm />
    </div>
  );
}
