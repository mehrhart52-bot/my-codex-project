import Link from "next/link";
export function Badge({ status }: { status: string }) {
  return (
    <span className={`badge ${status}`}>
      {status === "open"
        ? "Open"
        : status === "closed"
          ? "Closed"
          : status === "committed"
            ? "Committed"
            : status === "received"
              ? "Received"
              : "Cancelled"}
    </span>
  );
}
export function Flash({
  params,
}: {
  params: { message?: string; error?: string };
}) {
  return params.error ? (
    <div role="alert" className="flash error">
      {params.error}
    </div>
  ) : params.message ? (
    <div role="status" className="flash success">
      {params.message}
    </div>
  ) : null;
}
export function PageHead({
  eyebrow,
  title,
  description,
  children,
}: {
  eyebrow: string;
  title: string;
  description?: string;
  children?: React.ReactNode;
}) {
  return (
    <header className="page-head">
      <div>
        <p className="eyebrow">{eyebrow}</p>
        <h1>{title}</h1>
        {description && <p className="muted lead">{description}</p>}
      </div>
      {children}
    </header>
  );
}
export function Empty({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="empty">
      <span className="empty-icon" aria-hidden="true">
        ⌂
      </span>
      <h2>{title}</h2>
      <p className="muted">{children}</p>
      <Link className="text-link" href="/requests">
        Explore requests →
      </Link>
    </div>
  );
}
export const date = (value: Date) =>
  new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeZone: "America/New_York",
  }).format(new Date(value));
export type Params = {
  message?: string;
  error?: string;
  status?: string;
  q?: string;
};
