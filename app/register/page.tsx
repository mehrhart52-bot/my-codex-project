import Link from "next/link";
import { action } from "../actions";
import { Submit } from "@/components/Submit";
import { Flash, type Params } from "@/components/ui";
export default async function Register({
  searchParams,
}: {
  searchParams: Promise<Params>;
}) {
  return (
    <div className="auth-shell wide">
      <p className="eyebrow">Join your community</p>
      <h1>Be part of a fresh start.</h1>
      <p className="muted">
        All fields are required. Your contact information is shared only with
        authorized request managers when you commit to items.
      </p>
      <Flash params={await searchParams} />
      <form action={action} className="card stack">
        <input type="hidden" name="op" value="register" />
        <div className="two-grid">
          <label>
            First Name
            <input
              name="firstName"
              autoComplete="given-name"
              maxLength={80}
              required
            />
          </label>
          <label>
            Last Name
            <input
              name="lastName"
              autoComplete="family-name"
              maxLength={80}
              required
            />
          </label>
        </div>
        <label>
          Email Address
          <input
            type="email"
            name="email"
            autoComplete="email"
            maxLength={254}
            required
          />
        </label>
        <label>
          Phone Number
          <input
            type="tel"
            name="phone"
            autoComplete="tel"
            minLength={7}
            maxLength={30}
            required
          />
        </label>
        <label>
          User Type
          <select name="role" required>
            <option value="supporter">Supporter</option>
            <option value="social_worker">
              Social Worker — administrator approval required
            </option>
          </select>
        </label>
        <p className="notice">
          Social worker accounts cannot create or manage requests until an
          administrator approves them. Supporters can begin helping right away.
        </p>
        <div className="two-grid">
          <label>
            Password
            <input
              type="password"
              name="password"
              aria-label="Password"
              autoComplete="new-password"
              minLength={12}
              maxLength={128}
              required
            />
            <span className="hint">Use 12 or more characters.</span>
          </label>
          <label>
            Confirm Password
            <input
              type="password"
              name="confirmPassword"
              autoComplete="new-password"
              minLength={12}
              maxLength={128}
              required
            />
          </label>
        </div>
        <Submit pending="Creating account…">Create New Account</Submit>
      </form>
      <p className="muted">
        Already registered?{" "}
        <Link className="text-link" href="/login">
          Login
        </Link>
      </p>
    </div>
  );
}
