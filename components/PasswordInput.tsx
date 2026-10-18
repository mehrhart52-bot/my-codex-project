"use client";

import { useState, type ComponentProps } from "react";

type Props = Omit<ComponentProps<"input">, "type"> & {
  visibilityLabel?: string;
};

export function PasswordInput({
  visibilityLabel = "password",
  ...props
}: Props) {
  const [visible, setVisible] = useState(false);
  return (
    <div className="password-field">
      <input {...props} type={visible ? "text" : "password"} />
      <button
        type="button"
        className="password-toggle"
        onClick={() => setVisible(!visible)}
        aria-label={`${visible ? "Hide" : "Show"} ${visibilityLabel}`}
        aria-pressed={visible}
      >
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6Z" />
          <circle cx="12" cy="12" r="2.75" />
          {visible && <path d="m4 4 16 16" />}
        </svg>
      </button>
    </div>
  );
}
