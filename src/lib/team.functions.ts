import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type OrgRole = "owner" | "admin" | "manager" | "agent" | "viewer";

export type TeamMember = {
  id: string;
  user_id: string;
  role: OrgRole;
  created_at: string;
  name: string;
  email: string;
  avatar_url: string | null;
  is_self: boolean;
};

export type TeamInvite = {
  id: string;
  email: string;
  role: OrgRole;
  token: string;
  expires_at: string;
  created_at: string;
  accepted_at: string | null;
};

const roles = ["owner", "admin", "manager", "agent", "viewer"] as const;
const orgInput = z.object({ organizationId: z.string().uuid() });

type AuthedClient = SupabaseClient<Database>;

async function requireManager(
  supabase: AuthedClient,
  organizationId: string,
  userId: string,
) {
  const { data } = await supabase
    .from("organization_members")
    .select("role")
    .eq("organization_id", organizationId)
    .eq("user_id", userId)
    .maybeSingle();
  if (!data || !["owner", "admin"].includes(data.role)) throw new Error("not_allowed");
}

export const listTeam = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => orgInput.parse(data))
  .handler(async ({ data, context }): Promise<TeamMember[]> => {
    const { data: members, error } = await context.supabase
      .from("organization_members")
      .select("id, user_id, role, created_at")
      .eq("organization_id", data.organizationId)
      .order("created_at", { ascending: true });
    if (error) throw new Error(error.message);

    const ids = (members ?? []).map((m) => m.user_id);
    const { data: profiles } = ids.length
      ? await context.supabase
          .from("profiles")
          .select("id, full_name, email, avatar_url")
          .in("id", ids)
      : { data: [] as never[] };

    const byId = new Map((profiles ?? []).map((p) => [p.id, p]));

    return (members ?? []).map((m) => {
      const p = byId.get(m.user_id);
      return {
        id: m.id,
        user_id: m.user_id,
        role: m.role as OrgRole,
        created_at: m.created_at,
        name: p?.full_name ?? "Teammate",
        email: p?.email ?? "",
        avatar_url: p?.avatar_url ?? null,
        is_self: m.user_id === context.userId,
      };
    });
  });

export const listInvites = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => orgInput.parse(data))
  .handler(async ({ data, context }): Promise<TeamInvite[]> => {
    const { data: rows, error } = await context.supabase
      .from("organization_invitations")
      .select("id, email, role, token, expires_at, created_at, accepted_at")
      .eq("organization_id", data.organizationId)
      .is("accepted_at", null)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return (rows ?? []) as TeamInvite[];
  });

export const inviteTeammate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        organizationId: z.string().uuid(),
        email: z.string().trim().email().max(160),
        role: z.enum(roles),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    await requireManager(context.supabase, data.organizationId, context.userId);
    if (data.role === "owner") return { error: "owner_not_invitable" as const };

    const email = data.email.toLowerCase();
    const token =
      crypto.randomUUID().replace(/-/g, "") + crypto.randomUUID().replace(/-/g, "");

    const { data: row, error } = await context.supabase
      .from("organization_invitations")
      .insert({
        organization_id: data.organizationId,
        email,
        role: data.role,
        token,
        invited_by: context.userId,
      })
      .select("id, email, role, token, expires_at, created_at, accepted_at")
      .single();

    if (error) {
      if (error.code === "23505") return { error: "already_invited" as const };
      throw new Error(error.message);
    }
    return { invite: row as TeamInvite };
  });

export const revokeInvite = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z.object({ organizationId: z.string().uuid(), id: z.string().uuid() }).parse(data),
  )
  .handler(async ({ data, context }) => {
    await requireManager(context.supabase, data.organizationId, context.userId);
    const { error } = await context.supabase
      .from("organization_invitations")
      .delete()
      .eq("id", data.id)
      .eq("organization_id", data.organizationId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const changeMemberRole = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        organizationId: z.string().uuid(),
        memberId: z.string().uuid(),
        role: z.enum(roles),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    await requireManager(context.supabase, data.organizationId, context.userId);
    if (data.role === "owner") return { error: "owner_locked" as const };

    const { data: target } = await context.supabase
      .from("organization_members")
      .select("user_id, role")
      .eq("id", data.memberId)
      .eq("organization_id", data.organizationId)
      .maybeSingle();
    if (!target) return { error: "not_found" as const };
    if (target.role === "owner") return { error: "owner_locked" as const };

    const { error } = await context.supabase
      .from("organization_members")
      .update({ role: data.role })
      .eq("id", data.memberId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const removeMember = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z.object({ organizationId: z.string().uuid(), memberId: z.string().uuid() }).parse(data),
  )
  .handler(async ({ data, context }) => {
    await requireManager(context.supabase, data.organizationId, context.userId);

    const { data: target } = await context.supabase
      .from("organization_members")
      .select("user_id, role")
      .eq("id", data.memberId)
      .eq("organization_id", data.organizationId)
      .maybeSingle();
    if (!target) return { error: "not_found" as const };
    if (target.role === "owner") return { error: "owner_locked" as const };
    if (target.user_id === context.userId) return { error: "cannot_remove_self" as const };

    const { error } = await context.supabase
      .from("organization_members")
      .delete()
      .eq("id", data.memberId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Details of an invitation for the signed-in user (token from the invite link). */
export const getInvite = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ token: z.string().min(10) }).parse(data))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: invite } = await supabaseAdmin
      .from("organization_invitations")
      .select("id, email, role, expires_at, accepted_at, organization_id")
      .eq("token", data.token)
      .maybeSingle();
    if (!invite) return { error: "not_found" as const };
    if (invite.accepted_at) return { error: "already_accepted" as const };
    if (new Date(invite.expires_at) < new Date()) return { error: "expired" as const };

    const { data: org } = await supabaseAdmin
      .from("organizations")
      .select("name")
      .eq("id", invite.organization_id)
      .maybeSingle();

    const { data: userData } = await context.supabase.auth.getUser();
    const email = userData.user?.email?.toLowerCase() ?? "";

    return {
      invite: {
        email: invite.email,
        role: invite.role as OrgRole,
        organizationName: org?.name ?? "Workspace",
        matchesAccount: email === invite.email.toLowerCase(),
      },
    };
  });

export const acceptInvite = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ token: z.string().min(10) }).parse(data))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: invite } = await supabaseAdmin
      .from("organization_invitations")
      .select("id, email, role, expires_at, accepted_at, organization_id")
      .eq("token", data.token)
      .maybeSingle();
    if (!invite) return { error: "not_found" as const };
    if (invite.accepted_at) return { error: "already_accepted" as const };
    if (new Date(invite.expires_at) < new Date()) return { error: "expired" as const };

    const { data: userData } = await context.supabase.auth.getUser();
    const email = userData.user?.email?.toLowerCase() ?? "";
    if (email !== invite.email.toLowerCase()) return { error: "wrong_account" as const };

    const { error } = await supabaseAdmin
      .from("organization_members")
      .upsert(
        {
          organization_id: invite.organization_id,
          user_id: context.userId,
          role: invite.role,
        },
        { onConflict: "organization_id,user_id" },
      );
    if (error) throw new Error(error.message);

    await supabaseAdmin
      .from("organization_invitations")
      .update({ accepted_at: new Date().toISOString(), accepted_by: context.userId })
      .eq("id", invite.id);

    return { ok: true, organizationId: invite.organization_id };
  });
