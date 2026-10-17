import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { myCommitments } from "@/lib/service";
import { action } from "@/app/actions";
import { Submit } from "@/components/Submit";
import {
  Badge,
  Flash,
  PageHead,
  Empty,
  date,
  type Params,
} from "@/components/ui";
export default async function Commitments({
  searchParams,
}: {
  searchParams: Promise<Params>;
}) {
  const user = await requireUser();
  const rows = await myCommitments(user);
  return (
    <>
      <Flash params={await searchParams} />
      <PageHead
        eyebrow="Your community contribution"
        title="My Commitments"
        description="Keep track of what you have offered and what has reached a new home."
      />
      {!rows.length ? (
        <Empty title="Your first act of kindness is waiting">
          Choose a household request and commit to an item you can provide.
        </Empty>
      ) : (
        <div className="stack">
          {rows.map((c) => (
            <article key={c.id} className="card">
              <div className="card-top">
                <div>
                  <Link
                    className="text-link"
                    href={`/requests/${c.request_id}`}
                  >
                    {c.number}
                  </Link>
                  <h2>{c.name}</h2>
                </div>
                <Badge status={c.status} />
              </div>
              <p className="muted">
                Committed {date(c.created_at)} · {c.quantity} total committed ·{" "}
                {c.received} received · {c.quantity - c.received} awaiting
                delivery
              </p>
              {c.status === "committed" && (
                <form action={action} className="inline-form">
                  <input type="hidden" name="op" value="reduce" />
                  <input type="hidden" name="commitmentId" value={c.id} />
                  <label>
                    New total quantity
                    <span className="hint">
                      Use {c.received} to{" "}
                      {c.received === 0
                        ? "cancel"
                        : "release the remaining items"}
                      . Received items stay recorded.
                    </span>
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
                    Reduce / cancel commitment
                  </Submit>
                </form>
              )}
              {c.status === "received" && (
                <p className="notice">
                  These items have been received. This commitment is now part of
                  your giving history.
                </p>
              )}
            </article>
          ))}
        </div>
      )}
    </>
  );
}
