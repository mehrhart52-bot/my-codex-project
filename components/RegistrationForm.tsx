"use client";
import { useActionState } from "react";
import { registerAction } from "@/app/register/actions";
import { Submit } from "./Submit";
const initialState = {
  attempt: 0,
  values: {
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    role: "supporter",
  },
  errors: {} as Record<string, string>,
  message: "",
};
function FieldError({ name, message }: { name: string; message?: string }) {
  return message ? (
    <span id={name + "-error"} className="hint" role="alert">
      {message}
    </span>
  ) : null;
}
export default function RegistrationForm() {
  const [state, formAction] = useActionState(registerAction, initialState);
  return (
    <form action={formAction} key={state.attempt} className="card stack">
      {state.message && (
        <p role="alert" className="flash error">
          {state.message}
        </p>
      )}
      <div className="two-grid">
        <label>
          First Name
          <input
            name="firstName"
            aria-label="First Name"
            defaultValue={state.values.firstName}
            aria-invalid={!!state.errors.firstName}
            aria-describedby="firstName-error"
            autoComplete="given-name"
            maxLength={80}
            required
          />
          <FieldError name="firstName" message={state.errors.firstName} />
        </label>
        <label>
          Last Name
          <input
            name="lastName"
            aria-label="Last Name"
            defaultValue={state.values.lastName}
            aria-invalid={!!state.errors.lastName}
            aria-describedby="lastName-error"
            autoComplete="family-name"
            maxLength={80}
            required
          />
          <FieldError name="lastName" message={state.errors.lastName} />
        </label>
      </div>
      <label>
        Email Address
        <input
          type="email"
          name="email"
          aria-label="Email Address"
          defaultValue={state.values.email}
          aria-invalid={!!state.errors.email}
          aria-describedby="email-error"
          autoComplete="email"
          maxLength={254}
          required
        />
        <FieldError name="email" message={state.errors.email} />
      </label>
      <label>
        Phone Number
        <input
          type="tel"
          name="phone"
          aria-label="Phone Number"
          defaultValue={state.values.phone}
          aria-invalid={!!state.errors.phone}
          aria-describedby="phone-error"
          autoComplete="tel"
          minLength={7}
          maxLength={30}
          required
        />
        <FieldError name="phone" message={state.errors.phone} />
      </label>
      <label>
        User Type
        <select
          name="role"
          aria-label="User Type"
          defaultValue={state.values.role}
          aria-invalid={!!state.errors.role}
          aria-describedby="role-error"
          required
        >
          <option value="supporter">Supporter</option>
          <option value="social_worker">
            Social Worker — administrator approval required
          </option>
        </select>
        <FieldError name="role" message={state.errors.role} />
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
            aria-invalid={!!state.errors.password}
            aria-describedby="password-error"
            aria-label="Password"
            autoComplete="new-password"
            minLength={12}
            maxLength={128}
            required
          />
          <span className="hint">Use 12 or more characters.</span>
          <FieldError name="password" message={state.errors.password} />
        </label>
        <label>
          Confirm Password
          <input
            type="password"
            name="confirmPassword"
            aria-label="Confirm Password"
            aria-invalid={!!state.errors.confirmPassword}
            aria-describedby="confirmPassword-error"
            autoComplete="new-password"
            minLength={12}
            maxLength={128}
            required
          />
          <FieldError
            name="confirmPassword"
            message={state.errors.confirmPassword}
          />
        </label>
      </div>
      <Submit pending="Creating account…">Create New Account</Submit>
    </form>
  );
}
