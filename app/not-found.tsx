import Link from "next/link";
export default function NotFound() {
  return (
    <div className="empty">
      <h1>This page isn’t available.</h1>
      <p>
        It may not exist, or your account may not have permission to access it.
      </p>
      <Link className="button" href="/requests">
        Back to requests
      </Link>
    </div>
  );
}
