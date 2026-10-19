"use client";
import { useActionState } from "react";
import { requestPasswordReset } from "@/app/forgot-password/actions";
import { Submit } from "./Submit";

export default function ForgotPasswordForm() {
  const [state, formAction] = useActionState(requestPasswordReset, {
    email: "",
    error: "",
    message: "",
  });
  return (
    <form action={formAction} className="card stack">
      {state.error && (
        <p className="flash error" role="alert">
          {state.error}
        </p>
      )}
      {state.message && (
        <div className="flash success" role="status">
          <p>{state.message}</p>
          <p>
            Check your inbox and spam folder. Keep the app running while you
            open the email. Use the newest reset link.
          </p>
        </div>
      )}
      <label>
        Email address
        <input
          type="email"
          name="email"
          autoComplete="email"
          defaultValue={state.email}
          maxLength={254}
          required
        />
      </label>
      <Submit pending="Sending reset link…">
        {state.message ? "Send another reset link" : "Send reset link"}
      </Submit>
    </form>
  );
}
