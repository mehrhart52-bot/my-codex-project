import Link from "next/link";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { canCreate } from "@/lib/types";
import { Flash, PageHead, type Params } from "@/components/ui";

export default async function Dashboard({
  searchParams,
}: {
  searchParams: Promise<Params>;
}) {
  const user = await requireUser();
  if (user.role !== "social_worker") redirect("/requests");
  return (
    <>
      <Flash params={await searchParams} />
      <PageHead
        eyebrow="Social worker workspace"
        title="How can we help today?"
        description="Create a household request or check on existing requests."
      />
      {!user.approved && (
        <section className="notice" aria-label="Account approval">
          <p>
            Your social worker approval is pending. Ask your organization’s
            administrator to approve the account registered with {user.email}.
          </p>
          <p>
            You can browse requests while you wait. After approval, check your
            status below to begin creating requests.
          </p>
          <a className="button secondary" href="/dashboard">
            Check approval status
          </a>
        </section>
      )}
      <div className="two-grid dashboard-options">
        <section className="card stack">
          <h2>Create a new request</h2>
          <p className="muted">
            Share the household essentials someone needs as they move into a new
            home.
          </p>
          {canCreate(user) ? (
            <Link className="button" href="/requests/new">
              ＋ Create New Request
            </Link>
          ) : (
            <p className="hint">Available after administrator approval.</p>
          )}
        </section>
        <section className="card stack">
          <h2>View existing requests</h2>
          <p className="muted">
            Review requests and track supporter commitments for the households
            you support.
          </p>
          <Link className="button secondary" href="/requests">
            View Existing Requests
          </Link>
        </section>
      </div>
    </>
  );
}
