import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

type Ctx = { supabase: any; userId: string };
const org = z.string().uuid();
const httpsUrl = z.string().trim().max(500).regex(/^https:\/\//i, "Link must start with https://");
const formField = z.object({ key: z.string().regex(/^[a-z0-9_]{1,30}$/), label: z.string().trim().min(1).max(80), type: z.enum(["text", "email", "phone", "choice"]), required: z.boolean(), options: z.array(z.string().trim().min(1).max(30)).max(10) });

async function assertMember(ctx: Ctx, organizationId: string) {
  const { data } = await ctx.supabase.from("organizations").select("id").eq("id", organizationId).maybeSingle();
  if (!data) throw new Error("not_a_member");
}

async function assertPaymentAdmin(ctx: Ctx, organizationId: string) {
  const { data } = await ctx.supabase.rpc("current_user_has_org_role", { _org_id: organizationId, _roles: ["owner", "admin"] });
  if (data !== true) throw new Error("Only workspace owners and admins can change payment keys.");
}

/** Everything the Revenue page shows. Keys are never returned, only whether they exist. */
export const getRevenue = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ organizationId: org }).parse(d))
  .handler(async ({ data, context }) => {
    const ctx = context as Ctx;
    const sb = ctx.supabase;
    const o = data.organizationId;
    const since = new Date(Date.now() - 30 * 86400_000).toISOString();
    const [products, pages, campaigns, settings, links, events, dms] = await Promise.all([
      sb.from("revenue_products").select("*").eq("organization_id", o).order("created_at"),
      sb.from("delivery_pages").select("*").eq("organization_id", o).order("created_at"),
      sb.from("coupon_campaigns").select("*").eq("organization_id", o).order("created_at"),
      sb.from("revenue_settings").select("*").eq("organization_id", o).maybeSingle(),
      sb.from("payment_links").select("id, product_id, platform, external_user_id, provider, url, amount_paise, status, nudged_at, paid_at, created_at")
        .eq("organization_id", o).order("created_at", { ascending: false }).limit(100),
      sb.from("revenue_events").select("kind, amount_paise, ref_id").eq("organization_id", o).gte("created_at", since).limit(10000),
      sb.from("automation_runs").select("id", { count: "exact", head: true }).eq("organization_id", o).eq("status", "sent").gte("created_at", since),
    ]);
    await assertMember(ctx, o);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: cred } = await supabaseAdmin.from("payment_credentials").select("razorpay_key_id").eq("organization_id", o).maybeSingle();
    const ev = (events.data ?? []) as Array<{ kind: string; amount_paise: number | null }>;
    const n = (k: string) => ev.filter((e) => e.kind === k).length;
    return {
      products: products.data ?? [],
      pages: pages.data ?? [],
      campaigns: campaigns.data ?? [],
      settings: settings.data ?? { nudge_enabled: false, nudge_delay_minutes: 120, nudge_text: "Hi! Your payment link is still waiting. Need any help completing it?" },
      links: links.data ?? [],
      razorpay: cred ? { keyIdHint: `${String(cred.razorpay_key_id).slice(0, 8)}…` } : null,
      funnel: {
        dmsSent: dms.count ?? 0, pageViews: n("page_view"), pageClicks: n("page_click"), paymentLinks: n("payment_link"),
        paid: n("paid"), revenuePaise: ev.filter((e) => e.kind === "paid").reduce((s, e) => s + (e.amount_paise ?? 0), 0),
        coupons: n("coupon"), nudges: n("nudge"),
      },
    };
  });

export const saveProduct = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({
    organizationId: org, id: z.string().uuid().optional(), name: z.string().trim().min(1).max(120),
    description: z.string().max(500).nullable(), pricePaise: z.number().int().min(100).max(100_000_000),
    manualUrl: httpsUrl.nullable(), active: z.boolean(),
  }).parse(d))
  .handler(async ({ data, context }) => {
    const row = { organization_id: data.organizationId, name: data.name, description: data.description, price_paise: data.pricePaise, manual_url: data.manualUrl, active: data.active };
    const q = (context as Ctx).supabase.from("revenue_products");
    if (data.id) {
      const { error } = await q.update(row).eq("id", data.id).eq("organization_id", data.organizationId);
      if (error) throw new Error(error.message);
      return { ok: true, id: data.id };
    }
    const { data: created, error } = await q.insert(row).select("id").single();
    if (error) throw new Error(error.message);
    return { ok: true, id: (created as { id: string }).id };
  });

export const savePage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({
    organizationId: org, id: z.string().uuid().optional(), slug: z.string().regex(/^[a-z0-9-]{3,60}$/),
    title: z.string().trim().min(1).max(120), body: z.string().max(8000).nullable(),
    buttonLabel: z.string().max(40).nullable(), buttonUrl: httpsUrl.nullable(), active: z.boolean(),
    imagePath: z.string().regex(/^[0-9a-f-]{36}\/[A-Za-z0-9._-]+$/).nullable(), showImage: z.boolean(), imageAlt: z.string().trim().max(160).nullable(),
    countdownAt: z.string().datetime().nullable(), expiryAction: z.enum(["disable_cta", "hide_cta"]), expiryMessage: z.string().trim().max(160).nullable(),
    formConfig: z.object({ mode: z.enum(["none", "optional", "required"]), consent: z.string().trim().max(300), fields: z.array(formField).max(8) }),
  }).parse(d))
  .handler(async ({ data, context }) => {
    const row = { organization_id: data.organizationId, slug: data.slug, title: data.title, body: data.body, button_label: data.buttonLabel, button_url: data.buttonUrl, active: data.active,
      image_path: data.imagePath, show_image: data.showImage, image_alt: data.imageAlt, countdown_at: data.countdownAt, expiry_action: data.expiryAction, expiry_message: data.expiryMessage,
      form_config: data.formConfig };
    const q = (context as Ctx).supabase.from("delivery_pages");
    const { error } = data.id ? await q.update(row).eq("id", data.id).eq("organization_id", data.organizationId) : await q.insert(row);
    if (error) throw new Error(error.code === "23505" ? "This page address is already taken" : error.message);
    return { ok: true };
  });

export const saveCampaign = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({
    organizationId: org, id: z.string().uuid().optional(), name: z.string().trim().min(1).max(80),
    prefix: z.string().trim().toUpperCase().regex(/^[A-Z0-9]{2,12}$/), discountLabel: z.string().trim().min(1).max(80),
    maxCodes: z.number().int().min(1).max(100000), expiresAt: z.string().datetime().nullable(), active: z.boolean(),
  }).parse(d))
  .handler(async ({ data, context }) => {
    const row = { organization_id: data.organizationId, name: data.name, prefix: data.prefix, discount_label: data.discountLabel, max_codes: data.maxCodes, expires_at: data.expiresAt, active: data.active };
    const q = (context as Ctx).supabase.from("coupon_campaigns");
    if (data.id) {
      const { error } = await q.update(row).eq("id", data.id).eq("organization_id", data.organizationId);
      if (error) throw new Error(error.message);
      return { ok: true, id: data.id };
    }
    const { data: created, error } = await q.insert(row).select("id").single();
    if (error) throw new Error(error.message);
    return { ok: true, id: (created as { id: string }).id };
  });

export const deleteRevenueItem = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ organizationId: org, id: z.string().uuid(), table: z.enum(["revenue_products", "delivery_pages", "coupon_campaigns"]) }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await (context as Ctx).supabase.from(data.table).delete().eq("id", data.id).eq("organization_id", data.organizationId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const saveRevenueSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({
    organizationId: org, nudgeEnabled: z.boolean(), nudgeDelayMinutes: z.number().int().min(15).max(1200), nudgeText: z.string().trim().min(1).max(600),
  }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await (context as Ctx).supabase.from("revenue_settings").upsert({
      organization_id: data.organizationId, nudge_enabled: data.nudgeEnabled, nudge_delay_minutes: data.nudgeDelayMinutes,
      nudge_text: data.nudgeText, updated_at: new Date().toISOString(),
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Write-only: keys go straight to a server-only table and are never sent back. */
export const saveRazorpayKeys = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({
    organizationId: org, keyId: z.string().trim().regex(/^rzp_(test|live)_[A-Za-z0-9]{6,40}$/, "Key ID looks wrong"),
    keySecret: z.string().trim().min(10).max(100), webhookSecret: z.string().trim().min(6).max(100),
  }).parse(d))
  .handler(async ({ data, context }) => {
    await assertPaymentAdmin(context as Ctx, data.organizationId);
    // Check the keys with a harmless read before saving.
    const auth = Buffer.from(`${data.keyId}:${data.keySecret}`).toString("base64");
    const res = await fetch("https://api.razorpay.com/v1/payment_links?count=1", { headers: { Authorization: `Basic ${auth}` } }).catch(() => null);
    if (!res || res.status === 401) throw new Error("Razorpay did not accept these keys");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("payment_credentials").upsert({
      organization_id: data.organizationId, razorpay_key_id: data.keyId, razorpay_key_secret: (await (await import("@/lib/token-crypto.server")).storeToken(data.keySecret)) ?? data.keySecret,
      webhook_secret: (await (await import("@/lib/token-crypto.server")).storeToken(data.webhookSecret)) ?? data.webhookSecret, updated_at: new Date().toISOString(),
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const removeRazorpayKeys = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ organizationId: org }).parse(d))
  .handler(async ({ data, context }) => {
    await assertPaymentAdmin(context as Ctx, data.organizationId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("payment_credentials").delete().eq("organization_id", data.organizationId);
    return { ok: true };
  });

/** Public: one active delivery page by address. Counts the view. */
export const getPublicPage = createServerFn({ method: "GET" })
  .inputValidator((d: unknown) => z.object({ slug: z.string().regex(/^[a-z0-9-]{3,60}$/) }).parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: p } = await supabaseAdmin.from("delivery_pages").select("id, organization_id, title, body, button_label, button_url, views, image_path, show_image, image_alt, countdown_at, expiry_action, expiry_message, form_config")
      .eq("slug", data.slug).eq("active", true).maybeSingle();
    if (!p) return null;
    await supabaseAdmin.from("delivery_pages").update({ views: (p.views ?? 0) + 1 }).eq("id", p.id);
    await supabaseAdmin.from("revenue_events").insert({ organization_id: p.organization_id, kind: "page_view", ref_id: p.id });
    return { title: p.title as string, body: (p.body as string | null) ?? "", buttonLabel: p.button_label as string | null, hasButton: !!p.button_url,
      imageUrl: p.show_image && p.image_path ? `/api/public/delivery-image/${encodeURIComponent(p.image_path as string)}` : null, imageAlt: p.image_alt as string | null,
      countdownAt: p.countdown_at as string | null, expiryAction: p.expiry_action as "disable_cta" | "hide_cta", expiryMessage: p.expiry_message as string | null,
      formConfig: p.form_config as { mode: "none" | "optional" | "required"; consent?: string; fields?: unknown[] } };
  });

/** Public buyer-bound offer. The token identifies only one stored payment link. */
export const getOfferPage = createServerFn({ method: "GET" })
  .inputValidator((d: unknown) => z.object({ token: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: link } = await supabaseAdmin.from("payment_links")
      .select("id, organization_id, delivery_pages!inner(id, title, body, button_label, active, image_path, show_image, image_alt, countdown_at, expiry_action, expiry_message)")
      .eq("offer_token", data.token).maybeSingle();
    const p = Array.isArray(link?.delivery_pages) ? link?.delivery_pages[0] : link?.delivery_pages;
    if (!link || !p?.active) return null;
    await supabaseAdmin.from("revenue_events").insert({ organization_id: link.organization_id, kind: "page_view", ref_id: link.id });
    return { title: p.title as string, body: (p.body as string | null) ?? "", buttonLabel: (p.button_label as string | null) || "Pay now",
      imageUrl: p.show_image && p.image_path ? `/api/public/delivery-image/${encodeURIComponent(p.image_path as string)}` : null, imageAlt: p.image_alt as string | null,
      countdownAt: p.countdown_at as string | null, expiryAction: p.expiry_action as "disable_cta" | "hide_cta", expiryMessage: p.expiry_message as string | null };
  });
