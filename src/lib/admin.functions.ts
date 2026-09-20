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
  };
  byPlan: { plan: string; count: number }[];
  organizations: AdminOrgRow[];
  recentWebhooks: {
    id: string;
    platform: string | null;
    event_type: string;
    status: string;
    signature_valid: boolean;
    received_at: string;
    error: string | null;
  }[];
};

async function isSuperAdmin(context: { supabase: any; userId: string }) {
  const { data, error } = await context.supabase.rpc("has_platform_role", {
    _user_id: context.userId,
    _role: "super_admin",
  });
  if (error) throw new Error(error.message);
  return Boolean(data);
}

export const getMyPlatformRole = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase.rpc("has_platform_role", {
      _user_id: context.userId,
      _role: "super_admin",
    });
    if (error) throw new Error(error.message);
    return { isSuperAdmin: Boolean(data) };
  });

export const getPlatformOverview = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<PlatformOverview | null> => {
    if (!(await isSuperAdmin(context))) return null;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

    const [orgs, members, accounts, convs, posts, profiles, runs, hooks, msgs] =
      await Promise.all([
        supabaseAdmin.from("organizations").select("id, name, slug, plan, created_at"),
        supabaseAdmin.from("organization_members").select("organization_id"),
        supabaseAdmin.from("social_accounts").select("organization_id, status"),
        supabaseAdmin.from("conversations").select("id, organization_id"),
        supabaseAdmin.from("posts").select("organization_id, status"),
        supabaseAdmin.from("profiles").select("id"),
        supabaseAdmin.from("automation_runs").select("id").gte("created_at", since),
        supabaseAdmin
          .from("webhook_events")
          .select("id, platform, event_type, status, signature_valid, received_at, error")
          .order("received_at", { ascending: false })
          .limit(25),
        supabaseAdmin.from("messages").select("id").gte("sent_at", since),
      ]);

    for (const r of [orgs, members, accounts, convs, posts, profiles, runs, hooks, msgs]) {
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
      }))
      .sort((a, b) => (a.created_at < b.created_at ? 1 : -1));

    const planMap = new Map<string, number>();
    for (const o of orgRows) planMap.set(o.plan, (planMap.get(o.plan) ?? 0) + 1);

    const recentWebhooks = (hooks.data ?? []).map((h) => ({
      id: h.id,
      platform: h.platform,
      event_type: h.event_type,
      status: h.status as string,
      signature_valid: h.signature_valid,
      received_at: h.received_at,
      error: h.error,
    }));

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
      },
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
    if (!(await isSuperAdmin(context))) throw new Error("forbidden");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("organizations")
      .update({ plan: data.plan })
      .eq("id", data.organizationId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
