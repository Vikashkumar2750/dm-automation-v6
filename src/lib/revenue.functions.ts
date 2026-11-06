import { isProductFile, validProductFileRef } from "@/lib/product-files";
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { automaticCheckout, checkoutAmount, couponPrice, withCharges, type PageCharges } from "@/lib/revenue";

import { validateLeadValue, nextLeadStage, type LeadField, type LeadStage } from "@/lib/delivery-page";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

type Ctx = { supabase: any; userId: string };
const org = z.string().uuid();
type FormConfig = { mode: "none" | "optional" | "required"; consent?: string; fields?: LeadField[] };
const httpsUrl = z.string().trim().max(500).regex(/^https:\/\//i, "Link must start with https://");
/** Content target: an https link or an uploaded file reference (folder checked against the workspace in the handler). */
const contentTarget = z.string().trim().max(500).regex(/^(https:\/\/|file:)/i, "Link must start with https://");
const assertOwnFile = (v: string | null, orgId: string) => { if (v && isProductFile(v) && !validProductFileRef(v, orgId)) throw new Error("Uploaded file does not belong to this workspace"); };
const formField = z.object({ key: z.string().regex(/^[a-z0-9_]{1,30}$/), label: z.string().trim().min(1).max(80), type: z.enum(["text", "email", "phone", "pincode", "choice"]), required: z.boolean(), options: z.array(z.string().trim().min(1).max(30)).max(10) });

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
  .inputValidator((d: unknown) => z.object({ organizationId: org, socialAccountId: z.string().uuid().optional() }).parse(d))
  .handler(async ({ data, context }) => {
    const ctx = context as Ctx;
    const sb = ctx.supabase;
    const o = data.organizationId;
    const since = new Date(Date.now() - 30 * 86400_000).toISOString();
    const [products, pages, campaigns, settings, links, events, dms, leads, accounts] = await Promise.all([
      sb.from("revenue_products").select("*").eq("organization_id", o).order("created_at"),
      sb.from("delivery_pages").select("*").eq("organization_id", o).order("created_at"),
      sb.from("coupon_campaigns").select("*").eq("organization_id", o).order("created_at"),
      sb.from("revenue_settings").select("*").eq("organization_id", o).maybeSingle(),
      sb.from("payment_links").select("id, product_id, platform, external_user_id, provider, url, amount_paise, status, nudged_at, paid_at, created_at")
        .eq("organization_id", o).or(data.socialAccountId ? `social_account_id.eq.${data.socialAccountId}` : "id.not.is.null").order("created_at", { ascending: false }).limit(100),
      sb.from("revenue_events").select("kind, amount_paise, ref_id").eq("organization_id", o).gte("created_at", since).limit(10000),
      sb.from("automation_runs").select("id", { count: "exact", head: true }).eq("organization_id", o).eq("status", "sent").gte("created_at", since),
      sb.from("delivery_page_leads").select("id, delivery_page_id, answers, created_at").eq("organization_id", o).order("created_at", { ascending: false }).limit(200),
      sb.from("social_accounts").select("id, platform, name, handle, external_id").eq("organization_id", o).order("created_at"),
    ]);
    await assertMember(ctx, o);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: cred } = await supabaseAdmin.from("payment_credentials").select("razorpay_key_id").eq("organization_id", o).maybeSingle();
    const { data: otpCfg } = await supabaseAdmin.from("whatsapp_otp_settings").select("phone_number_id, template_name").eq("organization_id", o).maybeSingle();
    const ev = (events.data ?? []) as Array<{ kind: string; amount_paise: number | null }>;
    const n = (k: string) => ev.filter((e) => e.kind === k).length;
    return {
      products: products.data ?? [],
      pages: pages.data ?? [],
      leads: (leads.data ?? []) as Array<{ id: string; delivery_page_id: string; answers: Record<string, string>; created_at: string }>,
      campaigns: campaigns.data ?? [],
      accounts: (accounts.data ?? []) as Array<{ id: string; platform: string; name: string; handle: string | null; external_id: string }>,
      settings: settings.data ?? { nudge_enabled: false, nudge_delay_minutes: 120, nudge_text: "Hi! Your payment link is still waiting. Need any help completing it?" },
      links: links.data ?? [],
      razorpay: cred ? { connected: true } : null,
      whatsappOtp: otpCfg ? { phoneNumberId: String(otpCfg.phone_number_id).slice(0, 4) + "…", templateName: otpCfg.template_name as string } : null,
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
    originalPricePaise: z.number().int().min(0).max(100_000_000).nullable().default(null),
    manualUrl: httpsUrl.nullable(), deliveryUrl: contentTarget.nullable().default(null), active: z.boolean(),
  }).parse(d))
  .handler(async ({ data, context }) => {
    await (await import("@/lib/workspace-features.server")).assertRevenueWritable(data.organizationId);
    assertOwnFile(data.deliveryUrl, data.organizationId);
    const row = { organization_id: data.organizationId, name: data.name, description: data.description, price_paise: data.pricePaise, original_price_paise: data.originalPricePaise, manual_url: data.manualUrl, delivery_url: data.deliveryUrl, active: data.active };
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
    buttonLabel: z.string().max(40).nullable(), buttonUrl: contentTarget.nullable(), active: z.boolean(),
    imagePath: z.string().regex(/^[0-9a-f-]{36}\/[A-Za-z0-9._-]+$/).nullable(), showImage: z.boolean(), imageAlt: z.string().trim().max(160).nullable(),
    countdownAt: z.string().datetime().nullable(), expiryAction: z.enum(["disable_cta", "hide_cta"]), expiryMessage: z.string().trim().max(160).nullable(),
    formConfig: z.object({ mode: z.enum(["none", "optional", "required"]), consent: z.string().trim().max(300), fields: z.array(formField).max(8), extras: z.object({ creatorName: z.string().trim().max(80).optional(), supportEmail: z.string().trim().max(120).optional(), deliverables: z.object({ count: z.string().trim().max(40).optional(), format: z.string().trim().max(40).optional(), size: z.string().trim().max(40).optional() }).optional(), policies: z.object({ refund: z.string().trim().max(1500).optional(), fulfilment: z.string().trim().max(1500).optional(), privacy: z.string().trim().max(1500).optional(), terms: z.string().trim().max(1500).optional() }).optional(), disclaimer: z.string().trim().max(1500).optional(), charges: z.object({ gstPercent: z.number().min(0).max(28).optional(), passFee: z.boolean().optional() }).optional(), socials: z.array(z.object({ platform: z.enum(["instagram", "facebook", "linkedin", "youtube", "x"]), url: z.string().trim().url().max(300).refine((u) => u.startsWith("https://")), label: z.string().trim().max(80).optional() })).max(10).optional() }).optional() }),
    showPrice: z.boolean().default(false), priceOriginalPaise: z.number().int().min(0).max(100_000_000).nullable().default(null),
    priceOfferPaise: z.number().int().min(0).max(100_000_000).nullable().default(null), discountLabel: z.string().trim().max(40).nullable().default(null),
    couponCode: z.string().trim().toUpperCase().regex(/^[A-Z0-9-]{1,30}$/, "Coupon code: letters, numbers or - only").nullable().default(null),
    couponNote: z.string().trim().max(120).nullable().default(null), productId: z.string().uuid().nullable().default(null),
    couponCampaignId: z.string().uuid().nullable().default(null), otpRequired: z.boolean().default(false),
  }).parse(d))
  .handler(async ({ data, context }) => {
    await (await import("@/lib/workspace-features.server")).assertRevenueWritable(data.organizationId);
    assertOwnFile(data.buttonUrl, data.organizationId);
    if (data.productId) {
      const { data: pr } = await (context as Ctx).supabase.from("revenue_products").select("id").eq("id", data.productId).eq("organization_id", data.organizationId).maybeSingle();
      if (!pr) throw new Error("Product not found in this workspace");
    }
    if (data.couponCampaignId) {
      const { data: cc } = await (context as Ctx).supabase.from("coupon_campaigns").select("id").eq("id", data.couponCampaignId).eq("organization_id", data.organizationId).maybeSingle();
      if (!cc) throw new Error("Coupon campaign not found in this workspace");
    }
    const row = { product_id: data.productId, organization_id: data.organizationId, slug: data.slug, title: data.title, body: data.body, button_label: data.buttonLabel, button_url: data.buttonUrl, active: data.active,
      image_path: data.imagePath, show_image: data.showImage, image_alt: data.imageAlt, countdown_at: data.countdownAt, expiry_action: data.expiryAction, expiry_message: data.expiryMessage,
      form_config: data.formConfig, show_price: data.showPrice, price_original_paise: data.priceOriginalPaise, price_offer_paise: data.priceOfferPaise,
      discount_label: data.discountLabel, coupon_code: data.couponCode, coupon_note: data.couponNote,
      coupon_campaign_id: data.couponCampaignId, otp_required: data.otpRequired };
    const q = (context as Ctx).supabase.from("delivery_pages");
    if (data.id) {
      const { error } = await q.update(row).eq("id", data.id).eq("organization_id", data.organizationId);
      if (error) throw new Error(error.code === "23505" ? "This page address is already taken" : error.message);
      return { ok: true, id: data.id };
    }
    const { data: created, error } = await q.insert(row).select("id").single();
    if (error) throw new Error(error.code === "23505" ? "This page address is already taken" : error.message);
    return { ok: true, id: (created as { id: string }).id };
  });

export const saveCampaign = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({
    organizationId: org, id: z.string().uuid().optional(), name: z.string().trim().min(1).max(80),
    prefix: z.string().trim().toUpperCase().regex(/^[A-Z0-9]{2,12}$/), discountLabel: z.string().trim().min(1).max(80),
    maxCodes: z.number().int().min(1).max(100000), expiresAt: z.string().datetime().nullable(), active: z.boolean(),
    kind: z.enum(["dm_unique", "store_code"]).default("dm_unique"),
    storeCode: z.string().trim().toUpperCase().regex(/^[A-Z0-9-]{2,30}$/, "Store code: letters, numbers or - only").nullable().default(null),
  }).parse(d))
  .handler(async ({ data, context }) => {
    await (await import("@/lib/workspace-features.server")).assertRevenueWritable(data.organizationId);
    const row = { organization_id: data.organizationId, name: data.name, prefix: data.prefix, discount_label: data.discountLabel, max_codes: data.maxCodes, expires_at: data.expiresAt, active: data.active,
      kind: data.kind, store_code: data.kind === "store_code" ? (data.storeCode ?? data.prefix) : null };
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
    await (await import("@/lib/workspace-features.server")).assertRevenueWritable(data.organizationId);
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
    await (await import("@/lib/workspace-features.server")).assertRevenueWritable(data.organizationId);
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
    const { data: p } = await supabaseAdmin.from("delivery_pages").select("id, organization_id, title, body, button_label, button_url, views, image_path, show_image, image_alt, countdown_at, expiry_action, expiry_message, form_config, show_price, price_original_paise, price_offer_paise, discount_label, coupon_code, coupon_note, coupon_campaign_id, otp_required, product_id")
      .eq("slug", data.slug).eq("active", true).maybeSingle();
    if (!p) return null;
    const wf = await (await import("@/lib/workspace-features.server")).workspaceFeaturesFor(p.organization_id as string);
    if (wf.delivery_pages === "off" || wf.revenue === "hidden") return null;
    await supabaseAdmin.from("delivery_pages").update({ views: (p.views ?? 0) + 1 }).eq("id", p.id);
    await supabaseAdmin.from("revenue_events").insert({ organization_id: p.organization_id, kind: "page_view", ref_id: p.id });
    const { data: product } = p.product_id ? await supabaseAdmin.from("revenue_products").select("price_paise, original_price_paise, active").eq("id", p.product_id).eq("organization_id", p.organization_id).maybeSingle() : { data: null };
    const { data: credentials } = await supabaseAdmin.from("payment_credentials").select("organization_id").eq("organization_id", p.organization_id).maybeSingle();
    const amount = checkoutAmount(p.price_offer_paise, product, !!p.product_id);
    const checkout = automaticCheckout(!!credentials, amount);
    const config = (p.form_config ?? { mode: "none", fields: [] }) as FormConfig;
    const effectiveConfig: FormConfig = checkout ? { ...config, mode: "required", fields: (config.fields ?? []).some((f) => f.type === "email") ? (config.fields ?? []).map((f) => f.type === "email" ? { ...f, required: true } : f) : [...(config.mode === "none" ? [] : config.fields ?? []), { key: "email", label: "Email", type: "email", required: true, options: [] }] } : config;
    const coupon = await campaignCoupon(supabaseAdmin, p);
    return { title: p.title as string, body: (p.body as string | null) ?? "", buttonLabel: p.button_label as string | null, hasButton: checkout || !!p.button_url,
      imageUrl: p.show_image && p.image_path ? `/api/public/delivery-image/${p.image_path as string}` : null, imageAlt: p.image_alt as string | null,
      countdownAt: p.countdown_at as string | null, expiryAction: p.expiry_action as "disable_cta" | "hide_cta", expiryMessage: p.expiry_message as string | null,
      price: p.show_price || checkout ? { originalPaise: product?.original_price_paise ?? p.price_original_paise as number | null, offerPaise: amount, label: p.discount_label as string | null, couponCode: coupon.code ?? (p.coupon_code as string | null), couponNote: coupon.note ?? (p.coupon_note as string | null), charges: amount ? chargesFor(amount, (config as any).extras?.charges) : null } : null,
      formConfig: effectiveConfig, otpRequired: !!p.otp_required };
  });

/** Public: check a coupon on a delivery page and return the new price (discount taken off the MRP). */
export const checkPageCoupon = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ slug: z.string().regex(/^[a-z0-9-]{3,60}$/), code: z.string().trim().min(2).max(30) }).parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { resolvePageCoupon } = await import("@/lib/revenue.server");
    const { data: p } = await supabaseAdmin.from("delivery_pages").select("id, organization_id, form_config, product_id, price_offer_paise, price_original_paise, coupon_code, coupon_note")
      .eq("slug", data.slug).eq("active", true).maybeSingle();
    if (!p) return { ok: false as const, error: "Page not found" };
    const { data: product } = p.product_id ? await supabaseAdmin.from("revenue_products").select("price_paise, original_price_paise, active").eq("id", p.product_id).eq("organization_id", p.organization_id).maybeSingle() : { data: null };
    const amount = checkoutAmount(p.price_offer_paise, product, !!p.product_id);
    if (!amount) return { ok: false as const, error: "This page has no price to discount" };
    const c = await resolvePageCoupon(supabaseAdmin as never, p as never, data.code);
    if ("error" in c) return { ok: false as const, error: c.error };
    const mrp = (product?.original_price_paise as number | null | undefined) ?? (p.price_original_paise as number | null);
    const r = couponPrice(mrp, amount, c.discount);
    return { ok: true as const, code: c.code, label: c.label, basePaise: r.basePaise, discountPaise: r.discountPaise, pricePaise: r.pricePaise,
      charges: withCharges(r.pricePaise, (p.form_config as any)?.extras?.charges) };
  });

function chargesFor(amount: number, c: PageCharges | undefined) {
  const b = withCharges(amount, c);
  return b.totalPaise === amount ? null : b;
}

/** Store-code campaign linked to a page overrides the static coupon box. */
async function campaignCoupon(admin: any, p: { coupon_campaign_id?: string | null }): Promise<{ code: string | null; note: string | null }> {
  if (!p.coupon_campaign_id) return { code: null, note: null };
  const { data: c } = await admin.from("coupon_campaigns").select("kind, store_code, discount_label, expires_at, active").eq("id", p.coupon_campaign_id).maybeSingle();
  if (!c || !c.active || c.kind !== "store_code" || !c.store_code) return { code: null, note: null };
  if (c.expires_at && new Date(c.expires_at) < new Date()) return { code: null, note: null };
  return { code: c.store_code as string, note: c.discount_label as string };
}

/** Public buyer-bound offer. The token identifies only one stored payment link. */
export const getOfferPage = createServerFn({ method: "GET" })
  .inputValidator((d: unknown) => z.object({ token: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: link } = await supabaseAdmin.from("payment_links")
      .select("id, organization_id, delivery_pages!inner(id, title, body, button_label, active, image_path, show_image, image_alt, countdown_at, expiry_action, expiry_message, form_config, show_price, price_original_paise, price_offer_paise, discount_label, coupon_code, coupon_note, coupon_campaign_id, otp_required)")
      .eq("offer_token", data.token).maybeSingle();
    const p = Array.isArray(link?.delivery_pages) ? link?.delivery_pages[0] : link?.delivery_pages;
    if (!link || !p?.active) return null;
    await supabaseAdmin.from("revenue_events").insert({ organization_id: link.organization_id, kind: "page_view", ref_id: link.id });
    const coupon = await campaignCoupon(supabaseAdmin, p);
    return { title: p.title as string, body: (p.body as string | null) ?? "", buttonLabel: (p.button_label as string | null) || "Pay now",
      imageUrl: p.show_image && p.image_path ? `/api/public/delivery-image/${p.image_path as string}` : null, imageAlt: p.image_alt as string | null,
      countdownAt: p.countdown_at as string | null, expiryAction: p.expiry_action as "disable_cta" | "hide_cta", expiryMessage: p.expiry_message as string | null,
      price: p.show_price ? { originalPaise: p.price_original_paise as number | null, offerPaise: p.price_offer_paise as number | null, label: p.discount_label as string | null, couponCode: coupon.code ?? (p.coupon_code as string | null), couponNote: coupon.note ?? (p.coupon_note as string | null) } : null,
      formConfig: p.form_config as FormConfig, otpRequired: !!p.otp_required };
  });

export const submitOfferForm = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ token: z.string().uuid(), answers: z.record(z.string(), z.string().trim().max(500)) }).parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: link } = await supabaseAdmin.from("payment_links")
      .select("id, organization_id, platform, external_user_id, delivery_pages!inner(active, form_config, otp_required)").eq("offer_token", data.token).maybeSingle();
    const page = Array.isArray(link?.delivery_pages) ? link?.delivery_pages[0] : link?.delivery_pages;
    const config = page?.form_config as { mode?: string; consent?: string; fields?: Array<{ key: string; type: string; required: boolean; options: string[] }> } | null;
    if (!link || !page?.active || !config || config.mode === "none") throw new Error("Form is not available");
    const fields = config.fields ?? [];
    const clean: Record<string, string> = {};
    for (const field of fields) {
      const value = String(data.answers[field.key] ?? "").trim();
      const problem = validateLeadValue(field as LeadField, value);
      if (problem) throw new Error(problem);
      if (value) clean[field.key] = value;
    }
    await (await import("@/lib/email-check.server")).assertRealEmails(clean, fields);
    await assertOtpIfRequired(supabaseAdmin, link.organization_id as string, `offer:${data.token}`, !!page.otp_required, fields, clean);
    const key = { organization_id: link.organization_id, platform: link.platform, external_user_id: link.external_user_id };
    const { data: current } = await supabaseAdmin.from("contact_profiles").select("email, phone, custom_fields").match(key).maybeSingle();
    await supabaseAdmin.from("contact_profiles").upsert({ ...key,
      email: current?.email || (clean["email"] ?? null), phone: current?.phone || (clean["phone"] ?? null),
      custom_fields: { ...((current?.custom_fields as Record<string, unknown> | null) ?? {}), ...clean, delivery_form_consent: config.consent || "accepted", delivery_stage: "completed" },
      updated_at: new Date().toISOString(),
    }, { onConflict: "organization_id,platform,external_user_id" });
    await supabaseAdmin.from("revenue_events").insert({ organization_id: link.organization_id, platform: link.platform, external_user_id: link.external_user_id, kind: "form_complete", ref_id: link.id });
    return { ok: true };
  });

/** Public: lead form on a normal /p/ page. Stored per page; capped per hour to stop spam floods. */
export const submitPageForm = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ slug: z.string().regex(/^[a-z0-9-]{3,60}$/), answers: z.record(z.string(), z.string().trim().max(500)), website: z.string().max(0).optional() }).parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: page } = await supabaseAdmin.from("delivery_pages").select("id, organization_id, form_config, otp_required, product_id, price_offer_paise").eq("slug", data.slug).eq("active", true).maybeSingle();
    if (!page) throw new Error("Form is not available");
    const { data: product } = page.product_id ? await supabaseAdmin.from("revenue_products").select("price_paise, active").eq("id", page.product_id).eq("organization_id", page.organization_id).maybeSingle() : { data: null };
    const { data: cred } = await supabaseAdmin.from("payment_credentials").select("organization_id").eq("organization_id", page.organization_id).maybeSingle();
    const checkout = automaticCheckout(!!cred, checkoutAmount(page.price_offer_paise, product, !!page.product_id));
    const stored = (page.form_config ?? { mode: "none", fields: [] }) as FormConfig;
    const config: FormConfig = checkout ? { ...stored, mode: "required", fields: (stored.fields ?? []).some((f) => f.type === "email") ? (stored.fields ?? []).map((f) => f.type === "email" ? { ...f, required: true } : f) : [...(stored.mode === "none" ? [] : stored.fields ?? []), { key: "email", label: "Email", type: "email", required: true, options: [] }] } : stored;
    if (config.mode === "none") throw new Error("Form is not available");
    const { count } = await supabaseAdmin.from("delivery_page_leads").select("id", { count: "exact", head: true })
      .eq("delivery_page_id", page.id).gte("created_at", new Date(Date.now() - 3600_000).toISOString());
    if ((count ?? 0) >= 300) throw new Error("Too many submissions right now. Please try again later.");
    const clean: Record<string, string> = {};
    for (const field of config.fields ?? []) {
      const value = String(data.answers[field.key] ?? "").trim();
      const problem = validateLeadValue(field, value);
      if (problem) throw new Error(problem);
      if (value) clean[field.key] = value;
    }
    await (await import("@/lib/email-check.server")).assertRealEmails(clean, config.fields ?? []);
    await assertOtpIfRequired(supabaseAdmin, page.organization_id as string, `page:${data.slug}`, !!page.otp_required, config.fields ?? [], clean);
    const tagged: Record<string, string> = { ...clean };
    for (const f of config.fields ?? []) { if (f.type === "email" && clean[f.key]) tagged["email"] = clean[f.key]!.toLowerCase(); if (f.type === "phone" && clean[f.key]) tagged["phone"] = clean[f.key]!; }
    let leadId = await upsertPartialLead(supabaseAdmin, page.organization_id as string, page.id as string, tagged, "completed");
    if (!leadId) {
      const { data: row, error } = await supabaseAdmin.from("delivery_page_leads").insert({ organization_id: page.organization_id, delivery_page_id: page.id, answers: { ...tagged, _stage: "completed" } }).select("id").single();
      if (error || !row) throw new Error("Could not save details");
      leadId = row.id as string;
    }
    await supabaseAdmin.from("revenue_events").insert({ organization_id: page.organization_id, kind: "form_complete", ref_id: page.id });
    {
      const { getRequest } = await import("@tanstack/react-start/server");
      const origin = (process.env["PUBLIC_APP_URL"] || new URL(getRequest().url).origin).replace(/\/$/, "");
      const { sendLeadEmails } = await import("@/lib/buyer-emails.server");
      await sendLeadEmails(supabaseAdmin as never, { pageId: page.id as string, leadId, answers: tagged, origin, checkout });
    }
    // Checkout goes through our own link so the buyer comes back signed in after paying.
    return { ok: true, payUrl: `/api/public/pay/${data.slug}?lead=${leadId}` };
  });

/** When a page requires WhatsApp OTP, a verified code for the entered phone must exist. */
async function assertOtpIfRequired(admin: any, organizationId: string, pageRef: string, otpRequired: boolean, fields: Array<{ key: string; type: string }>, clean: Record<string, string>) {
  if (!otpRequired) return;
  const phoneField = fields.find((f) => f.type === "phone");
  const phone = phoneField ? clean[phoneField.key] : undefined;
  if (!phone) throw new Error("Please enter and verify your phone number");
  const { consumeVerifiedOtp } = await import("@/lib/whatsapp-otp.server");
  const ok = await consumeVerifiedOtp(admin, organizationId, pageRef, phone);
  if (!ok) throw new Error("Please verify your phone number with the WhatsApp code first");
}

/** Owner/admin: connect the workspace's own WhatsApp (Meta Cloud API) for OTP messages. Token is encrypted and never returned. */
export const saveWhatsappOtpSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({
    organizationId: org,
    phoneNumberId: z.string().trim().regex(/^\d{5,30}$/, "Phone number ID looks wrong"),
    accessToken: z.string().trim().min(20).max(500),
    templateName: z.string().trim().regex(/^[a-z0-9_]{1,60}$/, "Template name: lowercase letters, numbers, _ only"),
    templateLanguage: z.string().trim().regex(/^[a-z]{2}(_[A-Z]{2})?$/).default("en"),
  }).parse(d))
  .handler(async ({ data, context }) => {
    await assertPaymentAdmin(context as Ctx, data.organizationId);
    const { storeToken } = await import("@/lib/token-crypto.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("whatsapp_otp_settings").upsert({
      organization_id: data.organizationId, phone_number_id: data.phoneNumberId,
      access_token: (await storeToken(data.accessToken)) ?? data.accessToken,
      template_name: data.templateName, template_language: data.templateLanguage, updated_at: new Date().toISOString(),
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const removeWhatsappOtpSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ organizationId: org }).parse(d))
  .handler(async ({ data, context }) => {
    await assertPaymentAdmin(context as Ctx, data.organizationId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("whatsapp_otp_settings").delete().eq("organization_id", data.organizationId);
    return { ok: true };
  });

/** Public: send a WhatsApp OTP for a delivery page's phone field. Never returns the code. */
export const sendLeadOtp = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({
    slug: z.string().regex(/^[a-z0-9-]{3,60}$/).optional(), token: z.string().uuid().optional(),
    phone: z.string().trim().min(10).max(20),
  }).parse(d))
  .handler(async ({ data }) => {
    if (!data.slug && !data.token) throw new Error("Page is missing");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    let organizationId: string | null = null;
    let pageRef: string;
    if (data.slug) {
      const { data: p } = await supabaseAdmin.from("delivery_pages").select("organization_id").eq("slug", data.slug).eq("active", true).maybeSingle();
      organizationId = (p?.organization_id as string | undefined) ?? null;
      pageRef = `page:${data.slug}`;
    } else {
      const { data: l } = await supabaseAdmin.from("payment_links").select("organization_id").eq("offer_token", data.token!).maybeSingle();
      organizationId = (l?.organization_id as string | undefined) ?? null;
      pageRef = `offer:${data.token}`;
    }
    if (!organizationId) throw new Error("Page not found");
    const { issueLeadOtp } = await import("@/lib/whatsapp-otp.server");
    const result = await issueLeadOtp(supabaseAdmin, organizationId, pageRef, data.phone);
    if ("error" in result) throw new Error(result.error);
    return result;
  });

/** Public: check the 6-digit code. Returns only ok/error — never the phone or code. */
export const verifyLeadOtpCode = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ verificationId: z.string().uuid(), code: z.string().trim().regex(/^\d{6}$/, "Enter the 6-digit code") }).parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { verifyLeadOtp } = await import("@/lib/whatsapp-otp.server");
    const result = await verifyLeadOtp(supabaseAdmin, data.verificationId, data.code);
    if ("error" in result) throw new Error(result.error);
    return { ok: true };
  });

// ------------------------------------------------------------ drop-off capture

/** Saves or updates one partial lead per email/phone per page (24h window). Server-only helper. */
export async function upsertPartialLead(admin: any, organizationId: string, pageId: string, answers: Record<string, string>, stage: LeadStage) {
  const mail = (answers["email"] ?? "").toLowerCase();
  const phone = answers["phone"] ?? "";
  if (!mail && !phone) return null;
  const { data: rows } = await admin.from("delivery_page_leads").select("id, answers")
    .eq("delivery_page_id", pageId).gte("created_at", new Date(Date.now() - 86400_000).toISOString())
    .order("created_at", { ascending: false }).limit(100);
  const match = (rows ?? []).find((r: any) => {
    const a = (r.answers ?? {}) as Record<string, string>;
    if (!a["_stage"] || a["_stage"] === "completed") return false;
    return (mail && (a["email"] ?? "").toLowerCase() === mail) || (phone && a["phone"] === phone);
  });
  const now = new Date().toISOString();
  if (match) {
    const prev = match.answers as Record<string, string>;
    const merged = { ...prev, ...answers, _stage: nextLeadStage(prev["_stage"], stage), _updated_at: now };
    await admin.from("delivery_page_leads").update({ answers: merged }).eq("id", match.id);
    return match.id as string;
  }
  const { data: ins } = await admin.from("delivery_page_leads").insert({ organization_id: organizationId, delivery_page_id: pageId,
    answers: { ...answers, _stage: stage, _updated_at: now } }).select("id").maybeSingle();
  return (ins?.id as string | undefined) ?? null;
}

/** Keeps only valid email/phone values (by field type) so junk never lands in leads. */
function captureValues(fields: Array<{ key: string; type: string }>, answers: Record<string, string>) {
  const out: Record<string, string> = {};
  for (const f of fields) {
    const v = String(answers[f.key] ?? "").trim();
    if (!v) continue;
    if (validateLeadValue({ ...(f as LeadField), required: false }, v)) continue;
    out[f.key] = v;
    if (f.type === "email") out["email"] = v.toLowerCase();
    if (f.type === "phone") out["phone"] = v;
  }
  return out;
}

/** Public: silent capture while a visitor types (before submit) or after a WhatsApp code was sent. */
export const captureLeadProgress = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({
    slug: z.string().regex(/^[a-z0-9-]{3,60}$/).optional(), token: z.string().uuid().optional(),
    answers: z.record(z.string(), z.string().trim().max(500)),
    stage: z.enum(["intent_started", "otp_pending"]),
  }).parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    if (data.slug) {
      const { data: page } = await supabaseAdmin.from("delivery_pages").select("id, organization_id, form_config").eq("slug", data.slug).eq("active", true).maybeSingle();
      const config = page?.form_config as FormConfig | null;
      if (!page || !config || config.mode === "none") return { ok: false };
      const clean = captureValues(config.fields ?? [], data.answers);
      if (!clean["email"] && !clean["phone"]) return { ok: false };
      await upsertPartialLead(supabaseAdmin, page.organization_id as string, page.id as string, clean, data.stage);
      return { ok: true };
    }
    if (data.token) {
      const { data: link } = await supabaseAdmin.from("payment_links")
        .select("organization_id, platform, external_user_id, delivery_pages!inner(active, form_config)").eq("offer_token", data.token).maybeSingle();
      const page = Array.isArray(link?.delivery_pages) ? link?.delivery_pages[0] : link?.delivery_pages;
      const config = page?.form_config as FormConfig | null;
      if (!link || !page?.active || !config) return { ok: false };
      const clean = captureValues(config.fields ?? [], data.answers);
      if (!clean["email"] && !clean["phone"]) return { ok: false };
      const key = { organization_id: link.organization_id, platform: link.platform, external_user_id: link.external_user_id };
      const { data: current } = await supabaseAdmin.from("contact_profiles").select("email, phone, custom_fields").match(key).maybeSingle();
      const cf = (current?.custom_fields as Record<string, unknown> | null) ?? {};
      await supabaseAdmin.from("contact_profiles").upsert({ ...key,
        email: current?.email || (clean["email"] ?? null), phone: current?.phone || (clean["phone"] ?? null),
        custom_fields: { ...cf, ...clean, delivery_stage: nextLeadStage(cf["delivery_stage"] as string | undefined ?? "buyer_signin_attempt", data.stage) },
        updated_at: new Date().toISOString(),
      }, { onConflict: "organization_id,platform,external_user_id" });
      return { ok: true };
    }
    return { ok: false };
  });
