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
        <p className="notice">
          Your social worker approval is pending. An administrator must approve
          your account before you can create or manage requests.
        </p>
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
