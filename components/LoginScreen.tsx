"use client";

import Link from "next/link";
import { useState } from "react";
import { action } from "@/app/actions";
import { Submit } from "./Submit";
import { Flash, type Params } from "./ui";
import { PasswordInput } from "./PasswordInput";

export default function LoginScreen({ params }: { params: Params }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  return (
    <div className="auth-shell">
      <p className="eyebrow">Rescue Mission</p>
      <h1>Housing Transition Assistance</h1>
      <p className="muted">Log in or create an account to get started.</p>
      <Flash params={params} />
      <form action={action} className="card stack">
        <input type="hidden" name="op" value="login" />
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
