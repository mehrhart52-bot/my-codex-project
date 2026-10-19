"use client";
import { useEffect, useRef } from "react";

export function FormFeedback({
  state,
  children,
}: {
  state: { error: string };
  children?: React.ReactNode;
}) {
  const feedback = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (state.error) feedback.current?.focus();
  }, [state]);
  if (!state.error) return null;
  return (
    <div ref={feedback} tabIndex={-1} className="flash error" role="alert">
      <p>
        {state.error} Your entries are still here; review them and try again.
      </p>
      {children}
    </div>
  );
}
