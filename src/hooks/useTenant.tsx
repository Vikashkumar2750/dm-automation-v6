import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import type { Session, User } from "@supabase/supabase-js";

import { supabase } from "@/integrations/supabase/client";

export type OrgRole = "owner" | "admin" | "manager" | "agent" | "viewer";

export type Organization = {
  id: string;
  name: string;
  slug: string;
  plan: string;
  role: OrgRole;
};

const ACTIVE_ORG_KEY = "dmfiy.active_org";

export function useSession() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const { data } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next);
      setLoading(false);
    });
    supabase.auth.getSession().then(({ data: d }) => {
      setSession(d.session);
      setLoading(false);
    });
    return () => data.subscription.unsubscribe();
  }, []);

  return { session, user: session?.user ?? null, loading };
}

function planLabel(plan: string) {
  return plan.charAt(0).toUpperCase() + plan.slice(1) + " Plan";
}

async function ensureBootstrap(user: User) {
  const fullName =
    (user.user_metadata?.["full_name"] as string | undefined) ??
    (user.user_metadata?.["name"] as string | undefined) ??
    user.email?.split("@")[0] ??
    "New user";

  await supabase.from("profiles").upsert(
    {
      id: user.id,
      email: user.email ?? null,
      full_name: fullName,
      avatar_url: (user.user_metadata?.["avatar_url"] as string | undefined) ?? null,
    },
    { onConflict: "id" },
  );

  const { count } = await supabase
    .from("organization_members")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id);

  if ((count ?? 0) > 0) return;

  const base = (fullName.split(" ")[0] ?? "workspace").toLowerCase().replace(/[^a-z0-9]/g, "");
  const slug = `${base || "workspace"}-${user.id.slice(0, 8)}`;

  const { data: org, error } = await supabase
    .from("organizations")
    .insert({ name: `${fullName}'s Workspace`, slug, owner_id: user.id, plan: "starter" })
    .select("id")
    .single();

  if (error || !org) return;

  await supabase
    .from("organization_members")
    .insert({ organization_id: org.id, user_id: user.id, role: "owner" });
}

export function useTenant() {
  const { user, loading } = useSession();
  const queryClient = useQueryClient();

  const profile = useQuery({
    queryKey: ["profile", user?.id],
    enabled: !!user,
    queryFn: async () => {
      await ensureBootstrap(user!);
      const { data } = await supabase
        .from("profiles")
        .select("id, email, full_name, avatar_url")
        .eq("id", user!.id)
        .maybeSingle();
      return data;
    },
  });

  const orgs = useQuery({
    queryKey: ["organizations", user?.id],
    enabled: !!user && profile.isSuccess,
    queryFn: async (): Promise<Organization[]> => {
      const { data } = await supabase
        .from("organization_members")
        .select("role, organizations(id, name, slug, plan)")
        .eq("user_id", user!.id);

      return (data ?? [])
        .filter((row) => row.organizations)
        .map((row) => ({
          id: row.organizations!.id,
          name: row.organizations!.name,
          slug: row.organizations!.slug,
          plan: planLabel(row.organizations!.plan),
          role: row.role as OrgRole,
        }));
    },
  });

  const [activeOrgId, setActiveOrgId] = useState<string | null>(() =>
    typeof window === "undefined" ? null : window.localStorage.getItem(ACTIVE_ORG_KEY),
  );

  const organizations = orgs.data ?? [];
  const activeOrg =
    organizations.find((o) => o.id === activeOrgId) ?? organizations[0] ?? null;

  function switchOrg(id: string) {
    setActiveOrgId(id);
    window.localStorage.setItem(ACTIVE_ORG_KEY, id);
    queryClient.invalidateQueries();
  }

  const fullName = profile.data?.full_name ?? user?.email ?? "";
  const initials =
    fullName
      .split(" ")
      .map((p) => p[0])
      .filter(Boolean)
      .slice(0, 2)
      .join("")
      .toUpperCase() || "U";

  return {
    loading: loading || profile.isLoading || orgs.isLoading,
    user,
    profile: {
      name: fullName,
      email: user?.email ?? "",
      initials,
      avatarUrl: profile.data?.avatar_url ?? null,
    },
    organizations,
    activeOrg,
    switchOrg,
  };
}
