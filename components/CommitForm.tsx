"use client";
import Link from "next/link";
import { useActionState, useState } from "react";
import type { Item } from "@/lib/types";
import { draftAction } from "@/app/actions";
import { Submit } from "./Submit";
import { FormFeedback } from "./FormFeedback";
export default function CommitForm({
  items,
  requestId,
}: {
  items: Item[];
  requestId: string;
}) {
  const [state, formAction] = useActionState(draftAction, { error: "" });
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const available = items.filter((i) => i.quantity > i.committed);
  const total = Object.values(quantities).reduce(
    (sum, quantity) => sum + quantity,
    0,
  );
  if (!available.length)
    return (
      <div className="notice">
        All items currently have commitments. Thank you for checking in — you
        can help another household.{" "}
        <Link className="text-link" href="/requests">
          Browse other requests →
        </Link>
      </div>
    );
  return (
    <form
      action={formAction}
      onReset={(event) => event.preventDefault()}
      className="card stack"
    >
      <h2>Commit to Providing Items</h2>
      <p className="muted">
        Enter a quantity for each item you can provide. Leave the others at 0.
        Your contact details will be shared with this request’s worker.
      </p>
      <FormFeedback state={state}>
        <a className="text-link" href={`/requests/${requestId}`}>
          Reload the request to check current quantities
        </a>
      </FormFeedback>
      <input type="hidden" name="op" value="commit" />
      <input type="hidden" name="requestId" value={requestId} />
      {available.map((i) => (
        <label key={i.id} className="commit-row">
          <span>
            {i.name}
            <small>{i.quantity - i.committed} still needed</small>
          </span>
          <input
            aria-label={`Quantity of ${i.name} to provide`}
            type="number"
            min={0}
            max={i.quantity - i.committed}
            step={1}
            value={quantities[i.id] ?? 0}
            onChange={(e) =>
              setQuantities({ ...quantities, [i.id]: Number(e.target.value) })
            }
          />
        </label>
      ))}
      <input
        type="hidden"
        name="selections"
        value={JSON.stringify(
          Object.entries(quantities)
            .filter(([, q]) => q > 0)
            .map(([itemId, quantity]) => ({ itemId, quantity })),
        )}
      />
      <p className="hint">
        Please commit only to items you intend to provide. You can reduce your
        quantity later in My Commitments.
      </p>
      <p className="hint" aria-live="polite">
        {total > 0
          ? `${total} ${total === 1 ? "item" : "items"} selected. After confirming, contact the worker to arrange delivery.`
          : "Choose at least one item by entering a quantity of 1 or more."}
      </p>
      <Submit pending="Saving commitment…" disabled={total <= 0}>
        Confirm commitment
      </Submit>
    </form>
  );
}
