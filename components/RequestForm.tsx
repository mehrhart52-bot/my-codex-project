"use client";
import { useState } from "react";
import { action } from "@/app/actions";
import { Submit } from "./Submit";
import type { Item } from "@/lib/types";
type Row = { key: number; catalogId: number; name: string; quantity: number };
export default function RequestForm({
  catalog,
  initial,
}: {
  catalog: { id: number; name: string }[];
  initial?: { id: string; summary: string; items: Item[] };
}) {
  const [rows, setRows] = useState<Row[]>(
    initial
      ? []
      : [{ key: 0, catalogId: catalog[0].id, name: "", quantity: 1 }],
  );
  const [nextKey, setNextKey] = useState(1);
  const [existing, setExisting] = useState(
    initial?.items.map((i) => ({ id: i.id, quantity: i.quantity })) ?? [],
  );
  function update(key: number, value: Partial<Row>) {
    setRows(rows.map((r) => (r.key === key ? { ...r, ...value } : r)));
  }
  return (
    <form action={action} className="stack">
      <input type="hidden" name="op" value={initial ? "edit" : "create"} />
      {initial && <input type="hidden" name="requestId" value={initial.id} />}
      <section className="card stack">
        <h2>Describe the household need</h2>
        <p className="notice">
          Do not include client names, contact information, addresses, or other
          identifying details in the public summary.
        </p>
        <label>
          Public summary{" "}
          <span className="hint">
            Visible to signed-in community supporters. Use only non-identifying
            details.
          </span>
          <textarea
            name="summary"
            required
            minLength={10}
            maxLength={2000}
            rows={3}
            defaultValue={initial?.summary}
            placeholder="A neighbor is moving into their first apartment and needs a few essentials to settle in."
          />
        </label>
      </section>
      <section className="card stack">
        <div>
          <h2>Household essentials</h2>
          <p className="muted">
            Choose the items that will help make this space a home.
          </p>
        </div>
        {initial?.items.map((i) => (
          <label key={i.id}>
            {i.name}{" "}
            <span className="hint">
              {i.committed} reserved, including {i.received} received. Existing
              items are retained for history.
            </span>
            <input
              type="number"
              min={Math.max(1, i.committed)}
              max={10000}
              required
              value={
                existing.find((x) => x.id === i.id)?.quantity ?? i.quantity
              }
              onChange={(e) =>
                setExisting(
                  existing.map((x) =>
                    x.id === i.id
                      ? { ...x, quantity: Number(e.target.value) }
                      : x,
                  ),
                )
              }
            />
          </label>
        ))}
        {rows.map((r, index) => (
          <div key={r.key} className="item-row">
            <label>
              Item {index + 1}
              <select
                aria-label={`Item ${index + 1}`}
                value={r.catalogId}
                onChange={(e) =>
                  update(r.key, { catalogId: Number(e.target.value) })
                }
              >
                {catalog.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </label>
            {catalog.find((c) => c.id === r.catalogId)?.name === "Other" && (
              <label>
                Specify item
                <input
                  value={r.name}
                  onChange={(e) => update(r.key, { name: e.target.value })}
                  maxLength={120}
                  required
                />
              </label>
            )}
            <label className="quantity">
              Quantity
              <input
                type="number"
                min={1}
                max={10000}
                step={1}
                value={r.quantity || ""}
                onChange={(e) =>
                  update(r.key, { quantity: Number(e.target.value) })
                }
                required
              />
            </label>
            <button
              type="button"
              className="button subtle"
              onClick={() => setRows(rows.filter((x) => x.key !== r.key))}
              aria-label={`Remove item ${index + 1}`}
            >
              Remove
            </button>
          </div>
        ))}
        <button
          type="button"
          className="button secondary"
          onClick={() => {
            setRows([
              ...rows,
              { key: nextKey, catalogId: catalog[0].id, name: "", quantity: 1 },
            ]);
            setNextKey(nextKey + 1);
          }}
        >
          ＋ Add Item
        </button>
        <input
          type="hidden"
          name="items"
          value={JSON.stringify(initial ? existing : rows)}
        />
        {initial && (
          <input type="hidden" name="newItems" value={JSON.stringify(rows)} />
        )}
      </section>
      <div className="actions">
        <Submit>{initial ? "Save request" : "Submit Request"}</Submit>
        <a
          className="button subtle"
          href={initial ? `/requests/${initial.id}` : "/requests"}
        >
          Cancel
        </a>
      </div>
    </form>
  );
}
