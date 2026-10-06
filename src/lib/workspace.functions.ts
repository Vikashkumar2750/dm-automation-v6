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
  "id, name, slug, plan, brand_name, logo_url, brand_color, support_email, timezone, parent_organization_id, plan_expires_at";

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
    return { ...org, my_role: role } as WorkspaceSettings;
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
      .select("plan, plan_expires_at")
      .eq("id", data.organizationId)
      .single();
    const agency =
      org?.plan === "agency" &&
      (!org.plan_expires_at || new Date(org.plan_expires_at).getTime() > Date.now());
    const update: Record<string, unknown> = { name: data.name, timezone: data.timezone };
    if (agency) {
      update["brand_name"] = data.brandName || null;
      update["logo_url"] = data.logoUrl || null;
      update["brand_color"] = data.brandColor || null;
      update["support_email"] = data.supportEmail || null;
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
      .select("id, name, brand_name, plan, logo_url, brand_color, parent_organization_id")
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

    return (orgs ?? []).map((o) => ({
      id: o.id,
      name: o.name,
      brand_name: o.brand_name,
      plan: o.plan,
      logo_url: o.logo_url,
      brand_color: o.brand_color,
      members: count(members, o.id),
      accounts: count(accounts, o.id),
      is_client: o.parent_organization_id === data.organizationId,
    }));
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
      .select("plan, plan_expires_at")
      .eq("id", data.parentOrganizationId)
      .maybeSingle();
    const plan = (parentOrg?.plan as string | undefined) ?? "starter";
    const expired =
      parentOrg?.plan_expires_at && new Date(parentOrg.plan_expires_at) < new Date();
    if (plan !== "agency" || expired) throw new Error("agency_only");

    const base = data.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    const slug = `${base || "client"}-${crypto.randomUUID().slice(0, 8)}`;

    const { data: org, error } = await context.supabase
      .from("organizations")
      .insert({
        name: data.name,
        slug,
        owner_id: context.userId,
        plan: "starter",
        parent_organization_id: data.parentOrganizationId,
      })
      .select("id")
      .single();
    if (error || !org) {
      console.error("[createClientWorkspace] org insert failed", error);
      throw new Error(error?.message ?? "create_failed");
    }

    const { error: memberError } = await context.supabase
      .from("organization_members")
      .insert({ organization_id: org.id, user_id: context.userId, role: "owner" });
    if (memberError) {
      console.error("[createClientWorkspace] member insert failed", memberError);
      throw new Error(memberError.message);
    }

    return { id: org.id };
  });
