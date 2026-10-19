"use client";
import { useFormStatus } from "react-dom";
export function Submit({
  children,
  pending = "Saving…",
  className = "button",
  disabled = false,
}: {
  children: React.ReactNode;
  pending?: string;
  className?: string;
  disabled?: boolean;
}) {
  const { pending: busy } = useFormStatus();
  return (
    <button
      className={className}
      disabled={busy || disabled}
      type="submit"
      aria-disabled={busy || disabled}
    >
      {busy ? pending : children}
    </button>
  );
}
