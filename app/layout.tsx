import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { currentUser } from "@/lib/auth";
import { canCreate } from "@/lib/types";
import { action } from "./actions";
import "./globals.css";
export const metadata: Metadata = {
  title: {
    default: "Housing Transition Assistance · Rescue Mission",
    template: "%s · Rescue Mission",
  },
  description:
    "Helping neighbors make a house a home. Connect household needs with community generosity.",
};
export const dynamic = "force-dynamic";
export default async function Layout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await currentUser();
  return (
    <html lang="en">
      <body>
        <a className="skip" href="#main">
          Skip to content
        </a>
        <div className="topline">A new beginning starts with a community.</div>
        <header className="site-header">
          <div className="nav-wrap">
            <Link href="/" className="brand">
              <Image
                src="/branding/rescue-mission-logo.jpg"
                alt="Rescue Mission"
                width={640}
                height={278}
                className="brand-logo"
                preload
                unoptimized
              />
              <span className="brand-name">
                Housing Transition<span>Assistance · Syracuse, NY</span>
              </span>
            </Link>
            <nav aria-label="Main navigation">
              {user && <Link href="/requests">View Existing Requests</Link>}
              {user?.role === "social_worker" && (
                <Link href="/dashboard">Home</Link>
              )}
              {user && canCreate(user) && (
                <Link href="/requests/new">Create New Request</Link>
              )}
              {user?.role === "supporter" && (
                <Link href="/commitments">My Commitments</Link>
              )}
              {user?.role === "admin" && (
                <Link href="/admin">Administration</Link>
              )}
              {user ? (
                <form action={action}>
                  <input type="hidden" name="op" value="logout" />
                  <button className="nav-button">Logout</button>
                </form>
              ) : (
                <>
                  <Link href="/login">Login</Link>
                  <Link className="button small" href="/register">
                    Create New Account
                  </Link>
                </>
              )}
            </nav>
          </div>
        </header>
        {user && (
          <div className="account-bar">
            <span>Welcome, {user.first_name}</span>
            <span>
              {user.role === "social_worker"
                ? user.approved
                  ? "Social worker"
                  : "Social worker · approval pending"
                : user.role === "admin"
                  ? "Administrator"
                  : "Community supporter"}
            </span>
          </div>
        )}
        <main id="main" className="container">
          {children}
        </main>
        <footer>
          <div>
            <strong>Housing Transition Assistance</strong>
            <p>Helping neighbors make a house a home.</p>
          </div>
          <span>
            Community care. Lasting beginnings.
            <br />
            Syracuse, New York
          </span>
        </footer>
      </body>
    </html>
  );
}
