"use client";
import { useFormStatus } from "react-dom";
export function Submit({
  children,
  pending = "Saving…",
  className = "button",
}: {
  children: React.ReactNode;
  pending?: string;
  className?: string;
}) {
  const { pending: busy } = useFormStatus();
  return (
    <button
      className={className}
      disabled={busy}
      type="submit"
      aria-disabled={busy}
    >
      {busy ? pending : children}
    </button>
  );
}
