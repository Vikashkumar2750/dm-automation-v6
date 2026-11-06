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
    const [tags, profiles, segments, leads, pages] = await Promise.all([
      sb.from("contact_tags").select("id, platform, external_user_id, tag").eq("organization_id", data.organizationId).limit(5000),
      sb.from("contact_profiles").select("platform, external_user_id, email, phone, notes, custom_fields").eq("organization_id", data.organizationId).limit(5000),
      sb.from("contact_segments").select("id, name, filter").eq("organization_id", data.organizationId).order("created_at"),
      sb.from("delivery_page_leads").select("id, delivery_page_id, answers, created_at").eq("organization_id", data.organizationId).order("created_at", { ascending: false }).limit(2000),
      sb.from("delivery_pages").select("id, title, slug").eq("organization_id", data.organizationId).limit(1000),
    ]);
    if (leads.error) console.error("getCrm leads", leads.error.message);
    const pageById = new Map(((pages.data ?? []) as Array<{ id: string; title: string; slug: string }>).map((p) => [p.id, p]));
    return {
      tags: (tags.data ?? []) as Array<{ id: string; platform: string; external_user_id: string; tag: string }>,
      profiles: (profiles.data ?? []) as Array<{ platform: string; external_user_id: string; email: string | null; phone: string | null; notes: string | null; custom_fields: Record<string, string> }>,
      pageLeads: ((leads.data ?? []) as Array<{ id: string; delivery_page_id: string; answers: Record<string, unknown> | null; created_at: string }>).map((l) => ({
        id: l.id,
        pageTitle: pageById.get(l.delivery_page_id)?.title ?? "Deleted page",
        pageSlug: pageById.get(l.delivery_page_id)?.slug ?? "",
        answers: Object.fromEntries(Object.entries(l.answers ?? {}).map(([k, v]) => [k, typeof v === "string" ? v : v == null ? "" : JSON.stringify(v)])),
        createdAt: l.created_at,
      })) as import("@/lib/crm").PageLead[],
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
    z.object({
      organizationId: org, name: z.string().trim().min(1).max(80), message: z.string().trim().min(1).max(1000), filter: segmentFilter,
      button: z.object({ title: z.string().trim().min(1).max(20), url: z.string().trim().max(500).regex(/^https:\/\/\S+$/i) }).nullable().optional(),
    }).parse(d),
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
      }, data.message, data.button ?? null, `Broadcast:${data.name}`);
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

/** AI drafts one stage-aware follow-up per selected delivery-page lead (member RLS read, drafts only — nothing is sent). */
export const draftLeadFollowUps = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({
    organizationId: org,
    leadIds: z.array(z.string().uuid()).min(1).max(20),
    channel: z.enum(["whatsapp", "email"]),
    tone: z.enum(["helpful", "offer", "short"]),
  }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as Ctx;
    const { data: rows, error } = await supabase.from("delivery_page_leads")
      .select("id, answers, delivery_page_id")
      .eq("organization_id", data.organizationId).in("id", data.leadIds);
    if (error) throw new Error(error.message);
    const { data: pg } = await supabase.from("delivery_pages").select("id, title, slug").eq("organization_id", data.organizationId);
    const pm = new Map(((pg ?? []) as any[]).map((p) => [p.id, p]));
    for (const r of (rows ?? []) as any[]) r.delivery_pages = pm.get(r.delivery_page_id) ?? null;
    type L = { id: string; name: string; email: string; phone: string; stage: string; page: string; slug: string };
    const leads: L[] = (rows ?? []).map((r: any) => {
      const a = (r.answers ?? {}) as Record<string, unknown>;
      return { id: r.id as string, name: String(a["name"] ?? ""), email: String(a["email"] ?? ""), phone: String(a["phone"] ?? ""),
        stage: String(a["_stage"] ?? "completed"), page: r.delivery_pages?.title ?? "our page", slug: r.delivery_pages?.slug ?? "" };
    });
    if (leads.length === 0) throw new Error("No leads found");
    const { runModel } = await import("@/lib/ai.functions");
    const schema = z.object({ drafts: z.array(z.object({ id: z.string(), subject: z.string().max(150).optional().default(""), message: z.string().max(1200) })) });
    const system = `You write short, warm, personal follow-up messages for a creator to send to people who visited their delivery page.
Match the lead's stage:
- intent_started: they started the form but did not submit — gently ask if something stopped them and invite them to finish.
- otp_pending: they did not finish WhatsApp code verification — offer help and say they can try again.
- buyer_signin_attempt: they tried to sign in to access purchases — offer help getting access.
- completed: they finished — thank them, give a quick tip, light next step.
Tone: ${data.tone === "offer" ? "mention a limited-time reason to act now, without inventing prices or discounts" : data.tone === "short" ? "very short, 1-2 sentences" : "helpful and supportive"}.
Channel: ${data.channel === "email" ? "email: include a subject line" : "WhatsApp chat: no subject, casual, at most one emoji"}.
Use the person's first name if known. Never invent facts. Write in the same language a creator in India would use in English. Return one draft per lead id.`;
    const prompt = JSON.stringify(leads.map(({ id, name, stage, page }) => ({ id, name, stage, page })));
    const out = await runModel(prompt, system, schema, userId, `{"drafts":[{"id":"lead id","subject":"email subject or empty","message":"text"}]}`);
    return {
      drafts: leads.map((l) => {
        const d = out.drafts.find((x) => x.id === l.id);
        return { id: l.id, name: l.name, email: l.email, phone: l.phone, stage: l.stage, page: l.page, subject: d?.subject ?? "", message: d?.message ?? "" };
      }),
    };
  });

/** Creator-tracked outreach status on a delivery-page lead (stored in answers as _followup_*; never sends anything). */
export const setLeadFollowUp = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({
    organizationId: org,
    leadIds: z.array(z.string().uuid()).min(1).max(200),
    status: z.enum(["not_contacted", "sent", "replied", "no_reply"]),
    channel: z.enum(["whatsapp", "email"]).optional(),
  }).parse(d))
  .handler(async ({ data, context }) => {
    // Membership check through RLS: only leads the caller can read are updated.
    const { data: rows, error } = await (context as Ctx).supabase.from("delivery_page_leads")
      .select("id, answers").eq("organization_id", data.organizationId).in("id", data.leadIds);
    if (error) throw new Error(error.message);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const now = new Date().toISOString();
    for (const r of (rows ?? []) as Array<{ id: string; answers: Record<string, unknown> | null }>) {
      const a = { ...(r.answers ?? {}) } as Record<string, unknown>;
      a["_followup_status"] = data.status;
      a["_followup_at"] = now;
      if (data.channel) a["_followup_channel"] = data.channel;
      if (data.status === "replied") a["_followup_replied_at"] = now;
      await supabaseAdmin.from("delivery_page_leads").update({ answers: a as never }).eq("id", r.id).eq("organization_id", data.organizationId);
    }
    return { ok: true, updated: rows?.length ?? 0 };
  });

/** Send one reviewed follow-up email to one lead (no bulk), then mark it "Follow-up sent". */
export const sendLeadFollowUpEmail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({
    organizationId: org, leadId: z.string().uuid(),
    subject: z.string().trim().min(1).max(150), message: z.string().trim().min(1).max(4000),
  }).parse(d))
  .handler(async ({ data, context }) => {
    // RLS: the caller must be able to read this lead in this workspace.
    const { data: lead } = await (context as Ctx).supabase.from("delivery_page_leads")
      .select("id, answers, delivery_page_id").eq("organization_id", data.organizationId).eq("id", data.leadId).maybeSingle();
    if (!lead) throw new Error("Lead not found");
    const answers = { ...((lead.answers ?? {}) as Record<string, unknown>) };
    const to = String(answers["email"] ?? "").toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) throw new Error("This lead has no email address");
    const f = await (await import("@/lib/workspace-features.server")).workspaceFeaturesFor(data.organizationId);
    if (f.emails !== "enabled") throw new Error("Emails are switched off for this workspace");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: page } = await supabaseAdmin.from("delivery_pages").select("form_config").eq("id", lead.delivery_page_id).maybeSingle();
    const extras = ((page?.form_config as any)?.extras ?? {}) as { creatorName?: string; supportEmail?: string };
    const { emailProviderReady, sendBrandedEmail } = await import("@/lib/support-email.server");
    if (!emailProviderReady()) throw new Error("Email sending is not set up yet. Ask your admin to add the email provider.");
    const r = await sendBrandedEmail(to, data.subject, {
      heading: data.subject, lines: data.message.split(/\n{2,}|\n/).map((l) => l.trim()).filter(Boolean),
      ...(extras.supportEmail ? { replyTo: extras.supportEmail } : {}),
    }, (extras.creatorName ?? "").trim() || "AutoDM");
    if (r.status !== "sent") throw new Error(r.error ?? "Email could not be sent");
    const now = new Date().toISOString();
    answers["_followup_status"] = "sent"; answers["_followup_at"] = now; answers["_followup_channel"] = "email";
    await supabaseAdmin.from("delivery_page_leads").update({ answers: answers as never }).eq("id", lead.id).eq("organization_id", data.organizationId);
    return { ok: true };
  });
