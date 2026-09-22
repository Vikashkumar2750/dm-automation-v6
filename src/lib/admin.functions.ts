import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type AdminOrgRow = {
  id: string;
  name: string;
  slug: string;
  plan: string;
  created_at: string;
  members: number;
  accounts: number;
  conversations: number;
  posts: number;
  automationsPaused: boolean;
};

export type PlatformOverview = {
  totals: {
    organizations: number;
    users: number;
    accounts: number;
    conversations: number;
    messages24h: number;
    automationRuns24h: number;
    postsPublished: number;
    webhookFailures24h: number;
    queueDepth: number;
    failedJobs: number;
    tokenIssues: number;
    pausedOrgs: number;
  };
  globalSendPaused: boolean;
  incidentBanner: string | null;
  byPlan: { plan: string; count: number }[];
  organizations: AdminOrgRow[];
  recentWebhooks: WebhookRow[];
};

export type WebhookRow = {
  id: string;
  platform: string | null;
  event_type: string;
  status: string;
  signature_valid: boolean;
  received_at: string;
  error: string | null;
  organization_id: string | null;
};

export type AdminUserRow = {
  id: string;
  email: string | null;
  full_name: string | null;
  created_at: string;
  isSuperAdmin: boolean;
  workspaces: { id: string; name: string; role: string }[];
};

export type AdminAccountRow = {
  id: string;
  organization_id: string;
  organizationName: string;
  platform: string;
  name: string;
  handle: string | null;
  status: string;
  token_expires_at: string | null;
  last_synced_at: string | null;
};

export type AdminAutomationRow = {
  id: string;
  organization_id: string;
  organizationName: string;
  name: string;
  is_active: boolean;
  trigger: string;
  action: string;
  platform: string | null;
  runs24h: number;
};

export type AdminMessageRow = {
  id: string;
  direction: string;
  body: string;
  sender_name: string | null;
  sent_at: string;
  platform: string;
  organizationName: string;
};

export type AdminJobRow = {
  id: string;
  organizationName: string;
  platform: string;
  status: string;
  scheduled_at: string | null;
  published_at: string | null;
  error: string | null;
  caption: string;
};

export type AdminOrgDetail = {
  org: AdminOrgRow;
  settings: {
    is_paused: boolean;
    hourly_send_limit: number;
    daily_send_limit: number;
    auto_paused_until: string | null;
    auto_pause_reason: string | null;
  } | null;
  accounts: AdminAccountRow[];
  automations: AdminAutomationRow[];
  members: { user_id: string; role: string; email: string | null; full_name: string | null }[];
  recentErrors: { id: string; source: string; detail: string; at: string }[];
  usage: { runs24h: number; messages24h: number; postsScheduled: number };
};

export type PlatformSettings = {
  global_send_paused: boolean;
  incident_banner: string | null;
  feature_flags: Record<string, boolean>;
  updated_at: string;
};

export type AuditRow = {
  id: string;
  actor_email: string | null;
  action: string;
  target_type: string | null;
  target_id: string | null;
  detail: string;
  created_at: string;
};

type Ctx = { supabase: any; userId: string; claims?: any };

async function assertSuperAdmin(context: Ctx) {
  const { data, error } = await context.supabase.rpc("current_user_has_platform_role", {
    _role: "super_admin",
  });
  if (error) throw new Error(error.message);
  if (!data) throw new Error("forbidden");
  return true;
}

async function isSuperAdmin(context: Ctx) {
  const { data, error } = await context.supabase.rpc("current_user_has_platform_role", {
    _role: "super_admin",
  });
  if (error) throw new Error(error.message);
  return Boolean(data);
}

async function audit(
  context: Ctx,
  action: string,
  target: { type?: string; id?: string; detail?: Record<string, unknown> } = {},
) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  await supabaseAdmin.from("platform_audit_log").insert({
    actor_user_id: context.userId,
    actor_email: (context.claims?.email as string) ?? null,
    action,
    target_type: target.type ?? null,
    target_id: target.id ?? null,
    detail: (target.detail ?? {}) as never,
  });
}

export const getMyPlatformRole = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => ({ isSuperAdmin: await isSuperAdmin(context) }));

export const getPlatformOverview = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<PlatformOverview | null> => {
    if (!(await isSuperAdmin(context))) return null;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

    const [orgs, members, accounts, convs, posts, profiles, runs, hooks, msgs, settings, platform] =
      await Promise.all([
        supabaseAdmin.from("organizations").select("id, name, slug, plan, created_at"),
        supabaseAdmin.from("organization_members").select("organization_id"),
        supabaseAdmin.from("social_accounts").select("organization_id, status, token_expires_at"),
        supabaseAdmin.from("conversations").select("id, organization_id"),
        supabaseAdmin.from("posts").select("organization_id, status"),
        supabaseAdmin.from("profiles").select("id"),
        supabaseAdmin.from("automation_runs").select("id").gte("created_at", since),
        supabaseAdmin
          .from("webhook_events")
          .select(
            "id, platform, event_type, status, signature_valid, received_at, error, organization_id",
          )
          .order("received_at", { ascending: false })
          .limit(25),
        supabaseAdmin.from("messages").select("id").gte("sent_at", since),
        supabaseAdmin.from("automation_settings").select("organization_id, is_paused"),
        supabaseAdmin
          .from("platform_settings")
          .select("global_send_paused, incident_banner")
          .eq("id", true)
          .maybeSingle(),
      ]);

    for (const r of [orgs, members, accounts, convs, posts, profiles, runs, hooks, msgs, settings]) {
      if (r.error) throw new Error(r.error.message);
    }

    const count = <T extends { organization_id: string }>(rows: T[] | null) => {
      const map = new Map<string, number>();
      for (const row of rows ?? []) {
        map.set(row.organization_id, (map.get(row.organization_id) ?? 0) + 1);
      }
      return map;
    };

    const memberMap = count(members.data ?? []);
    const accountMap = count(accounts.data ?? []);
    const convMap = count(convs.data ?? []);
    const postMap = count(posts.data ?? []);
    const pausedSet = new Set(
      (settings.data ?? []).filter((s) => s.is_paused).map((s) => s.organization_id),
    );

    const orgRows: AdminOrgRow[] = (orgs.data ?? [])
      .map((o) => ({
        id: o.id,
        name: o.name,
        slug: o.slug,
        plan: o.plan,
        created_at: o.created_at,
        members: memberMap.get(o.id) ?? 0,
        accounts: accountMap.get(o.id) ?? 0,
        conversations: convMap.get(o.id) ?? 0,
        posts: postMap.get(o.id) ?? 0,
        automationsPaused: pausedSet.has(o.id),
      }))
      .sort((a, b) => (a.created_at < b.created_at ? 1 : -1));

    const planMap = new Map<string, number>();
    for (const o of orgRows) planMap.set(o.plan, (planMap.get(o.plan) ?? 0) + 1);

    const recentWebhooks = (hooks.data ?? []) as WebhookRow[];
    const soon = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

    return {
      totals: {
        organizations: orgRows.length,
        users: (profiles.data ?? []).length,
        accounts: (accounts.data ?? []).length,
        conversations: (convs.data ?? []).length,
        messages24h: (msgs.data ?? []).length,
        automationRuns24h: (runs.data ?? []).length,
        postsPublished: (posts.data ?? []).filter((p) => p.status === "published").length,
        webhookFailures24h: recentWebhooks.filter(
          (h) => h.status === "failed" && h.received_at >= since,
        ).length,
        queueDepth: (posts.data ?? []).filter((p) => p.status === "scheduled").length,
        failedJobs: (posts.data ?? []).filter((p) => p.status === "failed").length,
        tokenIssues: (accounts.data ?? []).filter(
          (a) =>
            a.status !== "connected" || (a.token_expires_at && a.token_expires_at < soon),
        ).length,
        pausedOrgs: pausedSet.size,
      },
      globalSendPaused: Boolean(platform.data?.global_send_paused),
      incidentBanner: platform.data?.incident_banner ?? null,
      byPlan: [...planMap.entries()]
        .map(([plan, c]) => ({ plan, count: c }))
        .sort((a, b) => b.count - a.count),
      organizations: orgRows,
      recentWebhooks,
    };
  });

export const setOrganizationPlan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        organizationId: z.string().uuid(),
        plan: z.enum(["starter", "pro", "agency"]),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    await assertSuperAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("organizations")
      .update({ plan: data.plan })
      .eq("id", data.organizationId);
    if (error) throw new Error(error.message);
    await audit(context, "organization.plan_changed", {
      type: "organization",
      id: data.organizationId,
      detail: { plan: data.plan },
    });
    return { ok: true };
  });

export const getAdminOrganization = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ organizationId: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }): Promise<AdminOrgDetail> => {
    await assertSuperAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const id = data.organizationId;
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

    const [org, settings, accounts, rules, members, runs, posts, hooks] = await Promise.all([
      supabaseAdmin
        .from("organizations")
        .select("id, name, slug, plan, created_at")
        .eq("id", id)
        .maybeSingle(),
      supabaseAdmin
        .from("automation_settings")
        .select("is_paused, hourly_send_limit, daily_send_limit, auto_paused_until, auto_pause_reason")
        .eq("organization_id", id)
        .maybeSingle(),
      supabaseAdmin
        .from("social_accounts")
        .select("id, organization_id, platform, name, handle, status, token_expires_at, last_synced_at")
        .eq("organization_id", id),
      supabaseAdmin
        .from("automation_rules")
        .select("id, organization_id, name, is_active, trigger, action, platform")
        .eq("organization_id", id),
      supabaseAdmin.from("organization_members").select("user_id, role").eq("organization_id", id),
      supabaseAdmin
        .from("automation_runs")
        .select("id, rule_id, status, detail, created_at")
        .eq("organization_id", id)
        .gte("created_at", since),
      supabaseAdmin.from("posts").select("id, status, error, updated_at").eq("organization_id", id),
      supabaseAdmin
        .from("webhook_events")
        .select("id, event_type, status, error, received_at")
        .eq("organization_id", id)
        .order("received_at", { ascending: false })
        .limit(10),
    ]);

    if (!org.data) throw new Error("not_found");

    const userIds = (members.data ?? []).map((m) => m.user_id);
    const profiles = userIds.length
      ? await supabaseAdmin.from("profiles").select("id, email, full_name").in("id", userIds)
      : { data: [] as { id: string; email: string | null; full_name: string | null }[] };
    const profileMap = new Map((profiles.data ?? []).map((p) => [p.id, p]));

    const convs = await supabaseAdmin.from("conversations").select("id").eq("organization_id", id);

    const runCountByRule = new Map<string, number>();
    for (const r of runs.data ?? []) {
      if (r.rule_id) runCountByRule.set(r.rule_id, (runCountByRule.get(r.rule_id) ?? 0) + 1);
    }

    const recentErrors = [
      ...(runs.data ?? [])
        .filter((r) => r.status === "failed")
        .map((r) => ({
          id: r.id,
          source: "automation",
          detail: r.detail ?? "failed",
          at: r.created_at,
        })),
      ...(posts.data ?? [])
        .filter((p) => p.status === "failed")
        .map((p) => ({
          id: p.id,
          source: "publishing",
          detail: p.error ?? "failed",
          at: p.updated_at,
        })),
      ...(hooks.data ?? [])
        .filter((h) => h.status === "failed")
        .map((h) => ({
          id: h.id,
          source: "webhook",
          detail: h.error ?? h.event_type,
          at: h.received_at,
        })),
    ]
      .sort((a, b) => (a.at < b.at ? 1 : -1))
      .slice(0, 15);

    return {
      org: {
        id: org.data.id,
        name: org.data.name,
        slug: org.data.slug,
        plan: org.data.plan,
        created_at: org.data.created_at,
        members: (members.data ?? []).length,
        accounts: (accounts.data ?? []).length,
        conversations: (convs.data ?? []).length,
        posts: (posts.data ?? []).length,
        automationsPaused: Boolean(settings.data?.is_paused),
      },
      settings: settings.data ?? null,
      accounts: (accounts.data ?? []).map((a) => ({
        ...a,
        organizationName: org.data!.name,
      })) as AdminAccountRow[],
      automations: (rules.data ?? []).map((r) => ({
        ...r,
        organizationName: org.data!.name,
        runs24h: runCountByRule.get(r.id) ?? 0,
      })) as AdminAutomationRow[],
      members: (members.data ?? []).map((m) => ({
        user_id: m.user_id,
        role: m.role,
        email: profileMap.get(m.user_id)?.email ?? null,
        full_name: profileMap.get(m.user_id)?.full_name ?? null,
      })),
      recentErrors,
      usage: {
        runs24h: (runs.data ?? []).length,
        messages24h: 0,
        postsScheduled: (posts.data ?? []).filter((p) => p.status === "scheduled").length,
      },
    };
  });

export const setOrganizationAutomationPause = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z.object({ organizationId: z.string().uuid(), paused: z.boolean() }).parse(data),
  )
  .handler(async ({ data, context }) => {
    await assertSuperAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("automation_settings")
      .upsert(
        { organization_id: data.organizationId, is_paused: data.paused },
        { onConflict: "organization_id" },
      );
    if (error) throw new Error(error.message);
    await audit(context, data.paused ? "organization.paused" : "organization.resumed", {
      type: "organization",
      id: data.organizationId,
    });
    return { ok: true };
  });

export const listAdminUsers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<AdminUserRow[]> => {
    await assertSuperAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const [profiles, members, orgs, roles] = await Promise.all([
      supabaseAdmin
        .from("profiles")
        .select("id, email, full_name, created_at")
        .order("created_at", { ascending: false }),
      supabaseAdmin.from("organization_members").select("user_id, organization_id, role"),
      supabaseAdmin.from("organizations").select("id, name"),
      supabaseAdmin.from("platform_roles").select("user_id, role"),
    ]);
    const orgName = new Map((orgs.data ?? []).map((o) => [o.id, o.name]));
    const superSet = new Set(
      (roles.data ?? []).filter((r) => r.role === "super_admin").map((r) => r.user_id),
    );
    return (profiles.data ?? []).map((p) => ({
      id: p.id,
      email: p.email,
      full_name: p.full_name,
      created_at: p.created_at,
      isSuperAdmin: superSet.has(p.id),
      workspaces: (members.data ?? [])
        .filter((m) => m.user_id === p.id)
        .map((m) => ({
          id: m.organization_id,
          name: orgName.get(m.organization_id) ?? "Unknown",
          role: m.role,
        })),
    }));
  });

export const setUserSuperAdmin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z.object({ userId: z.string().uuid(), grant: z.boolean() }).parse(data),
  )
  .handler(async ({ data, context }) => {
    await assertSuperAdmin(context);
    if (data.userId === context.userId && !data.grant) {
      throw new Error("You cannot remove your own platform access");
    }
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    if (data.grant) {
      const { error } = await supabaseAdmin
        .from("platform_roles")
        .upsert({ user_id: data.userId, role: "super_admin" }, { onConflict: "user_id,role" });
      if (error) throw new Error(error.message);
    } else {
      const { error } = await supabaseAdmin
        .from("platform_roles")
        .delete()
        .eq("user_id", data.userId)
        .eq("role", "super_admin");
      if (error) throw new Error(error.message);
    }
    await audit(context, data.grant ? "user.super_admin_granted" : "user.super_admin_revoked", {
      type: "user",
      id: data.userId,
    });
    return { ok: true };
  });

export const listAdminAccounts = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<AdminAccountRow[]> => {
    await assertSuperAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const [accounts, orgs] = await Promise.all([
      supabaseAdmin
        .from("social_accounts")
        .select(
          "id, organization_id, platform, name, handle, status, token_expires_at, last_synced_at",
        )
        .order("created_at", { ascending: false }),
      supabaseAdmin.from("organizations").select("id, name"),
    ]);
    const orgName = new Map((orgs.data ?? []).map((o) => [o.id, o.name]));
    return (accounts.data ?? []).map((a) => ({
      ...a,
      organizationName: orgName.get(a.organization_id) ?? "Unknown",
    })) as AdminAccountRow[];
  });

export const listAdminAutomations = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<AdminAutomationRow[]> => {
    await assertSuperAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const [rules, orgs, runs] = await Promise.all([
      supabaseAdmin
        .from("automation_rules")
        .select("id, organization_id, name, is_active, trigger, action, platform")
        .order("created_at", { ascending: false }),
      supabaseAdmin.from("organizations").select("id, name"),
      supabaseAdmin.from("automation_runs").select("rule_id").gte("created_at", since),
    ]);
    const orgName = new Map((orgs.data ?? []).map((o) => [o.id, o.name]));
    const runMap = new Map<string, number>();
    for (const r of runs.data ?? []) {
      if (r.rule_id) runMap.set(r.rule_id, (runMap.get(r.rule_id) ?? 0) + 1);
    }
    return (rules.data ?? []).map((r) => ({
      ...r,
      organizationName: orgName.get(r.organization_id) ?? "Unknown",
      runs24h: runMap.get(r.id) ?? 0,
    })) as AdminAutomationRow[];
  });

export const listAdminMessages = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<AdminMessageRow[]> => {
    await assertSuperAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const msgs = await supabaseAdmin
      .from("messages")
      .select("id, direction, body, sender_name, sent_at, conversation_id")
      .order("sent_at", { ascending: false })
      .limit(100);
    const convIds = [...new Set((msgs.data ?? []).map((m) => m.conversation_id))];
    const convs = convIds.length
      ? await supabaseAdmin
          .from("conversations")
          .select("id, platform, organization_id")
          .in("id", convIds)
      : { data: [] as { id: string; platform: string; organization_id: string }[] };
    const orgs = await supabaseAdmin.from("organizations").select("id, name");
    const orgName = new Map((orgs.data ?? []).map((o) => [o.id, o.name]));
    const convMap = new Map((convs.data ?? []).map((c) => [c.id, c]));
    return (msgs.data ?? []).map((m) => {
      const c = convMap.get(m.conversation_id);
      return {
        id: m.id,
        direction: m.direction,
        body: m.body,
        sender_name: m.sender_name,
        sent_at: m.sent_at,
        platform: c?.platform ?? "unknown",
        organizationName: c ? (orgName.get(c.organization_id) ?? "Unknown") : "Unknown",
      };
    });
  });

export const listAdminJobs = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<AdminJobRow[]> => {
    await assertSuperAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const [posts, orgs] = await Promise.all([
      supabaseAdmin
        .from("posts")
        .select("id, organization_id, platform, status, scheduled_at, published_at, error, caption")
        .in("status", ["scheduled", "publishing", "failed"])
        .order("scheduled_at", { ascending: true })
        .limit(100),
      supabaseAdmin.from("organizations").select("id, name"),
    ]);
    const orgName = new Map((orgs.data ?? []).map((o) => [o.id, o.name]));
    return (posts.data ?? []).map((p) => ({
      id: p.id,
      organizationName: orgName.get(p.organization_id) ?? "Unknown",
      platform: p.platform,
      status: p.status,
      scheduled_at: p.scheduled_at,
      published_at: p.published_at,
      error: p.error,
      caption: p.caption,
    }));
  });

export const requeueAdminJob = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ postId: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    await assertSuperAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("posts")
      .update({ status: "scheduled", error: null })
      .eq("id", data.postId);
    if (error) throw new Error(error.message);
    await audit(context, "job.requeued", { type: "post", id: data.postId });
    return { ok: true };
  });

export const listAdminWebhooks = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<WebhookRow[]> => {
    await assertSuperAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin
      .from("webhook_events")
      .select(
        "id, platform, event_type, status, signature_valid, received_at, error, organization_id",
      )
      .order("received_at", { ascending: false })
      .limit(100);
    if (error) throw new Error(error.message);
    return (data ?? []) as WebhookRow[];
  });

export const getPlatformSettings = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<PlatformSettings> => {
    await assertSuperAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin
      .from("platform_settings")
      .select("global_send_paused, incident_banner, feature_flags, updated_at")
      .eq("id", true)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return {
      global_send_paused: Boolean(data?.global_send_paused),
      incident_banner: data?.incident_banner ?? null,
      feature_flags: (data?.feature_flags as Record<string, boolean>) ?? {},
      updated_at: data?.updated_at ?? new Date().toISOString(),
    };
  });

export const updatePlatformSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        globalSendPaused: z.boolean().optional(),
        incidentBanner: z.string().max(300).nullable().optional(),
        featureFlags: z.record(z.string(), z.boolean()).optional(),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    await assertSuperAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const patch: Record<string, unknown> = { id: true, updated_at: new Date().toISOString() };
    if (data.globalSendPaused !== undefined) patch["global_send_paused"] = data.globalSendPaused;
    if (data.incidentBanner !== undefined)
      patch["incident_banner"] = data.incidentBanner?.trim() ? data.incidentBanner.trim() : null;
    if (data.featureFlags !== undefined) patch["feature_flags"] = data.featureFlags;
    const { error } = await supabaseAdmin
      .from("platform_settings")
      .upsert(patch as never, { onConflict: "id" });
    if (error) throw new Error(error.message);
    await audit(context, "platform.settings_updated", { type: "platform", detail: data });
    return { ok: true };
  });

export const listAuditLog = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<AuditRow[]> => {
    await assertSuperAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin
      .from("platform_audit_log")
      .select("id, actor_email, action, target_type, target_id, detail, created_at")
      .order("created_at", { ascending: false })
      .limit(100);
    if (error) throw new Error(error.message);
    return (data ?? []).map((r) => ({
      id: r.id,
      actor_email: r.actor_email,
      action: r.action,
      target_type: r.target_type,
      target_id: r.target_id,
      detail: r.detail ? JSON.stringify(r.detail) : "",
      created_at: r.created_at,
    }));
  });

export const grantOrganizationPlan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        organizationId: z.string().uuid(),
        plan: z.enum(["starter", "pro", "agency"]),
        months: z.number().int().min(0).max(120),
        note: z.string().max(200).optional(),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    await assertSuperAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    let expires: string | null = null;
    if (data.months > 0) {
      const d = new Date();
      d.setMonth(d.getMonth() + data.months);
      expires = d.toISOString();
    }

    const { error } = await supabaseAdmin
      .from("organizations")
      .update({ plan: data.plan, plan_expires_at: expires, plan_source: "granted" })
      .eq("id", data.organizationId);
    if (error) throw new Error(error.message);

    await supabaseAdmin.from("plan_orders").insert({
      organization_id: data.organizationId,
      created_by: context.userId,
      plan: data.plan,
      billing_cycle: data.months > 0 ? `granted_${data.months}m` : "granted_lifetime",
      amount_paise: 0,
      provider: "manual",
      mode: "grant",
      status: "paid",
      paid_at: new Date().toISOString(),
      error: data.note ?? null,
    });

    await audit(context, "organization.plan_granted", {
      type: "organization",
      id: data.organizationId,
      detail: { plan: data.plan, months: data.months, note: data.note ?? null },
    });
    return { ok: true, plan: data.plan, planExpiresAt: expires };
  });

export const listPlanOrders = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertSuperAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin
      .from("plan_orders")
      .select("id, organization_id, plan, billing_cycle, amount_paise, status, mode, created_at, paid_at")
      .order("created_at", { ascending: false })
      .limit(50);
    if (error) throw new Error(error.message);
    return data ?? [];
  });

// ---------------------------------------------------------------- alerts

export type AlertItem = {
  id: string;
  severity: "critical" | "warning" | "info";
  category: "automation" | "delivery" | "account" | "publishing" | "safety";
  title: string;
  detail: string | null;
  hint: string;
  organizationName: string;
  at: string;
};

export type AlertsFeed = {
  generatedAt: string;
  counts: { critical: number; warning: number; info: number; total: number };
  topReasons: { reason: string; count: number }[];
  items: AlertItem[];
};

/** Human wording for the raw reason codes the automation engine records. */
function explainReason(detail: string | null): { title: string; hint: string } {
  const code = (detail ?? "").toLowerCase();
  const map: [string, string, string][] = [
    ["no_token", "Account credentials missing", "Reconnect the social account from Social Accounts."],
    ["window_expired", "24-hour reply window closed", "Meta blocks DMs after 24h of silence — nothing to fix."],
    ["no_comment_id", "Comment reference missing", "The comment was deleted before the reply was sent."],
    ["no_account", "No social account linked", "Connect an account for this workspace."],
    ["comment_reply", "Public comment reply rejected", "Usually a permission or deleted-comment issue."],
    ["follow_prompt", "Follow request message rejected", "Instagram refused the prompt format or the 24h window closed."],
    ["attachment", "Attachment could not be delivered", "Check the attachment URL is public and the right type."],
    ["not_a_follower", "Skipped: contact does not follow", "Rule is set to followers only."],
    ["already_a_follower", "Skipped: contact already follows", "Rule targets non-followers only."],
    ["paused", "Skipped: automation paused", "Automation is paused for this workspace."],
    ["quiet_hours", "Skipped: quiet hours", "Outside the workspace's sending hours."],
    ["daily_limit", "Skipped: daily limit reached", "Raise the rule's daily cap if this is unexpected."],
    ["cooldown", "Skipped: cooldown active", "The same contact was messaged very recently."],
    ["opt_out", "Skipped: contact opted out", "Contact asked to stop receiving messages."],
    ["blocked_keyword", "Skipped: blocked word", "Message matched a blocked keyword."],
    ["no_response_text", "Rule has no message written", "Open the rule and add the reply text."],
    ["unknown_action", "Rule action not supported", "Edit the rule and pick a valid action."],
  ];
  for (const [key, title, hint] of map) {
    if (code.startsWith(key) || code.includes(key)) return { title, hint };
  }
  return { title: "Automation could not complete", hint: "Open the rule's recent activity for details." };
}

export const listAutomationAlerts = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<AlertsFeed> => {
    await assertSuperAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const soon = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

    const [orgs, runs, hooks, accounts, posts, settings, gates, rules] = await Promise.all([
      supabaseAdmin.from("organizations").select("id, name"),
      supabaseAdmin
        .from("automation_runs")
        .select("id, organization_id, rule_id, status, detail, created_at")
        .in("status", ["failed", "skipped"])
        .gte("created_at", since)
        .order("created_at", { ascending: false })
        .limit(200),
      supabaseAdmin
        .from("webhook_events")
        .select("id, organization_id, platform, event_type, status, signature_valid, error, received_at")
        .gte("received_at", since)
        .order("received_at", { ascending: false })
        .limit(200),
      supabaseAdmin
        .from("social_accounts")
        .select("id, organization_id, platform, name, status, token_expires_at, updated_at"),
      supabaseAdmin
        .from("posts")
        .select("id, organization_id, platform, caption, error, updated_at")
        .eq("status", "failed")
        .order("updated_at", { ascending: false })
        .limit(50),
      supabaseAdmin
        .from("automation_settings")
        .select("organization_id, is_paused, auto_paused_until, auto_pause_reason, updated_at"),
      supabaseAdmin
        .from("automation_follow_gates")
        .select("id, organization_id, status, created_at, platform")
        .eq("status", "expired")
        .gte("created_at", since)
        .limit(50),
      supabaseAdmin.from("automation_rules").select("id, name"),
    ]);

    const orgName = new Map((orgs.data ?? []).map((o) => [o.id, o.name]));
    const ruleName = new Map((rules.data ?? []).map((r) => [r.id, r.name]));
    const name = (id: string | null) => (id ? (orgName.get(id) ?? "Unknown workspace") : "Platform");
    const items: AlertItem[] = [];
    const reasonCount = new Map<string, number>();

    for (const r of runs.data ?? []) {
      const { title, hint } = explainReason(r.detail);
      const failed = r.status === "failed";
      reasonCount.set(title, (reasonCount.get(title) ?? 0) + 1);
      items.push({
        id: `run-${r.id}`,
        severity: failed ? "critical" : "info",
        category: "automation",
        title: `${title}${r.rule_id ? ` — ${ruleName.get(r.rule_id) ?? "rule"}` : ""}`,
        detail: r.detail,
        hint,
        organizationName: name(r.organization_id),
        at: r.created_at,
      });
    }

    for (const h of hooks.data ?? []) {
      if (h.status !== "failed" && h.signature_valid !== false) continue;
      const bad = h.signature_valid === false;
      const title = bad ? "Event rejected: signature invalid" : "Incoming event could not be processed";
      reasonCount.set(title, (reasonCount.get(title) ?? 0) + 1);
      items.push({
        id: `hook-${h.id}`,
        severity: "critical",
        category: "delivery",
        title: `${title} (${h.event_type})`,
        detail: h.error,
        hint: bad
          ? "The app secret in Meta does not match the one configured here."
          : "Open Webhooks to inspect the raw event payload.",
        organizationName: name(h.organization_id),
        at: h.received_at,
      });
    }

    for (const a of accounts.data ?? []) {
      const expiring = a.token_expires_at && a.token_expires_at < soon;
      if (a.status === "connected" && !expiring) continue;
      const disconnected = a.status !== "connected";
      items.push({
        id: `acct-${a.id}`,
        severity: disconnected ? "critical" : "warning",
        category: "account",
        title: disconnected
          ? `${a.name} is ${a.status} — automations will not run`
          : `${a.name} access expires soon`,
        detail: a.token_expires_at ? `Expires ${new Date(a.token_expires_at).toLocaleString()}` : null,
        hint: "Ask the workspace to reconnect the account from Social Accounts.",
        organizationName: name(a.organization_id),
        at: a.updated_at,
      });
    }

    for (const p of posts.data ?? []) {
      items.push({
        id: `post-${p.id}`,
        severity: "warning",
        category: "publishing",
        title: `Scheduled post failed (${p.platform})`,
        detail: p.error ?? p.caption?.slice(0, 120) ?? null,
        hint: "Retry it from Jobs & Queue once the cause is fixed.",
        organizationName: name(p.organization_id),
        at: p.updated_at,
      });
    }

    for (const s of settings.data ?? []) {
      const autoPaused = s.auto_paused_until && s.auto_paused_until > new Date().toISOString();
      if (!s.is_paused && !autoPaused) continue;
      items.push({
        id: `pause-${s.organization_id}`,
        severity: autoPaused ? "critical" : "warning",
        category: "safety",
        title: autoPaused ? "Sending auto-paused by safety guard" : "Automations paused manually",
        detail: s.auto_pause_reason ?? null,
        hint: autoPaused
          ? "A sudden spike in activity triggered the guard; it resumes automatically."
          : "Someone in the workspace turned automations off.",
        organizationName: name(s.organization_id),
        at: s.updated_at,
      });
    }

    for (const g of gates.data ?? []) {
      items.push({
        id: `gate-${g.id}`,
        severity: "info",
        category: "automation",
        title: "Contact never completed the follow step",
        detail: `${g.platform} · follow request expired`,
        hint: "Expected for some contacts; frequent cases mean the prompt is unclear.",
        organizationName: name(g.organization_id),
        at: g.created_at,
      });
    }

    items.sort((a, b) => (a.at < b.at ? 1 : -1));
    const counts = {
      critical: items.filter((i) => i.severity === "critical").length,
      warning: items.filter((i) => i.severity === "warning").length,
      info: items.filter((i) => i.severity === "info").length,
      total: items.length,
    };
    const topReasons = [...reasonCount.entries()]
      .map(([reason, count]) => ({ reason, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    return { generatedAt: new Date().toISOString(), counts, topReasons, items: items.slice(0, 200) };
  });
