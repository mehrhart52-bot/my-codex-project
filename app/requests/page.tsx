import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { canCreate } from "@/lib/types";
import { listRequests } from "@/lib/service";
import {
  Badge,
  Flash,
  PageHead,
  Empty,
  date,
  type Params,
} from "@/components/ui";
export default async function Requests({
  searchParams,
}: {
  searchParams: Promise<Params>;
}) {
  const user = await requireUser();
  const params = await searchParams;
  const status = ["open", "closed", "all"].includes(params.status ?? "")
    ? params.status!
    : "open";
  const rows = await listRequests(user, status, params.q ?? "");
  return (
    <>
      <Flash params={params} />
      <PageHead
        eyebrow="Community needs"
        title="A little help. A lasting impact."
        description="Find the everyday essentials our neighbors need for their next chapter."
      >
        {canCreate(user) && (
          <Link className="button" href="/requests/new">
            ＋ Create New Request
          </Link>
        )}
      </PageHead>
      {user.role === "social_worker" && !user.approved && (
        <p className="notice">
          Your social worker approval is pending. An administrator must approve
          your account before you can create or manage requests.
        </p>
      )}
      <form className="filters" role="search">
        <label className="search-label">
          Search requests
          <input
            name="q"
            defaultValue={params.q}
            maxLength={120}
            placeholder="Search a request number or household need…"
          />
        </label>
        <label>
          Status
          <select name="status" defaultValue={status}>
            <option value="open">Open Requests</option>
            <option value="closed">Closed Requests</option>
            <option value="all">All Requests</option>
          </select>
        </label>
        <button className="button secondary">Search</button>
      </form>
      <div className="results-heading">
        <span>
          {rows.length} {rows.length === 1 ? "request" : "requests"}
        </span>
        <span>Every item is a step toward home.</span>
      </div>
      {!rows.length ? (
        <Empty title="No requests to show yet">
          {params.q
            ? "Try another search or status filter."
            : canCreate(user)
              ? "Create a household request to begin connecting with supporters."
              : "Check back soon for households you can help."}
        </Empty>
      ) : (
        <div className="request-grid">
          {rows.map((r) => (
            <article className="request-card" key={r.id}>
              <div className="card-top">
                <span className="request-number">{r.number}</span>
                <Badge status={r.status} />
              </div>
              <small className="muted">
                Created {date(r.created_at)}
                {r.owner_name && ` · ${r.owner_name}`}
              </small>
              <h2>{r.summary}</h2>
              <div className="stats">
                <div>
                  <strong>{r.needed}</strong>
                  <span>requested</span>
                </div>
                <div>
                  <strong>{r.committed}</strong>
                  <span>committed</span>
                </div>
              </div>
              <progress
                max={Number(r.needed)}
                value={Number(r.committed)}
                aria-label={`${r.committed} of ${r.needed} items committed`}
              />
              <Link href={`/requests/${r.id}`} className="request-link">
                View Details <span aria-hidden="true">→</span>
              </Link>
            </article>
          ))}
        </div>
      )}
    </>
  );
}
