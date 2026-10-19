import { z } from "zod";
import { createClient } from "./supabase/server";
import { canManage } from "./types";
import {
  contactFromUser,
  readRequestSummary,
  summaryLimit,
  summaryWithContact,
  type WorkerContact,
} from "./request-contact";
import type {
  Commitment,
  Item,
  RequestDetail,
  RequestRow,
  User,
} from "./types";

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

function publicDescription(summary: string, contact: WorkerContact) {
  check(
    summary.length <= summaryLimit(contact),
    `Shorten the public summary to ${summaryLimit(contact)} characters to include the worker's contact details.`,
  );
  return summaryWithContact(summary, contact);
}

export async function requestOwnerContact(user: User, ownerId: string) {
  if (user.id === ownerId) return contactFromUser(user);
  check(user.role === "admin", "You cannot edit this request.");
  const profiles = await rpc<User[]>("admin_users");
  const owner = profiles.find((profile) => profile.id === ownerId);
  if (!owner) throw new RuleError("The submitting worker could not be found.");
  return contactFromUser(owner);
}

export async function createRequest(user: User, input: unknown) {
  const data = requestInput.parse(input);
  return rpc<{ id: string; number: string }>("create_request", {
    p_summary: publicDescription(data.summary, contactFromUser(user)),
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
  if (!existing || !canManage(_user, existing.request)) {
    throw new RuleError("You cannot edit this request.");
  }
  const narrative = narrativeInput.safeParse(existing?.request.narrative);
  check(narrative.success, "Request details could not be read.");
  const contact = await requestOwnerContact(_user, existing.request.owner_id);

  await rpc("edit_request", {
    p_request_id: validId(id),
    p_summary: publicDescription(data.summary, contact),
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
  user: User,
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
  check(
    user.id !== id || (role === "admin" && active),
    "Ask another active administrator to change your administrator access.",
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
  const rows = await rpc<(RequestRow & { received?: string })[]>(
    "list_requests",
    {
      p_status: status,
      p_search: search.slice(0, 120),
    },
  );
  return rows.map(({ received: _legacyReceived, ...row }) => ({
    ...row,
    summary: readRequestSummary(row.summary, row.owner_id).summary,
  }));
}

export async function requestDetails(_user: User, id: string) {
  const data = await rpc<{
    request: RequestDetail;
    items: (Item & { received?: number })[];
    commitments: (Omit<Commitment, "modifiable"> & {
      received?: number;
    })[];
    history: { action: string; details: unknown; created_at: string }[];
  } | null>("request_details", { p_request_id: validId(id) });
  if (!data) return null;
  const { summary, contact } = readRequestSummary(
    data.request.summary,
    data.request.owner_id,
  );
  return {
    ...data,
    request: {
      ...data.request,
      summary,
      owner_name: contact?.name ?? data.request.owner_name,
      owner_email: contact?.email,
      owner_phone: contact?.phone,
    },
    items: data.items.map(({ received: _legacyReceived, ...item }) => item),
    commitments: data.commitments.map(
      ({ received: _legacyReceived, ...commitment }) => ({
        ...commitment,
        status:
          commitment.status === "received" ? "committed" : commitment.status,
        modifiable: commitment.status === "committed",
      }),
    ),
    history: data.history.filter((entry) => entry.action !== "items.received"),
  };
}

export async function myCommitments(_user: User): Promise<Commitment[]> {
  const rows =
    await rpc<(Omit<Commitment, "modifiable"> & { received?: number })[]>(
      "my_commitments",
    );
  return rows.map(({ received: _legacyReceived, ...commitment }) => ({
    ...commitment,
    status: commitment.status === "received" ? "committed" : commitment.status,
    modifiable: commitment.status === "committed",
  }));
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
