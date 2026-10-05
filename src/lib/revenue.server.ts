/**
 * Phase E revenue (server only): Razorpay payment links, coupon codes,
 * payment webhooks and 24h-window payment reminders. Never touches the
 * locked keyword-rule delivery flow.
 */
import { createHmac, timingSafeEqual } from "node:crypto";

import { makeCouponCode, nudgeDue } from "@/lib/revenue";

type AdminClient = import("@supabase/supabase-js").SupabaseClient;

export type RevenueTarget = {
  organizationId: string;
  platform: string;
  externalUserId: string;
  conversationId: string | null;
  socialAccountId: string | null;
};

async function event(admin: AdminClient, t: Pick<RevenueTarget, "organizationId" | "platform" | "externalUserId">, kind: string, refId: string | null, amount?: number) {
  await admin.from("revenue_events").insert({
    organization_id: t.organizationId, kind, platform: t.platform, external_user_id: t.externalUserId,
    ref_id: refId, amount_paise: amount ?? null,
  });
}

/** Create a per-customer payment link (Razorpay when keys exist, else the product's own link). */
export async function createPaymentLinkFor(admin: AdminClient, t: RevenueTarget, productId: string): Promise<{ url: string; amount: number; name: string } | { error: string }> {
  const { data: p } = await admin.from("revenue_products").select("id, name, description, price_paise, currency, manual_url, active")
    .eq("id", productId).eq("organization_id", t.organizationId).maybeSingle();
  if (!p || !p.active) return { error: "product_missing" };

  const { data: cred } = await admin.from("payment_credentials").select("razorpay_key_id, razorpay_key_secret")
    .eq("organization_id", t.organizationId).maybeSingle();

  let provider: "razorpay" | "manual" = "manual";
  let url = p.manual_url as string | null;
  let linkId: string | null = null;
  if (cred) {
    const secret = (await (await import("@/lib/token-crypto.server")).readToken(cred.razorpay_key_secret as string));
    const auth = Buffer.from(`${cred.razorpay_key_id}:${secret}`).toString("base64");
    const res = await fetch("https://api.razorpay.com/v1/payment_links", {
      method: "POST",
      headers: { Authorization: `Basic ${auth}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        amount: p.price_paise, currency: p.currency, description: String(p.name).slice(0, 2000),
        notes: { organization_id: t.organizationId, platform: t.platform, contact: t.externalUserId },
        reminder_enable: false,
      }),
    }).catch(() => null);
    if (res?.ok) {
      const j = (await res.json()) as { id?: string; short_url?: string };
      if (j.id && j.short_url) { provider = "razorpay"; url = j.short_url; linkId = j.id; }
    } else if (res) {
      console.error("razorpay link failed", res.status, (await res.text()).slice(0, 300));
    }
  }
  if (!url) return { error: cred ? "razorpay_failed" : "no_payment_method" };

  const { data: row } = await admin.from("payment_links").insert({
    organization_id: t.organizationId, product_id: p.id, conversation_id: t.conversationId, social_account_id: t.socialAccountId,
    platform: t.platform, external_user_id: t.externalUserId, provider, provider_link_id: linkId, url, amount_paise: p.price_paise,
  }).select("id").single();
  await event(admin, t, "payment_link", row?.id ?? null, p.price_paise);
  return { url, amount: p.price_paise as number, name: p.name as string };
}

/** Give a contact one unique code per campaign (same code again if already issued). */
export async function issueCoupon(admin: AdminClient, t: RevenueTarget, campaignId: string): Promise<string | null> {
  const { data: c } = await admin.from("coupon_campaigns").select("id, prefix, max_codes, expires_at, active")
    .eq("id", campaignId).eq("organization_id", t.organizationId).maybeSingle();
  if (!c || !c.active || (c.expires_at && new Date(c.expires_at) < new Date())) return null;
  const { data: had } = await admin.from("coupon_codes").select("code").eq("campaign_id", c.id)
    .eq("platform", t.platform).eq("external_user_id", t.externalUserId).maybeSingle();
  if (had) return had.code as string;
  const { count } = await admin.from("coupon_codes").select("id", { count: "exact", head: true }).eq("campaign_id", c.id);
  if ((count ?? 0) >= c.max_codes) return null;
  for (let i = 0; i < 4; i++) {
    const code = makeCouponCode(c.prefix as string);
    const { data: row, error } = await admin.from("coupon_codes").insert({
      campaign_id: c.id, organization_id: t.organizationId, code, platform: t.platform, external_user_id: t.externalUserId,
    }).select("id").single();
    if (!error && row) { await event(admin, t, "coupon", c.id as string); return code; }
  }
  return null;
}

export function validRazorpaySignature(body: string, signature: string | null, secret: string): boolean {
  if (!signature) return false;
  const expected = createHmac("sha256", secret).update(body).digest("hex");
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

/** Razorpay webhook: verified per workspace secret, marks link paid, tags contact "paid". */
export async function handleRazorpayWebhook(admin: AdminClient, orgId: string, body: string, signature: string | null) {
  const { data: cred } = await admin.from("payment_credentials").select("webhook_secret").eq("organization_id", orgId).maybeSingle();
  if (!cred || !validRazorpaySignature(body, signature, ((await (await import("@/lib/token-crypto.server")).readToken(cred.webhook_secret as string))) ?? "")) return { status: 401 };
  const evt = JSON.parse(body) as { event?: string; payload?: { payment_link?: { entity?: { id?: string; amount_paid?: number } } } };
  if (evt.event !== "payment_link.paid") return { status: 200 };
  const ent = evt.payload?.payment_link?.entity;
  if (!ent?.id) return { status: 200 };
  const { data: link } = await admin.from("payment_links").update({ status: "paid", paid_at: new Date().toISOString() })
    .eq("organization_id", orgId).eq("provider_link_id", ent.id).eq("status", "created")
    .select("id, platform, external_user_id, amount_paise").maybeSingle();
  if (!link) return { status: 200 };
  const t = { organizationId: orgId, platform: link.platform as string, externalUserId: link.external_user_id as string };
  await event(admin, t, "paid", link.id as string, ent.amount_paid ?? (link.amount_paise as number));
  await admin.from("contact_tags").upsert(
    { organization_id: orgId, platform: t.platform, external_user_id: t.externalUserId, tag: "paid", source: "payment" },
    { onConflict: "organization_id,platform,external_user_id,tag", ignoreDuplicates: true },
  );
  return { status: 200 };
}

/** Scheduler tick: one reminder per unpaid link, only inside Meta's 24h window. */
export async function runPaymentNudges(admin: AdminClient) {
  const { data: settings } = await admin.from("revenue_settings").select("organization_id, nudge_delay_minutes, nudge_text").eq("nudge_enabled", true);
  let sent = 0;
  const since = new Date(Date.now() - 23 * 3600_000).toISOString();
  for (const s of settings ?? []) {
    const { data: links } = await admin.from("payment_links").select("id, status, nudged_at, created_at, conversation_id, social_account_id, platform, external_user_id, url")
      .eq("organization_id", s.organization_id).eq("status", "created").is("nudged_at", null).gte("created_at", since).limit(30);
    for (const l of links ?? []) {
      if (!l.conversation_id || (l.platform !== "instagram" && l.platform !== "facebook")) continue;
      const { data: last } = await admin.from("messages").select("sent_at").eq("conversation_id", l.conversation_id)
        .eq("direction", "inbound").order("sent_at", { ascending: false }).limit(1).maybeSingle();
      if (!nudgeDue(l, (last?.sent_at as string | null) ?? null, s.nudge_delay_minutes)) continue;
      // Claim first so two ticks never remind twice.
      const { data: claimed } = await admin.from("payment_links").update({ nudged_at: new Date().toISOString() })
        .eq("id", l.id).is("nudged_at", null).select("id");
      if (!claimed?.length) continue;
      const { sendDirectDm } = await import("@/lib/flows-runner.server");
      const ok = await sendDirectDm(admin, {
        organizationId: s.organization_id, conversationId: l.conversation_id, socialAccountId: l.social_account_id,
        platform: l.platform, externalUserId: l.external_user_id,
      }, s.nudge_text, { title: "Complete payment", url: l.url }, "Payment reminder");
      if (ok) {
        sent++;
        await event(admin, { organizationId: s.organization_id, platform: l.platform, externalUserId: l.external_user_id }, "nudge", l.id);
      }
    }
  }
  return { sent };
}
