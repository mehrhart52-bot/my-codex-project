import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { canManage } from "@/lib/types";
import { requestDetails } from "@/lib/service";
import { action } from "@/app/actions";
import { Submit } from "@/components/Submit";
import CommitForm from "@/components/CommitForm";
import { Badge, Flash, PageHead, date, type Params } from "@/components/ui";
export default async function Detail({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Params>;
}) {
  const user = await requireUser();
  const { id } = await params;
  if (!/^[1-9]\d{0,17}$/.test(id)) notFound();
  const data = await requestDetails(user, id);
  if (!data) notFound();
  const { request: r, items, commitments, history } = data;
  const manager = canManage(user, r);
  const ready =
    items.length > 0 && items.every((i) => i.received === i.quantity);
  return (
    <>
      <Link href="/requests" className="back-link">
        ← All requests
      </Link>
      <Flash params={await searchParams} />
      <PageHead
        eyebrow={`${r.number} · Created ${date(r.created_at)}`}
        title="A home in the making"
        description={r.owner_name ? `Requested by ${r.owner_name}` : undefined}
      >
        <div className="actions">
          <Badge status={r.status} />
          {manager && r.status === "open" && (
            <Link className="button secondary" href={`/requests/${id}/edit`}>
              Edit request
            </Link>
          )}
        </div>
      </PageHead>
      {ready && manager && r.status === "open" && (
        <p className="flash success">
          Every requested item has been received. This request is ready for
          closure. Review the details and confirm below when you are ready.
        </p>
      )}
      <div className="detail-grid">
        <div className="stack">
          <section className="card">
            <p className="eyebrow">About this household</p>
            <h2>A fresh start, with your help.</h2>
            <p className="preserve">{r.summary}</p>
          </section>
          {manager && (
            <section className="card private">
              <p className="eyebrow">Private · authorized staff only</p>
              <h2>Household circumstances</h2>
              <p className="preserve">{r.narrative}</p>
            </section>
          )}
          <section className="card">
            <h2>Household essentials</h2>
            <p className="muted">
              Committed includes items already received. Still needed means
              items not yet physically received.
            </p>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Item</th>
                    <th>Requested</th>
                    <th>Committed</th>
                    <th>Received</th>
                    <th>Available to commit</th>
                    <th>Still needed</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((i) => (
                    <tr key={i.id}>
                      <th>{i.name}</th>
                      <td>{i.quantity}</td>
                      <td>{i.committed}</td>
                      <td>{i.received}</td>
                      <td>{i.quantity - i.committed}</td>
                      <td>{i.quantity - i.received}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
          {manager && (
            <section className="card stack">
              <h2>Supporter commitments & receipts</h2>
              <p className="muted">
                Use these contact details only to coordinate this request.
                Record the quantity delivered today, not the cumulative total.
              </p>
              {!commitments.length && (
                <p className="notice">
                  No commitments yet. Supporters will appear here when they
                  offer an item.
                </p>
              )}
              {commitments.map((c) => (
                <article className="commitment" key={c.id}>
                  <div className="card-top">
                    <h3>{c.name}</h3>
                    <Badge status={c.status} />
                  </div>
                  <p>
                    {c.first_name} {c.last_name}
                    {c.status === "committed" && (
                      <>
                        <br />
                        <a href={`mailto:${c.email}`}>{c.email}</a> ·{" "}
                        <a href={`tel:${c.phone}`}>{c.phone}</a>
                      </>
                    )}
                  </p>
                  <p className="muted">
                    {c.quantity} committed · {c.received} received ·{" "}
                    {date(c.created_at)}
                  </p>
                  {r.status === "open" && c.status === "committed" && (
                    <form action={action} className="inline-form">
                      <input type="hidden" name="op" value="receive" />
                      <input type="hidden" name="requestId" value={id} />
                      <input type="hidden" name="commitmentId" value={c.id} />
                      <label>
                        Delivered now
                        <input
                          name="quantity"
                          type="number"
                          min={1}
                          max={c.quantity - c.received}
                          defaultValue={c.quantity - c.received}
                          required
                        />
                      </label>
                      <Submit>Confirm receipt</Submit>
                    </form>
                  )}
                  {user.role === "admin" && c.status === "committed" && (
                    <form action={action} className="inline-form">
                      <input type="hidden" name="op" value="reduce" />
                      <input type="hidden" name="commitmentId" value={c.id} />
                      <label>
                        Reduce committed total
                        <input
                          name="quantity"
                          type="number"
                          min={c.received}
                          max={c.quantity - 1}
                          defaultValue={c.received}
                          required
                        />
                      </label>
                      <Submit className="button secondary">
                        Update commitment
                      </Submit>
                    </form>
                  )}
                </article>
              ))}
            </section>
          )}
          {manager && (
            <section className="card">
              <h2>Request history</h2>
              <ul className="history">
                {history.map((h, index) => (
                  <li key={index}>
                    <span>
                      {h.action.replaceAll(".", " ").replaceAll("_", " ")}
                    </span>
                    <small>{date(h.created_at)}</small>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
        <aside className="stack">
          {user.role === "supporter" && r.status === "open" && (
            <CommitForm items={items} requestId={id} />
          )}{" "}
          {r.status === "closed" && (
            <div className="card">
              <h2>This request is closed</h2>
              <p className="muted">
                This household’s request has been preserved for history. New
                commitments are no longer accepted.
              </p>
            </div>
          )}
          {user.role === "supporter" && commitments.length > 0 && (
            <div className="card">
              <h2>Your help matters</h2>
              <p>
                You have {commitments.length} commitment record
                {commitments.length !== 1 ? "s" : ""} for this request.
              </p>
              <Link className="text-link" href="/commitments">
                Manage your commitments →
              </Link>
            </div>
          )}
          {manager && r.status === "open" && (
            <form action={action} className="card stack">
              <h2>Close this request</h2>
              <p className="muted">
                Closing stops new commitments and preserves all history.{" "}
                {ready
                  ? "All requested items have been received."
                  : "Some items have not been received. Close only if the household no longer needs further support."}
              </p>
              <input type="hidden" name="op" value="close" />
              <input type="hidden" name="requestId" value={id} />
              <label className="check">
                <input name="confirm" value="yes" type="checkbox" required />I
                confirm this request should be closed.
              </label>
              <Submit className="button secondary">Confirm closure</Submit>
            </form>
          )}
          {user.role === "admin" && r.status === "closed" && (
            <form action={action} className="card stack">
              <h2>Reopen request</h2>
              <input type="hidden" name="op" value="reopen" />
              <input type="hidden" name="requestId" value={id} />
              <label className="check">
                <input type="checkbox" name="confirm" value="yes" required />
                Confirm reopening and allow new commitments.
              </label>
              <Submit>Reopen request</Submit>
            </form>
          )}
          <div className="privacy-note">
            <span aria-hidden="true">♡</span>
            <h3>Care includes confidentiality.</h3>
            <p>
              Please keep all client and supporter information within this
              application and authorized coordination channels.
            </p>
          </div>
        </aside>
      </div>
    </>
  );
}
