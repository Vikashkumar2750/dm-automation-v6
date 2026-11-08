import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { WEBHOOK_EVENTS, type DeskRole } from "./team-desk";

const orgInput = z.object({ organizationId: z.string().uuid() });
type Ctx = { supabase: any; userId: string };

async function myRole(ctx: Ctx, organizationId: string): Promise<DeskRole | null> {
    const { data, error } = await ctx.supabase
    .from("organization_members")
    .select("role")
    .eq("organization_id", organizationId)
    .eq("user_id", ctx.userId)
    .maybeSingle();
  if (error) throw new Error("Team membership unavailable.");
  return (data?.role as DeskRole) ?? null;
}

async function requireReviewer(ctx: Ctx, organizationId: string) {
  const { data, error } = await ctx.supabase.rpc("current_user_has_org_role", {
    _org_id: organizationId,
    _roles: ["owner", "admin", "manager"],
  });
  if (error) throw new Error("Team permissions unavailable.");
  if (!data) throw new Error("Only owners, admins and managers can do this.");
}

async function requireDeskWriter(ctx: Ctx, organizationId: string) {
  const role = await myRole(ctx, organizationId);
  if (!role || role === "viewer") throw new Error("Team write access required.");
}

async function requireWorkspaceConversation(ctx: Ctx, organizationId: string, conversationId: string) {
  const { data, error } = await ctx.supabase.from("conversations").select("id")
    .eq("id", conversationId).eq("organization_id", organizationId).maybeSingle();
  if (error || !data) throw new Error("Conversation unavailable in this workspace.");
}

export const getTeamDesk = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => orgInput.extend({ socialAccountId: z.string().uuid().optional(), platform: z.enum(["instagram", "facebook", "youtube"]).optional() }).parse(d))
  .handler(async ({ data, context }) => {
    const sb = context.supabase;
    const role = await myRole(context, data.organizationId);
    if (!role) throw new Error("Workspace membership required.");
    const [convs, assigns, settings, approvals] = await Promise.all([
      sb.from("conversations")
        .select("id, platform, channel, status, external_user_name, external_user_id, last_message_at, last_message_preview, unread_count")
        .eq("organization_id", data.organizationId)
        .or(data.socialAccountId ? `social_account_id.eq.${data.socialAccountId}` : data.platform ? `platform.eq.${data.platform}` : "id.not.is.null")
        .order("last_message_at", { ascending: false })
        .limit(150),
      sb.from("conversation_assignments").select("conversation_id, assigned_to").eq("organization_id", data.organizationId),
      sb.from("team_settings").select("require_approval").eq("organization_id", data.organizationId).maybeSingle(),
      sb.from("reply_approvals")
        .select("id, conversation_id, body, status, requested_by, reviewed_by, reviewed_at, note, created_at")
        .eq("organization_id", data.organizationId)
        .order("created_at", { ascending: false })
        .limit(100),
    ]);
    if (convs.error) throw new Error(convs.error.message);
    if (assigns.error || settings.error || approvals.error) throw new Error("Team Desk data unavailable. Check the workspace setup and retry.");
    const assignment: Record<string, string | null> = {};
    for (const a of assigns.data ?? []) assignment[a.conversation_id] = a.assigned_to;
    return {
      role,
      me: context.userId,
      requireApproval: !!settings.data?.require_approval,
      conversations: (await import("@/lib/contact-name")).fillSiblingNames(convs.data ?? []),
      assignment,
      approvals: approvals.data ?? [],
    };
  });

export const assignConversation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ organizationId: z.string().uuid(), conversationId: z.string().uuid(), assignedTo: z.string().uuid().nullable() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await requireDeskWriter(context, data.organizationId);
    await requireWorkspaceConversation(context, data.organizationId, data.conversationId);
    if (data.assignedTo) {
      const { data: member, error: memberError } = await context.supabase.from("organization_members")
        .select("role").eq("organization_id", data.organizationId).eq("user_id", data.assignedTo).maybeSingle();
      if (memberError || !member) throw new Error("Assignee must belong to this workspace.");
    }
    const { error } = await context.supabase.from("conversation_assignments").upsert({
      conversation_id: data.conversationId,
      organization_id: data.organizationId,
      assigned_to: data.assignedTo,
      assigned_by: context.userId,
      updated_at: new Date().toISOString(),
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const saveTeamSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ organizationId: z.string().uuid(), requireApproval: z.boolean() }).parse(d))
  .handler(async ({ data, context }) => {
    await requireReviewer(context, data.organizationId);
    const { error } = await context.supabase.from("team_settings").upsert({
      organization_id: data.organizationId,
      require_approval: data.requireApproval,
      updated_at: new Date().toISOString(),
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const requestApproval = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ organizationId: z.string().uuid(), conversationId: z.string().uuid(), body: z.string().trim().min(1).max(1000) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await requireDeskWriter(context, data.organizationId);
    await requireWorkspaceConversation(context, data.organizationId, data.conversationId);
    const { error } = await context.supabase.from("reply_approvals").insert({
      organization_id: data.organizationId,
      conversation_id: data.conversationId,
      body: data.body,
      requested_by: context.userId,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const reviewApproval = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ organizationId: z.string().uuid(), id: z.string().uuid(), decision: z.enum(["approved", "rejected"]), note: z.string().trim().max(300).optional() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await requireReviewer(context, data.organizationId);
    const { error } = await context.supabase
      .from("reply_approvals")
      .update({ status: data.decision, reviewed_by: context.userId, reviewed_at: new Date().toISOString(), note: data.note ?? null })
      .eq("id", data.id)
      .eq("organization_id", data.organizationId)
      .eq("status", "pending");
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** One row per workspace the user belongs to (agency view of client workspaces). */
export const getClientReports = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ days: z.number().int().min(1).max(365).default(30) }).parse(d))
  .handler(async ({ data, context }) => {
    const sb = context.supabase;
    const since = new Date(Date.now() - data.days * 86400000).toISOString();
    const { data: members } = await sb.from("organization_members").select("organization_id, role").eq("user_id", context.userId);
    const ids = (members ?? []).map((m: { organization_id: string }) => m.organization_id);
    if (!ids.length) return [];
    const { data: orgs } = await sb
      .from("organizations")
      .select("id, name, plan, plan_expires_at, plan_source, parent_organization_id")
      .in("id", ids);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { resolveWorkspaceEntitlements } = await import("./workspace-entitlements.server");
    return Promise.all(
      (orgs ?? []).map(async (o: any) => {
        const count = async (q: any) => (await q).count ?? 0;
        const [inbound, outbound, runs, convs] = await Promise.all([
          count(sb.from("messages").select("id, conversations!inner(organization_id)", { count: "exact", head: true }).eq("conversations.organization_id", o.id).eq("direction", "inbound").gte("created_at", since)),
          count(sb.from("messages").select("id, conversations!inner(organization_id)", { count: "exact", head: true }).eq("conversations.organization_id", o.id).eq("direction", "outbound").gte("created_at", since)),
          count(sb.from("automation_runs").select("id", { count: "exact", head: true }).eq("organization_id", o.id).gte("created_at", since)),
          count(sb.from("conversations").select("id", { count: "exact", head: true }).eq("organization_id", o.id).gte("last_message_at", since)),
        ]);
        const entitlement = await resolveWorkspaceEntitlements(supabaseAdmin, o);
        return { id: o.id, name: o.name, plan: entitlement.plan, planExpiresAt: entitlement.plan_expires_at, isClient: !!o.parent_organization_id, inbound, outbound, runs, conversations: convs };
      }),
    );
  });

// ---------- Public API keys & outgoing webhooks (server-only tables) ----------

export const listIntegrations = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => orgInput.parse(d))
  .handler(async ({ data, context }) => {
    await requireReviewer(context, data.organizationId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const [keys, hooks] = await Promise.all([
      supabaseAdmin.from("api_keys").select("id, name, prefix, scopes, last_used_at, revoked_at, created_at").eq("organization_id", data.organizationId).order("created_at", { ascending: false }),
      supabaseAdmin.from("outgoing_webhooks").select("id, url, events, enabled, last_status, last_error, last_sent_at, created_at").eq("organization_id", data.organizationId).order("created_at", { ascending: false }),
    ]);
    if (keys.error || hooks.error) throw new Error("Team integrations unavailable. Check the workspace setup and retry.");
    return { keys: keys.data ?? [], hooks: hooks.data ?? [] };
  });

export const createApiKey = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ organizationId: z.string().uuid(), name: z.string().trim().min(1).max(60) }).parse(d))
  .handler(async ({ data, context }) => {
    await requireReviewer(context, data.organizationId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { generateApiKey, sha256Hex } = await import("./team-desk.server");
    const key = generateApiKey();
    const { error } = await supabaseAdmin.from("api_keys").insert({
      organization_id: data.organizationId,
      name: data.name,
      prefix: key.slice(0, 10),
      key_hash: await sha256Hex(key),
      created_by: context.userId,
    });
    if (error) throw new Error(error.message);
    return { key };
  });

export const revokeApiKey = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ organizationId: z.string().uuid(), id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await requireReviewer(context, data.organizationId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("api_keys").update({ revoked_at: new Date().toISOString() }).eq("id", data.id).eq("organization_id", data.organizationId);
    if (error) throw new Error("API key could not be revoked.");
    return { ok: true };
  });

export const createWebhook = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ organizationId: z.string().uuid(), url: z.string().trim().url().max(500), events: z.array(z.enum(WEBHOOK_EVENTS)).min(1) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await requireReviewer(context, data.organizationId);
    const { webhookDestination, resolveWebhookAddress } = await import("./webhook-destination.server");
    const destination = webhookDestination(data.url);
    await resolveWebhookAddress(destination.hostname.replace(/^\[|\]$/g, ""), AbortSignal.timeout(5000));
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { randomToken } = await import("./team-desk.server");
    const secret = "whsec_" + randomToken(32);
    const { error } = await supabaseAdmin.from("outgoing_webhooks").insert({ organization_id: data.organizationId, url: data.url, events: data.events, secret });
    if (error) throw new Error(error.message);
    return { secret };
  });

export const updateWebhook = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ organizationId: z.string().uuid(), id: z.string().uuid(), enabled: z.boolean().optional(), remove: z.boolean().optional() }).parse(d))
  .handler(async ({ data, context }) => {
    await requireReviewer(context, data.organizationId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const q = supabaseAdmin.from("outgoing_webhooks");
    const result = data.remove ? await q.delete().eq("id", data.id).eq("organization_id", data.organizationId)
      : await q.update({ enabled: !!data.enabled }).eq("id", data.id).eq("organization_id", data.organizationId);
    if (result.error) throw new Error("Webhook could not be updated.");
    return { ok: true };
  });

// ---------- Per-client billing (agency invoices for client workspaces) ----------

export const listClientInvoices = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => orgInput.parse(d))
  .handler(async ({ data, context }) => {
    await requireReviewer(context, data.organizationId);
    const { data: rows, error } = await context.supabase
      .from("client_invoices")
      .select("id, client_organization_id, period_label, amount_inr, status, payment_url, notes, paid_at, created_at")
      .eq("organization_id", data.organizationId)
      .order("created_at", { ascending: false })
      .limit(300);
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const createClientInvoice = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      organizationId: z.string().uuid(),
      clientOrganizationId: z.string().uuid(),
      periodLabel: z.string().trim().min(1).max(60),
      amountInr: z.number().positive().max(10_000_000),
      paymentUrl: z.string().trim().url().max(500).startsWith("https://").optional().or(z.literal("")),
      notes: z.string().trim().max(300).optional(),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await requireReviewer(context, data.organizationId);
    // The client must be a workspace this user also belongs to.
    const { data: member } = await context.supabase
      .from("organization_members").select("organization_id")
      .eq("organization_id", data.clientOrganizationId).eq("user_id", context.userId).maybeSingle();
    if (!member) throw new Error("You can only bill workspaces you belong to.");
    const { error } = await context.supabase.from("client_invoices").insert({
      organization_id: data.organizationId,
      client_organization_id: data.clientOrganizationId,
      period_label: data.periodLabel,
      amount_inr: data.amountInr,
      payment_url: data.paymentUrl || null,
      notes: data.notes || null,
      created_by: context.userId,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const setClientInvoiceStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ organizationId: z.string().uuid(), id: z.string().uuid(), status: z.enum(["unpaid", "paid", "void"]) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await requireReviewer(context, data.organizationId);
    const { error } = await context.supabase.from("client_invoices")
      .update({ status: data.status, paid_at: data.status === "paid" ? new Date().toISOString() : null })
      .eq("id", data.id).eq("organization_id", data.organizationId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
