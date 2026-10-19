import { z } from "zod";
import type { User } from "./types";

// Public worker contact is saved with the existing public request description.
// This versioned footer needs no database schema or permission changes.
const marker = "\n\n[HTA worker contact v1]\n";
const contactSchema = z.object({
  ownerId: z.uuid(),
  name: z.string().min(1).max(161),
  email: z.email().max(254),
  phone: z.string().min(1).max(30),
});
export type WorkerContact = z.infer<typeof contactSchema>;

export function contactFromUser(user: User): WorkerContact {
  return contactSchema.parse({
    ownerId: user.id,
    name: `${user.first_name} ${user.last_name}`.replace(/\s+/g, " ").trim(),
    email: user.email,
    phone: user.phone,
  });
}

export function summaryLimit(contact: WorkerContact) {
  return 2000 - marker.length - JSON.stringify(contact).length;
}

export function summaryWithContact(summary: string, contact: WorkerContact) {
  const validated = contactSchema.parse(contact);
  const text = readRequestSummary(summary, validated.ownerId).summary.trim();
  if (text.length > summaryLimit(validated)) {
    throw new RangeError(
      "The request summary is too long to include worker contact details.",
    );
  }
  return text + marker + JSON.stringify(validated);
}

export function readRequestSummary(
  stored: string,
  ownerId: string,
): { summary: string; contact?: WorkerContact } {
  const index = stored.lastIndexOf(marker);
  if (index < 0) return { summary: stored };
  try {
    const result = contactSchema.safeParse(
      JSON.parse(stored.slice(index + marker.length)),
    );
    if (result.success && result.data.ownerId === ownerId) {
      return { summary: stored.slice(0, index), contact: result.data };
    }
  } catch {
    // Old requests and ordinary text remain readable without a migration.
  }
  return { summary: stored };
}
