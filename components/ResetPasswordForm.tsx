"use client";
import Link from "next/link";
import { useActionState, useEffect, useRef, useState } from "react";
import {
  updatePassword,
  verifyRecoverySession,
} from "@/app/reset-password/actions";
import { PasswordInput } from "./PasswordInput";
import { Submit } from "./Submit";

async function openRecoveryLink() {
  const fragment = new URLSearchParams(window.location.hash.slice(1));
  // Remove credentials/errors from browser history before making any request.
  window.history.replaceState(null, "", window.location.pathname);
  const accessToken = fragment.get("access_token");
  const refreshToken = fragment.get("refresh_token");
  if (
    fragment.get("error") ||
    fragment.get("type") !== "recovery" ||
    !accessToken ||
    !refreshToken
  )
    return null;
  try {
    return await verifyRecoverySession(accessToken, refreshToken);
  } catch {
    return null;
  }
}

export default function ResetPasswordForm() {
  const opening = useRef<ReturnType<typeof openRecoveryLink> | null>(null);
  const [account, setAccount] = useState<{ id: string; email: string } | null>(
    null,
  );
  const [checking, setChecking] = useState(true);
  const [state, formAction] = useActionState(updatePassword, {
    attempt: 0,
    error: "",
  });
  const feedback = useRef<HTMLParagraphElement>(null);
  useEffect(() => {
    let active = true;
    function observe(promise: ReturnType<typeof openRecoveryLink>) {
      promise.then((user) => {
        if (active && opening.current === promise) {
          setAccount(user);
          setChecking(false);
        }
      });
    }
    function changedLink() {
      if (!window.location.hash) return;
      setChecking(true);
      setAccount(null);
      opening.current = openRecoveryLink();
      observe(opening.current);
    }
    opening.current ??= openRecoveryLink();
    observe(opening.current);
    window.addEventListener("hashchange", changedLink);
    return () => {
      active = false;
      window.removeEventListener("hashchange", changedLink);
    };
  }, []);
  useEffect(() => {
    if (state.error) feedback.current?.focus();
  }, [state]);
  if (checking)
    return (
      <p role="status" className="notice">
        Checking your reset link…
      </p>
    );
  if (!account)
    return (
      <div className="card stack">
        <p role="alert">
          This reset link is invalid or has expired. It may already have been
          used. Request a new link to try again.
        </p>
        <Link className="button" href="/forgot-password">
          Request a new reset link
        </Link>
        <Link className="text-link" href="/login">
          Back to login
        </Link>
      </div>
    );
  return (
    <form action={formAction} key={state.attempt} className="card stack">
      <p className="muted">
        Choose a new password for{" "}
        <strong className="account-email">{account.email}</strong>.
      </p>
      {state.error && (
        <p ref={feedback} tabIndex={-1} className="flash error" role="alert">
          {state.error} Enter both passwords again.
        </p>
      )}
      <input type="hidden" name="userId" value={account.id} />
      <label>
        New password
        <PasswordInput
          aria-label="New password"
          name="password"
          autoComplete="new-password"
          minLength={12}
          maxLength={128}
          required
        />
        <span className="hint">Use 12 or more characters.</span>
      </label>
      <label>
        Confirm new password
        <PasswordInput
          aria-label="Confirm new password"
          name="confirmPassword"
          visibilityLabel="confirmation password"
          autoComplete="new-password"
          minLength={12}
          maxLength={128}
          required
        />
      </label>
      <Submit pending="Updating password…">Save new password</Submit>
      <Link className="text-link" href="/forgot-password">
        Request a new reset link
      </Link>
    </form>
  );
}
