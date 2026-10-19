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
  const search = (params.q ?? "").trim();
  const mine = user.role === "social_worker" && params.scope !== "all";
  const requests = await listRequests(user, status, search);
  const rows = mine ? requests.filter((r) => r.owner_id === user.id) : requests;
  const filtered = !!search || status !== "open";
  return (
    <>
      <Flash params={params} />
      <PageHead
        eyebrow="Community needs"
        title="A little help. A lasting impact."
        description={
          mine
            ? "Your household requests and the items supporters have offered."
            : "Find the everyday essentials our neighbors need for their next chapter."
        }
      >
        {canCreate(user) && (
          <Link className="button" href="/requests/new">
            ＋ Create New Request
          </Link>
        )}
      </PageHead>
      {user.role === "supporter" && (
        <section className="notice how-to-help" aria-label="How to help">
          <strong>How to help</strong>
          <ol>
            <li>Open a request to see what is needed.</li>
            <li>
              Choose the quantities you can provide and confirm your commitment.
            </li>
            <li>
              Contact the worker to arrange delivery. Your offers are saved in
              My Commitments.
            </li>
          </ol>
        </section>
      )}
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
            placeholder="Search a request number or summary…"
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
        {user.role === "social_worker" && (
          <label>
            Show
            <select name="scope" defaultValue={mine ? "mine" : "all"}>
              <option value="mine">My requests</option>
              <option value="all">All workers’ requests</option>
            </select>
          </label>
        )}
        <button className="button secondary">Search</button>
        {filtered && (
          <Link
            className="text-link"
            href={
              user.role === "social_worker" && !mine
                ? "/requests?scope=all"
                : "/requests"
            }
          >
            Clear filters
          </Link>
        )}
      </form>
      <div className="results-heading">
        <span>
          {rows.length} {rows.length === 1 ? "request" : "requests"}
        </span>
        <span>Every item is a step toward home.</span>
      </div>
      {!rows.length ? (
        <Empty
          title={
            filtered
              ? "No matching requests"
              : mine
                ? "You have no open requests"
                : "No open requests right now"
          }
          href={
            !filtered && canCreate(user)
              ? "/requests/new"
              : user.role === "social_worker" && !mine
                ? "/requests?scope=all"
                : "/requests"
          }
          linkLabel={
            !filtered && canCreate(user)
              ? "Create a request →"
              : filtered
                ? "Clear filters →"
                : "Check for requests →"
          }
        >
          {filtered
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
              {r.status === "open" && (
                <p className="hint">
                  {Number(r.needed) > Number(r.committed)
                    ? `${Number(r.needed) - Number(r.committed)} still needed`
                    : "All items committed"}
                </p>
              )}
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
