"use client";
export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <div className="empty" role="alert">
      <h1>We couldn’t load this page.</h1>
      <p>
        Please try again. If the problem continues, contact your administrator.
      </p>
      <button className="button" onClick={reset}>
        Try again
      </button>
    </div>
  );
}
