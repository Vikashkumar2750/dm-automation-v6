/**
 * WhatsApp OTP for delivery-page lead forms (server only).
 *
 * Security rules:
 * - The OTP is generated here, hashed (SHA-256) before storage, and NEVER
 *   returned to the browser. The frontend only gets a verification id.
 * - Meta credentials (access token, phone number id) live in the server-only
 *   `whatsapp_otp_settings` table, encrypted at rest via token-crypto.
 * - Rate limits: max 3 OTPs per phone per hour, 5 verify attempts, 5-minute
 *   expiry. A verified code is consumed on form submit.
 */
import { createHash, randomInt } from "node:crypto";

type AdminClient = import("@supabase/supabase-js").SupabaseClient;

const OTP_TTL_MS = 5 * 60_000;
const MAX_ATTEMPTS = 5;
const MAX_PER_HOUR = 3;
const VERIFIED_VALID_MS = 30 * 60_000;

export function hashOtp(code: string): string {
  return createHash("sha256").update(`autodm-otp:${code}`).digest("hex");
}

/** Normalise to digits only, keeping the country code (91… for India). */
export function normalizePhone(raw: string): string {
  let d = raw.replace(/\D/g, "");
  if (d.length === 10) d = `91${d}`;
  if (d.length === 11 && d.startsWith("0")) d = `91${d.slice(1)}`;
  return d;
}

type OtpSettings = { phone_number_id: string; access_token: string; template_name: string; template_language: string };

async function loadSettings(admin: AdminClient, organizationId: string): Promise<OtpSettings | null> {
  const { data } = await admin.from("whatsapp_otp_settings").select("phone_number_id, access_token, template_name, template_language")
    .eq("organization_id", organizationId).maybeSingle();
  if (!data) return null;
  const { readToken } = await import("@/lib/token-crypto.server");
  const token = await readToken(data.access_token as string);
  if (!token) return null;
  return { phone_number_id: data.phone_number_id as string, access_token: token, template_name: data.template_name as string, template_language: (data.template_language as string) || "en" };
}

/** Send the OTP through Meta's Cloud API authentication template. Meta replaces {{1}} with the code. */
async function sendViaMeta(s: OtpSettings, phone: string, code: string): Promise<{ ok: boolean; error?: string }> {
  const res = await fetch(`https://graph.facebook.com/v21.0/${s.phone_number_id}/messages`, {
    method: "POST",
    headers: { Authorization: `Bearer ${s.access_token}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      to: phone,
      type: "template",
      template: {
        name: s.template_name,
        language: { code: s.template_language },
        components: [
          { type: "body", parameters: [{ type: "text", text: code }] },
          // Authentication templates have a copy-code button whose parameter is the same code.
          { type: "button", sub_type: "url", index: "0", parameters: [{ type: "text", text: code }] },
        ],
      },
    }),
  }).catch(() => null);
  if (!res) return { ok: false, error: "network" };
  if (res.ok) return { ok: true };
  const body = (await res.text()).slice(0, 300);
  console.error("whatsapp otp send failed", res.status, body);
  return { ok: false, error: `meta_${res.status}` };
}

/** Create + send an OTP. Returns only the verification id — never the code. */
export async function issueLeadOtp(admin: AdminClient, organizationId: string, pageRef: string, rawPhone: string): Promise<{ verificationId: string } | { error: string }> {
  const phone = normalizePhone(rawPhone);
  if (phone.length < 11 || phone.length > 15) return { error: "Enter a valid phone number" };
  const settings = await loadSettings(admin, organizationId);
  if (!settings) return { error: "WhatsApp verification is not set up for this page" };

  const since = new Date(Date.now() - 3600_000).toISOString();
  const { count } = await admin.from("lead_otp_codes").select("id", { count: "exact", head: true })
    .eq("organization_id", organizationId).eq("phone", phone).gte("created_at", since);
  if ((count ?? 0) >= MAX_PER_HOUR) return { error: "Too many codes requested. Please try again in an hour." };

  const code = String(randomInt(100000, 999999));
  const sent = await sendViaMeta(settings, phone, code);
  if (!sent.ok) return { error: "Could not send the WhatsApp code right now. Please try again." };

  const { data: row, error } = await admin.from("lead_otp_codes").insert({
    organization_id: organizationId, page_ref: pageRef, phone,
    code_hash: hashOtp(code), expires_at: new Date(Date.now() + OTP_TTL_MS).toISOString(),
  }).select("id").single();
  if (error || !row) return { error: "Could not start verification" };
  return { verificationId: row.id as string };
}

/** Check a code against a verification id. Marks the row verified on success. */
export async function verifyLeadOtp(admin: AdminClient, verificationId: string, code: string): Promise<{ ok: true; phone: string; pageRef: string } | { error: string }> {
  const { data: row } = await admin.from("lead_otp_codes").select("id, phone, page_ref, code_hash, attempts, expires_at, verified_at")
    .eq("id", verificationId).maybeSingle();
  if (!row) return { error: "Verification not found — request a new code" };
  if (row.verified_at) return { ok: true, phone: row.phone as string, pageRef: row.page_ref as string };
  if (new Date(row.expires_at as string).getTime() < Date.now()) return { error: "This code has expired — request a new one" };
  if ((row.attempts as number) >= MAX_ATTEMPTS) return { error: "Too many wrong attempts — request a new code" };
  if (hashOtp(code.trim()) !== row.code_hash) {
    await admin.from("lead_otp_codes").update({ attempts: (row.attempts as number) + 1 }).eq("id", row.id);
    return { error: "Wrong code — please check and try again" };
  }
  await admin.from("lead_otp_codes").update({ verified_at: new Date().toISOString() }).eq("id", row.id);
  return { ok: true, phone: row.phone as string, pageRef: row.page_ref as string };
}

/**
 * Form-submit gate: when a page requires OTP, a verified (not yet consumed)
 * code must exist for this phone + page within the last 30 minutes.
 * Consumes the code so one verification = one submission.
 */
export async function consumeVerifiedOtp(admin: AdminClient, organizationId: string, pageRef: string, rawPhone: string): Promise<boolean> {
  const phone = normalizePhone(rawPhone);
  const since = new Date(Date.now() - VERIFIED_VALID_MS).toISOString();
  const { data: row } = await admin.from("lead_otp_codes").select("id")
    .eq("organization_id", organizationId).eq("page_ref", pageRef).eq("phone", phone)
    .not("verified_at", "is", null).gte("verified_at", since)
    .order("verified_at", { ascending: false }).limit(1).maybeSingle();
  if (!row) return false;
  // Delete so the same verification cannot be reused for many submissions.
  await admin.from("lead_otp_codes").delete().eq("id", row.id);
  return true;
}

/** Super Admin diagnostics: verify a workspace's WhatsApp credentials without sending a message. */
export async function checkWhatsappCredentials(admin: AdminClient, organizationId: string): Promise<{ ok: boolean; detail: string }> {
  const s = await loadSettings(admin, organizationId);
  if (!s) return { ok: false, detail: "Token missing or unreadable" };
  const res = await fetch(`https://graph.facebook.com/v21.0/${s.phone_number_id}?fields=display_phone_number,quality_rating`, {
    headers: { Authorization: `Bearer ${s.access_token}` },
  }).catch(() => null);
  if (!res) return { ok: false, detail: "Network error reaching Meta" };
  const body = await res.text();
  if (!res.ok) return { ok: false, detail: `Meta ${res.status}: ${body.slice(0, 160)}` };
  try {
    const j = JSON.parse(body) as { display_phone_number?: string; quality_rating?: string };
    return { ok: true, detail: `${j.display_phone_number ?? "number ok"}${j.quality_rating ? ` · quality ${j.quality_rating}` : ""}` };
  } catch { return { ok: true, detail: "Credentials valid" }; }
}

/** Super Admin diagnostics: send a sample code through a workspace's template. The code is not stored. */
export async function sendTestWhatsappOtp(admin: AdminClient, organizationId: string, rawPhone: string): Promise<{ ok: boolean; detail: string }> {
  const phone = normalizePhone(rawPhone);
  if (phone.length < 11 || phone.length > 15) return { ok: false, detail: "Invalid phone number" };
  const s = await loadSettings(admin, organizationId);
  if (!s) return { ok: false, detail: "WhatsApp OTP not set up" };
  const r = await sendViaMeta(s, phone, String(randomInt(100000, 999999)));
  return r.ok ? { ok: true, detail: "Sent" } : { ok: false, detail: r.error ?? "Failed" };
}
