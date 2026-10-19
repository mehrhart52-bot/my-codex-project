"use client";

import Link from "next/link";
import { useState } from "react";
import { action } from "@/app/actions";
import { Submit } from "./Submit";
import { Flash, type Params } from "./ui";
import { PasswordInput } from "./PasswordInput";

const demoAccounts = [
  {
    label: "Administrator",
    email: "demo-admin@example.com",
    password: "RescueAdmin2026!",
  },
  {
    label: "Social Worker",
    email: "demo-worker@example.com",
    password: "RescueWorker2026!",
  },
  {
    label: "Supporter",
    email: "demo-supporter@example.com",
    password: "RescueSupport2026!",
  },
];

export default function LoginScreen({ params }: { params: Params }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/+$/, "");
  const showDemoAccounts =
    process.env.NODE_ENV === "development" &&
    supabaseUrl === "https://naxlbpsjoonktjbieyft.supabase.co";

  return (
    <div className="auth-shell">
      <p className="eyebrow">Rescue Mission</p>
      <h1>Housing Transition Assistance</h1>
      <p className="muted">Log in or create an account to get started.</p>
      <Flash params={params} />
      <form action={action} className="card stack">
        <input type="hidden" name="op" value="login" />
        {showDemoAccounts && (
          <section className="stack demo-access" aria-labelledby="demo-title">
            <div>
              <p className="eyebrow">Local testing</p>
              <h2 id="demo-title">Use a demo account</h2>
              <p className="muted">
                Select a role to fill in its login details, then select Login.
              </p>
            </div>
            <div className="actions">
              {demoAccounts.map((account) => (
                <button
                  key={account.email}
                  type="button"
                  className="button secondary small"
                  onClick={() => {
                    setEmail(account.email);
                    setPassword(account.password);
                  }}
                >
                  Use {account.label} Demo
                </button>
              ))}
            </div>
          </section>
        )}
        <label>
          Email address
          <input
            autoComplete="username"
            type="email"
            name="email"
            maxLength={254}
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
          />
        </label>
        <label>
          Password
          <PasswordInput
            autoComplete="current-password"
            name="password"
            maxLength={128}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
          />
        </label>
        <Submit pending="Signing in…">Login</Submit>
        <p className="hint">
          Need account access help? Contact your organization’s administrator.
        </p>
      </form>
      <p className="muted">
        New here?{" "}
        <Link className="text-link" href="/register">
          Create New Account
        </Link>
      </p>
    </div>
  );
}
