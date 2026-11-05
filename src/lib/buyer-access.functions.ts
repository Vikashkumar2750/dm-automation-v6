import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

/**
 * Buyer sign-in on public delivery pages (email + 6-digit code, like creator
 * storefronts). Only emails that already submitted a form for this workspace
 * get a code; responses never reveal whether an email is known.
 */
const slug = z.string().regex(/^[a-z0-9-]{3,60}$/);
const email = z.string().trim().toLowerCase().email().max(200);

async function sha256(s: string) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, "0")).join("");
}

async function pageOrg(admin: any, s: string) {
  const { data } = await admin.from("delivery_pages").select("organization_id").eq("slug", s).eq("active", true).maybeSingle();
  return (data?.organization_id as string | undefined) ?? null;
}

async function hasLead(admin: any, orgId: string, mail: string) {
  const { data } = await admin.from("delivery_page_leads").select("answers").eq("organization_id", orgId).ilike("answers->>email", mail).limit(50);
  return (data ?? []).some((r: any) => !r.answers?._stage || r.answers["_stage"] === "completed");
}

export const requestBuyerCode = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ slug, email }).parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { emailProviderReady, sendPlainEmail } = await import("@/lib/support-email.server");
    if (!emailProviderReady()) throw new Error("Sign-in by email isn't available on this page yet.");
    const orgId = await pageOrg(supabaseAdmin, data.slug);
    if (!orgId) throw new Error("Page not found");
    const since = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const { count } = await supabaseAdmin.from("buyer_login_codes").select("id", { count: "exact", head: true })
      .eq("organization_id", orgId).eq("email", data.email).gte("created_at", since);
    if ((count ?? 0) >= 5) throw new Error("Too many codes requested. Try again in an hour.");
    if (!(await hasLead(supabaseAdmin, orgId, data.email))) {
      // Not a buyer yet: keep the email as a tagged sign-in lead, send nothing (no enumeration).
      const { data: page } = await supabaseAdmin.from("delivery_pages").select("id").eq("slug", data.slug).maybeSingle();
      if (page) await (await import("@/lib/revenue.functions")).upsertPartialLead(supabaseAdmin, orgId, page.id as string, { email: data.email }, "buyer_signin_attempt");
      return { ok: true };
    }
    const code = String(crypto.getRandomValues(new Uint32Array(1))[0]! % 1_000_000).padStart(6, "0");
    await supabaseAdmin.from("buyer_login_codes").insert({ organization_id: orgId, email: data.email, code_hash: await sha256(`${orgId}:${data.email}:${code}`), expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString() });
    await sendPlainEmail(data.email, `Your sign-in code: ${code}`, `Your code is ${code}\n\nIt works for 10 minutes. If you didn't ask for it, ignore this email.`);
    return { ok: true };
  });

export const verifyBuyerCode = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ slug, email, code: z.string().regex(/^\d{6}$/) }).parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const orgId = await pageOrg(supabaseAdmin, data.slug);
    if (!orgId) throw new Error("Page not found");
    const { data: row } = await supabaseAdmin.from("buyer_login_codes").select("id, code_hash, attempts, expires_at")
      .eq("organization_id", orgId).eq("email", data.email).order("created_at", { ascending: false }).limit(1).maybeSingle();
    if (!row || row.attempts >= 5 || new Date(row.expires_at).getTime() < Date.now()) throw new Error("Code expired. Request a new one.");
    if (row.code_hash !== (await sha256(`${orgId}:${data.email}:${data.code}`))) {
      await supabaseAdmin.from("buyer_login_codes").update({ attempts: row.attempts + 1 }).eq("id", row.id);
      throw new Error("Wrong code");
    }
    await supabaseAdmin.from("buyer_login_codes").delete().eq("organization_id", orgId).eq("email", data.email);
    const token = Array.from(crypto.getRandomValues(new Uint8Array(32)), (b) => b.toString(16).padStart(2, "0")).join("");
    await supabaseAdmin.from("buyer_sessions").insert({ token_hash: await sha256(token), organization_id: orgId, email: data.email, expires_at: new Date(Date.now() + 30 * 86400000).toISOString() });
    return { token };
  });

export const getBuyerLibrary = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ token: z.string().regex(/^[a-f0-9]{64}$/) }).parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: s } = await supabaseAdmin.from("buyer_sessions").select("organization_id, email, expires_at").eq("token_hash", await sha256(data.token)).maybeSingle();
    if (!s || new Date(s.expires_at).getTime() < Date.now()) return null;
    const { data: leads } = await supabaseAdmin.from("delivery_page_leads").select("created_at, answers, delivery_pages!inner(id, title, slug, active, button_url, image_path, show_image, product_id, price_offer_paise)")
      .eq("organization_id", s.organization_id).ilike("answers->>email", s.email).order("created_at", { ascending: false }).limit(50);
    const { data: paid } = await supabaseAdmin.from("payment_links").select("delivery_page_id, product_id").eq("organization_id", s.organization_id).eq("platform", "web").eq("external_user_id", s.email).eq("status", "paid");
    const seen = new Set<string>();
    const items = (leads ?? []).flatMap((l: any) => {
      const p = Array.isArray(l.delivery_pages) ? l.delivery_pages[0] : l.delivery_pages;
      if (l.answers?._stage && l.answers["_stage"] !== "completed") return [];
      if (!p?.active || seen.has(p.slug)) return [];
      if ((p.product_id || p.price_offer_paise >= 100) && !(paid ?? []).some((purchase) => purchase.delivery_page_id === p.id)) return [];
      seen.add(p.slug);
      return [{ title: p.title as string, slug: p.slug as string, at: l.created_at as string, hasFile: !!p.button_url || !!p.product_id,
        imageUrl: p.show_image && p.image_path ? `/api/public/delivery-image/${p.image_path}` : null }];
    });
    return { email: s.email as string, items };
  });

export const signOutBuyer = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ token: z.string().regex(/^[a-f0-9]{64}$/) }).parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("buyer_sessions").delete().eq("token_hash", await sha256(data.token));
    return { ok: true };
  });

/** Resolve private content only after a valid buyer session and a paid purchase. */
export const getBuyerContent = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ token: z.string().regex(/^[a-f0-9]{64}$/), slug }).parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin: admin } = await import("@/integrations/supabase/client.server");
    const { data: session } = await admin.from("buyer_sessions").select("organization_id, email, expires_at").eq("token_hash", await sha256(data.token)).maybeSingle();
    if (!session || new Date(session.expires_at).getTime() <= Date.now()) throw new Error("Please sign in again");
    const { data: page } = await admin.from("delivery_pages").select("id, product_id, button_url, price_offer_paise").eq("slug", data.slug).eq("organization_id", session.organization_id).eq("active", true).maybeSingle();
    if (!page) throw new Error("Content is unavailable");
    const { data: purchase } = await admin.from("payment_links").select("id").eq("organization_id", session.organization_id).eq("delivery_page_id", page.id).eq("platform", "web").eq("external_user_id", session.email).eq("status", "paid").limit(1).maybeSingle();
    if ((page.product_id || (page.price_offer_paise ?? 0) >= 100) && !purchase) throw new Error("Complete payment to access this product");
    const { data: product } = page.product_id ? await admin.from("revenue_products").select("delivery_url").eq("id", page.product_id).eq("organization_id", session.organization_id).maybeSingle() : { data: null };
    const target = page.button_url || product?.delivery_url;
    if (!target || !/^https:\/\//i.test(target)) throw new Error("The creator has not added content access yet");
    return { url: target };
  });
