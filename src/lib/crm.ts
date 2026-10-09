/** Phase D CRM: pure helpers (client-safe). */
export type SegmentFilter = { tag?: string | undefined; platform?: "instagram" | "facebook" | "youtube" | undefined; hasEmail?: boolean | undefined; hasPhone?: boolean | undefined; search?: string | undefined };

export type CrmContact = {
  key: string; // platform:external_user_id
  name: string;
  platform: "instagram" | "facebook" | "youtube";
  tags: string[];
  email: string | null;
  phone: string | null;
  lastAt: string;
};

export function matchesSegment(c: CrmContact, f: SegmentFilter): boolean {
  if (f.platform && c.platform !== f.platform) return false;
  if (f.tag && !c.tags.includes(f.tag)) return false;
  if (f.hasEmail && !c.email) return false;
  if (f.hasPhone && !c.phone) return false;
  const term = f.search?.trim().toLowerCase();
  if (term && !c.name.toLowerCase().includes(term) && !(c.email ?? "").toLowerCase().includes(term)) return false;
  return true;
}

import { csvCell as cell } from "@/lib/csv-safe";

export function contactsToCsv(rows: CrmContact[]): string {
  const head = ["name", "platform", "email", "phone", "tags", "last_activity"];
  const lines = rows.map((r) => [r.name, r.platform, r.email ?? "", r.phone ?? "", r.tags.join("; "), r.lastAt].map(cell).join(","));
  return [head.join(","), ...lines].join("\n");
}

export type PageLead = { id: string; pageTitle: string; pageSlug: string; answers: Record<string, string>; createdAt: string };

/** Delivery-page form leads → CSV. Standard columns first, then every custom answer. */
export function pageLeadsToCsv(rows: PageLead[]): string {
  const std = ["name", "email", "phone", "pincode"];
  const extra = [...new Set(rows.flatMap((r) => Object.keys(r.answers)).filter((k) => !std.includes(k)))].sort();
  const head = [...std, ...extra, "page", "page_link", "submitted_at"];
  const lines = rows.map((r) =>
    [...std.map((k) => r.answers[k] ?? ""), ...extra.map((k) => r.answers[k] ?? ""), r.pageTitle, `/p/${r.pageSlug}`, r.createdAt].map(cell).join(","));
  return [head.join(","), ...lines].join("\n");
}

/** Find an email / phone number inside message text (used to suggest values). */
export function extractContactInfo(text: string): { email: string | null; phone: string | null } {
  const email = text.match(/[\w.+-]+@[\w-]+\.[\w.-]+/)?.[0] ?? null;
  const phoneRaw = text.match(/(\+?\d[\d\s-]{8,14}\d)/)?.[0] ?? null;
  const digits = phoneRaw?.replace(/[^\d+]/g, "") ?? "";
  return { email, phone: digits.replace(/\D/g, "").length >= 10 ? digits : null };
}

export function normalizeTag(t: string): string {
  return t.trim().toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9_-]/g, "").slice(0, 40);
}
