import Link from "next/link";
import { action } from "../actions";
import { Submit } from "@/components/Submit";
import { Flash, type Params } from "@/components/ui";
export default async function Login({
  searchParams,
}: {
  searchParams: Promise<Params>;
}) {
  return (
    <div className="auth-shell">
      <p className="eyebrow">Welcome back</p>
      <h1>A little help starts here.</h1>
      <p className="muted">
        Sign in to connect household needs with community support.
      </p>
      <Flash params={await searchParams} />
      <form action={action} className="card stack">
        <input type="hidden" name="op" value="login" />
        <label>
          Email address
          <input
            autoComplete="username"
            type="email"
            name="email"
            maxLength={254}
            required
          />
        </label>
        <label>
          Password
          <input
            autoComplete="current-password"
            type="password"
            name="password"
            maxLength={128}
            required
          />
        </label>
        <Submit pending="Signing in…">Login</Submit>
        <p className="hint">
          Need account access help? Contact your organization’s administrator.
        </p>
      </form>
      <p className="muted">
        New to the community?{" "}
        <Link className="text-link" href="/register">
          Create New Account
        </Link>
      </p>
    </div>
  );
}
