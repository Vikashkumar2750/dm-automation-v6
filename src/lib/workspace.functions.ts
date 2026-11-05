import { createServerFn } from "@tanstack/react-start";
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";

import type { Database } from "@/integrations/supabase/types";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type WorkspaceSettings = {
  id: string;
  name: string;
  slug: string;
  plan: string;
  brand_name: string | null;
  logo_url: string | null;
  brand_color: string | null;
  support_email: string | null;
  timezone: string;
  parent_organization_id: string | null;
  plan_expires_at: string | null;
  my_role: string;
};

export type ClientWorkspace = {
  id: string;
  name: string;
  brand_name: string | null;
  plan: string;
  logo_url: string | null;
  brand_color: string | null;
  members: number;
  accounts: number;
  is_client: boolean;
};

const SELECT =
  "id, name, slug, plan, plan_source, brand_name, logo_url, brand_color, support_email, timezone, parent_organization_id, plan_expires_at";

type AuthedClient = SupabaseClient<Database>;

async function roleIn(supabase: AuthedClient, organizationId: string, userId: string) {
  const { data } = await supabase
    .from("organization_members")
    .select("role")
    .eq("organization_id", organizationId)
    .eq("user_id", userId)
    .maybeSingle();
  if (!data) throw new Error("not_a_member");
  return data.role;
}

export const getWorkspace = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ organizationId: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }): Promise<WorkspaceSettings> => {
    const role = await roleIn(context.supabase, data.organizationId, context.userId);
    const { data: org, error } = await context.supabase
      .from("organizations")
      .select(SELECT)
      .eq("id", data.organizationId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!org) throw new Error("not_found");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { resolveWorkspaceEntitlements } = await import("./workspace-entitlements.server");
    const entitlement = await resolveWorkspaceEntitlements(supabaseAdmin, org);
    return { ...org, ...entitlement, my_role: role } as WorkspaceSettings;
  });

const brandingInput = z.object({
  organizationId: z.string().uuid(),
  name: z.string().trim().min(2).max(80),
  brandName: z.string().trim().max(80).nullable(),
  logoUrl: z.string().trim().url().max(500).nullable(),
  brandColor: z
    .string()
    .trim()
    .regex(/^#[0-9a-fA-F]{6}$/, "Use a hex colour like #2563eb")
    .nullable(),
  supportEmail: z.string().trim().email().max(160).nullable(),
  timezone: z.string().trim().min(2).max(60),
});

export const updateWorkspace = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => brandingInput.parse(data))
  .handler(async ({ data, context }) => {
    const role = await roleIn(context.supabase, data.organizationId, context.userId);
    if (!["owner", "admin"].includes(role)) throw new Error("not_allowed");

    const { data: org } = await context.supabase
      .from("organizations")
      .select("plan, plan_expires_at, parent_organization_id, plan_source")
      .eq("id", data.organizationId)
      .single();
    if (!org) throw new Error("not_found");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { resolveWorkspaceEntitlements } = await import("./workspace-entitlements.server");
    const agency = (await resolveWorkspaceEntitlements(supabaseAdmin, org)).plan === "agency";
    const update: {
      name: string;
      timezone: string;
      brand_name?: string | null;
      logo_url?: string | null;
      brand_color?: string | null;
      support_email?: string | null;
    } = { name: data.name, timezone: data.timezone };
    if (agency) {
      update.brand_name = data.brandName || null;
      update.logo_url = data.logoUrl || null;
      update.brand_color = data.brandColor || null;
      update.support_email = data.supportEmail || null;
    }
    const { error } = await context.supabase
      .from("organizations")
      .update(update)
      .eq("id", data.organizationId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const listClientWorkspaces = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ organizationId: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }): Promise<ClientWorkspace[]> => {
    await roleIn(context.supabase, data.organizationId, context.userId);

    const { data: memberships } = await context.supabase
      .from("organization_members")
      .select("organization_id")
      .eq("user_id", context.userId);
    const ids = (memberships ?? []).map((m) => m.organization_id);
    if (ids.length === 0) return [];

    const { data: orgs } = await context.supabase
      .from("organizations")
      .select("id, name, brand_name, plan, plan_expires_at, plan_source, logo_url, brand_color, parent_organization_id")
      .in("id", ids)
      .order("created_at", { ascending: true });

    const { data: members } = await context.supabase
      .from("organization_members")
      .select("organization_id")
      .in("organization_id", ids);
    const { data: accounts } = await context.supabase
      .from("social_accounts")
      .select("organization_id")
      .in("organization_id", ids);

    const count = (rows: { organization_id: string }[] | null, id: string) =>
      (rows ?? []).filter((r) => r.organization_id === id).length;

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { resolveWorkspaceEntitlements } = await import("./workspace-entitlements.server");
    return Promise.all((orgs ?? []).map(async (o) => ({
      id: o.id,
      name: o.name,
      brand_name: o.brand_name,
      plan: (await resolveWorkspaceEntitlements(supabaseAdmin, o)).plan,
      logo_url: o.logo_url,
      brand_color: o.brand_color,
      members: count(members, o.id),
      accounts: count(accounts, o.id),
      is_client: o.parent_organization_id === data.organizationId,
    })));
  });

export const createClientWorkspace = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        parentOrganizationId: z.string().uuid(),
        name: z.string().trim().min(2).max(80),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const role = await roleIn(context.supabase, data.parentOrganizationId, context.userId);
    if (!["owner", "admin"].includes(role)) throw new Error("not_allowed");

    // Client workspaces are an Agency-plan feature — Free/Pro users cannot
    // spawn extra workspaces to bypass per-plan account limits.
    const { data: parentOrg } = await context.supabase
      .from("organizations")
      .select("plan, plan_expires_at, parent_organization_id")
      .eq("id", data.parentOrganizationId)
      .maybeSingle();
    const plan = (parentOrg?.plan as string | undefined) ?? "starter";
    const expired =
      parentOrg?.plan_expires_at && new Date(parentOrg.plan_expires_at) < new Date();
    if (plan !== "agency" || expired || parentOrg?.parent_organization_id) throw new Error("agency_only");

    const base = data.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    const slug = `${base || "client"}-${crypto.randomUUID().slice(0, 8)}`;

    // The main Agency owner owns every client workspace; anyone else who creates one joins as admin.
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: parentOwner } = await supabaseAdmin.from("organizations").select("owner_id")
      .eq("id", data.parentOrganizationId).maybeSingle();
    const mainOwnerId = (parentOwner?.owner_id as string | undefined) ?? context.userId;
    const { data: org, error } = await supabaseAdmin
      .from("organizations")
      .insert({
        name: data.name,
        slug,
        owner_id: mainOwnerId,
        plan: "agency",
        plan_source: "agency_parent",
        plan_expires_at: parentOrg?.plan_expires_at ?? null,
        parent_organization_id: data.parentOrganizationId,
      })
      .select("id")
      .single();
    if (error || !org) {
      console.error("[createClientWorkspace] org insert failed", error);
      throw new Error(error?.message ?? "create_failed");
    }

    const rows = [{ organization_id: org.id, user_id: mainOwnerId, role: "owner" }];
    if (mainOwnerId !== context.userId) rows.push({ organization_id: org.id, user_id: context.userId, role: "admin" });
    const { error: memberError } = await supabaseAdmin
      .from("organization_members")
      .insert(rows);
    if (memberError) {
      console.error("[createClientWorkspace] member insert failed", memberError);
      throw new Error(memberError.message);
    }

    return { id: org.id };
  });

/** Only the caller's member workspaces; parent reads expose entitlements, not parent data. */
export const getTenantOrganizations = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase.from("organization_members")
      .select("role, organizations(id, name, slug, plan, plan_expires_at, plan_source, parent_organization_id, created_at, brand_name, logo_url, brand_color)")
      .eq("user_id", context.userId);
    if (error) throw new Error(error.message);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { resolveWorkspaceEntitlements } = await import("./workspace-entitlements.server");
    return Promise.all((data ?? []).flatMap((row) => {
      const org = row.organizations;
      if (!org) return [];
      return [(async () => ({ ...org, ...(await resolveWorkspaceEntitlements(supabaseAdmin, org)), role: row.role }))()];
    }));
  });
