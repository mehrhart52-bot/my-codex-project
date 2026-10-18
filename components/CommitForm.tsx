"use client";
import { useState } from "react";
import type { Item } from "@/lib/types";
import { action } from "@/app/actions";
import { Submit } from "./Submit";
export default function CommitForm({
  items,
  requestId,
}: {
  items: Item[];
  requestId: string;
}) {
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const available = items.filter((i) => i.quantity > i.committed);
  if (!available.length)
    return (
      <div className="notice">
        All items currently have commitments. Thank you for checking in — you
        can help another household.
      </div>
    );
  return (
    <form action={action} className="card stack">
      <h2>Commit to Providing Items</h2>
      <p className="muted">
        Choose what you can give. The social worker will use your account
        contact details to coordinate with you.
      </p>
      <input type="hidden" name="op" value="commit" />
      <input type="hidden" name="requestId" value={requestId} />
      {available.map((i) => (
        <label key={i.id} className="commit-row">
          <span>
            {i.name}
            <small>{i.quantity - i.committed} available</small>
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
      <Submit pending="Reserving items…">Confirm commitment</Submit>
    </form>
  );
}
