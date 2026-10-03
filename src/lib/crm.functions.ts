import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { normalizeTag, type SegmentFilter } from "@/lib/crm";

type Ctx = { supabase: any; userId: string };
const org = z.string().uuid();
const platform = z.enum(["instagram", "facebook", "youtube"]);

/** Tags, profiles and saved segments for a workspace (RLS: members only). */
export const getCrm = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ organizationId: org }).parse(d))
  .handler(async ({ data, context }) => {
    const sb = (context as Ctx).supabase;
    const [tags, profiles, segments] = await Promise.all([
      sb.from("contact_tags").select("id, platform, external_user_id, tag").eq("organization_id", data.organizationId).limit(5000),
      sb.from("contact_profiles").select("platform, external_user_id, email, phone, notes, custom_fields").eq("organization_id", data.organizationId).limit(5000),
      sb.from("contact_segments").select("id, name, filter").eq("organization_id", data.organizationId).order("created_at"),
    ]);
    return {
      tags: (tags.data ?? []) as Array<{ id: string; platform: string; external_user_id: string; tag: string }>,
      profiles: (profiles.data ?? []) as Array<{ platform: string; external_user_id: string; email: string | null; phone: string | null; notes: string | null; custom_fields: Record<string, string> }>,
      segments: (segments.data ?? []) as Array<{ id: string; name: string; filter: { tag?: string; platform?: "instagram" | "facebook" | "youtube"; hasEmail?: boolean; hasPhone?: boolean; search?: string } }>,
    };
  });

const contactRef = { organizationId: org, platform, externalUserId: z.string().min(1).max(100) };

export const saveContactProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      ...contactRef,
      email: z.string().trim().email().max(200).nullable(),
      phone: z.string().trim().regex(/^\+?[\d\s-]{6,20}$/).nullable(),
      notes: z.string().max(2000).nullable(),
      customFields: z.record(z.string().max(40), z.string().max(300)).refine((o) => Object.keys(o).length <= 20),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { error } = await (context as Ctx).supabase.from("contact_profiles").upsert(
      {
        organization_id: data.organizationId, platform: data.platform, external_user_id: data.externalUserId,
        email: data.email, phone: data.phone, notes: data.notes, custom_fields: data.customFields, updated_at: new Date().toISOString(),
      },
      { onConflict: "organization_id,platform,external_user_id" },
    );
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const addContactTag = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ ...contactRef, tag: z.string().min(1).max(60) }).parse(d))
  .handler(async ({ data, context }) => {
    const tag = normalizeTag(data.tag);
    if (!tag) throw new Error("invalid_tag");
    const sb = (context as Ctx).supabase;
    const { data: existing } = await sb.from("contact_tags").select("id").eq("organization_id", data.organizationId)
      .eq("platform", data.platform).eq("external_user_id", data.externalUserId).eq("tag", tag).maybeSingle();
    if (existing) return { ok: true };
    const { error } = await sb.from("contact_tags").insert({
      organization_id: data.organizationId, platform: data.platform, external_user_id: data.externalUserId, tag, source: "manual",
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const removeContactTag = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ organizationId: org, id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await (context as Ctx).supabase.from("contact_tags").delete().eq("id", data.id).eq("organization_id", data.organizationId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const saveSegment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      organizationId: org, name: z.string().trim().min(1).max(60),
      filter: z.object({ tag: z.string().max(40).optional(), platform: platform.optional(), hasEmail: z.boolean().optional(), hasPhone: z.boolean().optional(), search: z.string().max(80).optional() }),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { error } = await (context as Ctx).supabase.from("contact_segments").insert({ organization_id: data.organizationId, name: data.name, filter: data.filter });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteSegment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ organizationId: org, id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await (context as Ctx).supabase.from("contact_segments").delete().eq("id", data.id).eq("organization_id", data.organizationId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Outreach: nudge settings, webhook sync and broadcast history for a workspace. */
export const getOutreach = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ organizationId: org }).parse(d))
  .handler(async ({ data, context }) => {
    const sb = (context as Ctx).supabase;
    const [nudge, sync, broadcasts] = await Promise.all([
      sb.from("nudge_settings").select("enabled, delay_minutes, text").eq("organization_id", data.organizationId).maybeSingle(),
      sb.from("crm_sync_settings").select("webhook_url, enabled").eq("organization_id", data.organizationId).maybeSingle(),
      sb.from("broadcasts").select("id, name, message, filter, status, sent_count, created_at").eq("organization_id", data.organizationId).order("created_at", { ascending: false }).limit(20),
    ]);
    return {
      nudge: (nudge.data ?? null) as { enabled: boolean; delay_minutes: number; text: string } | null,
      sync: (sync.data ?? null) as { webhook_url: string | null; enabled: boolean } | null,
      broadcasts: (broadcasts.data ?? []) as Array<{ id: string; name: string; message: string; filter: SegmentFilter; status: string; sent_count: number; created_at: string }>,
    };
  });

export const saveNudgeSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      organizationId: org,
      enabled: z.boolean(),
      delayMinutes: z.number().int().min(15).max(1200),
      text: z.string().trim().min(1).max(500),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { error } = await (context as Ctx).supabase.from("nudge_settings").upsert({
      organization_id: data.organizationId, enabled: data.enabled, delay_minutes: data.delayMinutes, text: data.text,
      updated_at: new Date().toISOString(),
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const saveSyncSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      organizationId: org,
      enabled: z.boolean(),
      webhookUrl: z.string().trim().url().startsWith("https://").max(500).nullable().or(z.literal("")),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { error } = await (context as Ctx).supabase.from("crm_sync_settings").upsert({
      organization_id: data.organizationId, enabled: data.enabled, webhook_url: data.webhookUrl || null,
      updated_at: new Date().toISOString(),
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

const segmentFilter = z.object({
  tag: z.string().max(40).optional(), platform: platform.optional(),
  hasEmail: z.boolean().optional(), hasPhone: z.boolean().optional(), search: z.string().max(80).optional(),
});

/**
 * Send a broadcast to every matching contact whose last message is inside
 * Meta's 24h window. Membership is checked via RLS on the insert; the actual
 * sending uses the admin client and reuses the flow safety gate.
 */
export const sendBroadcast = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ organizationId: org, name: z.string().trim().min(1).max(80), message: z.string().trim().min(1).max(1000), filter: segmentFilter }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const sb = (context as Ctx).supabase;
    const { data: row, error } = await sb.from("broadcasts").insert({
      organization_id: data.organizationId, name: data.name, message: data.message, filter: data.filter, status: "sending",
    }).select("id").single();
    if (error) throw new Error(error.message);

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { sendDirectDm } = await import("@/lib/flows-runner.server");
    const since = new Date(Date.now() - 23 * 3600_000).toISOString();
    const [convos, tags, profiles] = await Promise.all([
      supabaseAdmin.from("conversations").select("id, platform, external_user_id, external_user_name, social_account_id")
        .eq("organization_id", data.organizationId).eq("channel", "dm").in("platform", ["instagram", "facebook"]).gte("last_message_at", since).limit(500),
      supabaseAdmin.from("contact_tags").select("platform, external_user_id, tag").eq("organization_id", data.organizationId).limit(5000),
      supabaseAdmin.from("contact_profiles").select("platform, external_user_id, email, phone").eq("organization_id", data.organizationId).limit(5000),
    ]);
    const f = data.filter;
    const term = f.search?.trim().toLowerCase();
    const targets = (convos.data ?? []).filter((c) => {
      if (f.platform && c.platform !== f.platform) return false;
      if (f.tag && !(tags.data ?? []).some((t) => t.platform === c.platform && t.external_user_id === c.external_user_id && t.tag === f.tag)) return false;
      const p = (profiles.data ?? []).find((x) => x.platform === c.platform && x.external_user_id === c.external_user_id);
      if (f.hasEmail && !p?.email) return false;
      if (f.hasPhone && !p?.phone) return false;
      if (term && !(c.external_user_name ?? "").toLowerCase().includes(term) && !(p?.email ?? "").toLowerCase().includes(term)) return false;
      return true;
    });

    let sent = 0;
    for (const c of targets.slice(0, 100)) {
      const ok = await sendDirectDm(supabaseAdmin, {
        organizationId: data.organizationId, conversationId: c.id, socialAccountId: c.social_account_id,
        platform: c.platform, externalUserId: c.external_user_id,
      }, data.message, null, `Broadcast:${data.name}`);
      if (ok) sent++;
    }
    await supabaseAdmin.from("broadcasts").update({ status: "done", sent_count: sent }).eq("id", row.id);
    return { ok: true, sent, matched: targets.length };
  });

export const deleteBroadcast = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ organizationId: org, id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await (context as Ctx).supabase.from("broadcasts").delete().eq("id", data.id).eq("organization_id", data.organizationId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
