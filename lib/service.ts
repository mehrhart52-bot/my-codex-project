import { z } from "zod";
import { createClient } from "./supabase/server";
import type { Commitment, Item, RequestRow, User } from "./types";

export class RuleError extends Error {}

function check(ok: unknown, message: string): asserts ok {
  if (!ok) throw new RuleError(message);
}

const requestIdSchema = z
  .string()
  .regex(/^[1-9]\d*$/)
  .max(18);
const userIdSchema = z.uuid();
const positive = z.number().int().min(1).max(10000);

export const validId = (id: unknown) => requestIdSchema.parse(id);
export const itemInput = z.object({
  catalogId: z.number().int().positive(),
  name: z.string().trim().max(120).optional(),
  quantity: positive,
});
export const requestInput = z.object({
  summary: z
    .string()
    .trim()
    .min(10, "Add a public summary of at least 10 characters.")
    .max(2000),
  items: z.array(itemInput).min(1, "Add at least one household item."),
});

const narrativeInput = z.string().trim().min(10).max(10000);
const emptyNarrative = "No private circumstances provided.";

function cleanMessage(message: string) {
  return message
    .replace(/^.*?ERROR:\s*/i, "")
    .replace(/\s*CONTEXT:.*$/is, "")
    .trim();
}

async function rpc<T>(name: string, params: Record<string, unknown> = {}) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc(name, params);
  if (error) throw new RuleError(cleanMessage(error.message));
  return data as T;
}

export async function createRequest(_user: User, input: unknown) {
  const data = requestInput.parse(input);
  return rpc<{ id: string; number: string }>("create_request", {
    p_summary: data.summary,
    p_narrative: emptyNarrative,
    p_items: data.items,
  });
}

export async function editRequest(_user: User, id: string, input: unknown) {
  const data = z
    .object({
      summary: requestInput.shape.summary,
      items: z.array(z.object({ id: requestIdSchema, quantity: positive })),
      newItems: z.array(itemInput).default([]),
    })
    .parse(input);

  const existing = await requestDetails(_user, id);
  const narrative = narrativeInput.safeParse(existing?.request.narrative);
  check(narrative.success, "Request details could not be read.");

  await rpc("edit_request", {
    p_request_id: validId(id),
    p_summary: data.summary,
    p_narrative: narrative.data,
    p_items: data.items,
    p_new_items: data.newItems,
  });
}

export async function commitItems(_user: User, id: string, input: unknown) {
  const selections = z
    .array(z.object({ itemId: requestIdSchema, quantity: positive }))
    .min(1, "Choose at least one item.")
    .parse(input);
  check(
    new Set(selections.map((selection) => selection.itemId)).size ===
      selections.length,
    "Choose each item once.",
  );

  await rpc("commit_items", {
    p_request_id: validId(id),
    p_selections: selections,
  });
}

export async function reduceCommitment(
  _user: User,
  commitmentId: string,
  quantity: number,
) {
  z.number().int().min(0).max(10000).parse(quantity);
  await rpc("reduce_commitment", {
    p_commitment_id: validId(commitmentId),
    p_quantity: quantity,
  });
}

export async function receiveItems(
  _user: User,
  commitmentId: string,
  quantity: number,
) {
  positive.parse(quantity);
  await rpc("receive_items", {
    p_commitment_id: validId(commitmentId),
    p_quantity: quantity,
  });
}

export async function changeStatus(
  _user: User,
  id: string,
  status: "open" | "closed",
  confirmed: boolean,
) {
  check(confirmed, "Confirm the status change.");
  await rpc("change_request_status", {
    p_request_id: validId(id),
    p_status: status,
  });
}

export async function updateUser(
  _user: User,
  id: string,
  role: string,
  approved: boolean,
  active: boolean,
) {
  userIdSchema.parse(id);
  check(
    ["supporter", "social_worker", "admin"].includes(role),
    "Invalid role.",
  );
  await rpc("update_user_permissions", {
    p_user_id: id,
    p_role: role,
    p_approved: approved,
    p_active: active,
  });
}

export async function listRequests(
  _user: User,
  status: string,
  search: string,
): Promise<RequestRow[]> {
  return rpc<RequestRow[]>("list_requests", {
    p_status: status,
    p_search: search.slice(0, 120),
  });
}

export async function requestDetails(_user: User, id: string) {
  const data = await rpc<{
    request: RequestRow;
    items: Item[];
    commitments: Commitment[];
    history: { action: string; details: unknown; created_at: string }[];
  } | null>("request_details", { p_request_id: validId(id) });
  return data;
}

export async function myCommitments(_user: User): Promise<Commitment[]> {
  return rpc<Commitment[]>("my_commitments");
}

const catalogOrder = [
  "Twin Mattress",
  "Full Mattress",
  "Twin Bed Frame",
  "Full Bed Frame",
  "Twin Bedding",
  "Full Bedding",
  "Pillows",
  "Dishes",
  "Glasses",
  "Silverware",
  "Pots and Pans",
  "Cooking Utensils",
  "Microwave",
  "Television",
  "Lamp",
  "Kitchen Table",
  "Dining Chairs",
  "Sofa",
  "Coffee Table",
  "End Table",
  "Dresser",
  "Towels",
  "Cleaning Supplies",
  "Other",
];

const retiredCatalogItems = new Set([
  "Bed",
  "Mattress",
  "Bed Frame",
  "Bedding",
]);

const compatibleCustomItems = catalogOrder.filter(
  (name) =>
    name.includes("Mattress") ||
    name.includes("Bed Frame") ||
    name.includes("Bedding") ||
    name === "Cleaning Supplies",
);

export type CatalogItem = {
  id: number;
  name: string;
  customName?: string;
};

export function visibleCatalog(rows: CatalogItem[]): CatalogItem[] {
  const position = new Map(catalogOrder.map((name, index) => [name, index]));
  const visible = rows.filter((row) => !retiredCatalogItems.has(row.name));
  const other = visible.find((row) => row.name === "Other");

  if (other) {
    for (const name of compatibleCustomItems) {
      if (!visible.some((row) => row.name === name)) {
        visible.push({ id: other.id, name, customName: name });
      }
    }
  }

  return visible.sort(
    (left, right) =>
      (position.get(left.name) ?? catalogOrder.length - 1) -
      (position.get(right.name) ?? catalogOrder.length - 1),
  );
}

export async function catalog(): Promise<CatalogItem[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("catalog")
    .select("id,name")
    .order("id");
  if (error) throw new RuleError(cleanMessage(error.message));
  return visibleCatalog(data ?? []);
}

export async function adminData() {
  const [users, history] = await Promise.all([
    rpc<User[]>("admin_users"),
    rpc<
      { action: string; details: unknown; created_at: string; email: string }[]
    >("admin_audit"),
  ]);
  return { users, history };
}
