import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useSyncExternalStore } from "react";
import type { Session, User } from "@supabase/supabase-js";

import { supabase } from "@/integrations/supabase/client";
import { getTenantOrganizations } from "@/lib/workspace.functions";
import { createTenantSelection } from "./tenant-selection";

export type OrgRole = "owner" | "admin" | "manager" | "agent" | "viewer";

export type Organization = {
  id: string;
  name: string;
  slug: string;
  plan: string;
  role: OrgRole;
  brandName: string | null;
  logoUrl: string | null;
  brandColor: string | null;
  planKey: string;
  planExpiresAt: string | null;
  createdAt: string | null;
};

const ACTIVE_ORG_KEY = "dmfiy.active_org";
const tenantSelection = createTenantSelection();

// One shared session for the whole tab. Every component reads the same value, so a
// page opened later gets the signed-in user instantly instead of starting "logged out"
// for a moment (which used to show placeholder data on every page change).
type SessionState = { session: Session | null; loading: boolean };
let sessionState: SessionState = { session: null, loading: true };
const sessionListeners = new Set<() => void>();
let sessionStarted = false;

function setSessionState(session: Session | null) {
  if (sessionState.session?.access_token === session?.access_token && !sessionState.loading) return;
  sessionState = { session, loading: false };
  sessionListeners.forEach((l) => l());
}

function startSessionStore() {
  if (sessionStarted || typeof window === "undefined") return;
  sessionStarted = true;
  supabase.auth.onAuthStateChange((_event, next) => setSessionState(next));
  void supabase.auth.getSession().then(({ data }) => setSessionState(data.session));
}

function subscribeSession(listener: () => void) {
  startSessionStore();
  sessionListeners.add(listener);
  return () => sessionListeners.delete(listener);
}

const serverSessionState: SessionState = { session: null, loading: true };

export function useSession() {
  const state = useSyncExternalStore(
    subscribeSession,
    () => sessionState,
    () => serverSessionState,
  );
  return { session: state.session, user: state.session?.user ?? null, loading: state.loading };
}

function planLabel(plan: string) {
  return plan.charAt(0).toUpperCase() + plan.slice(1) + " Plan";
}

async function ensureBootstrap(user: User) {
  // Returning users already have a profile and workspace: one quick check, no writes.
  const { data: existing } = await supabase.from("profiles").select("id").eq("id", user.id).maybeSingle();
  if (existing) {
    const { count: memberCount } = await supabase
      .from("organization_members")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id);
    if ((memberCount ?? 0) > 0) return;
  }
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

  // Super admins run the platform; they never get a personal workspace.
  const { data: isSuperAdmin } = await supabase.rpc("current_user_has_platform_role", {
    _role: "super_admin",
  });
  if (isSuperAdmin) return;

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
    staleTime: 5 * 60_000,
    queryFn: async () => {
      if (!user) return null;
      await ensureBootstrap(user);
      const { data } = await supabase
        .from("profiles")
        .select("id, email, full_name, avatar_url")
        .eq("id", user.id)
        .maybeSingle();
      // A brand-new workspace may have been created just now; refresh the list.
      void queryClient.invalidateQueries({ queryKey: ["organizations", user.id] });
      return data;
    },
  });

  const orgs = useQuery({
    queryKey: ["organizations", user?.id],
    enabled: !!user,
    staleTime: 60_000,
    queryFn: async (): Promise<Organization[]> => {
      if (!user) return [];
      const data = await getTenantOrganizations();
      return data.map((row) => ({
          id: row.id,
          name: row.name,
          slug: row.slug,
          plan: planLabel(row.plan),
          role: row.role as OrgRole,
          brandName: row.brand_name,
          logoUrl: row.logo_url,
          brandColor: row.brand_color,
          planKey: row.plan,
          planExpiresAt: row.plan_expires_at,
          createdAt: row.created_at,
        }));
    },
  });

  const userId = user?.id;
  const subscribeSelection = useCallback((listener: () => void) => {
    const unsubscribe = tenantSelection.subscribe(listener);
    if (userId && !tenantSelection.has(userId)) {
      let saved: string | null = null;
      try { saved = window.localStorage.getItem(`${ACTIVE_ORG_KEY}.${userId}`) ?? window.localStorage.getItem(ACTIVE_ORG_KEY); } catch { /* Storage is optional. */ }
      tenantSelection.set(userId, saved);
    }
    return unsubscribe;
  }, [userId]);
  const activeOrgId = useSyncExternalStore(
    subscribeSelection,
    () => userId ? tenantSelection.get(userId) : null,
    () => null,
  );

  const organizations = orgs.data ?? [];
  const activeOrg =
    organizations.find((o) => o.id === activeOrgId) ?? organizations[0] ?? null;

  function switchOrg(id: string) {
    if (!userId || !organizations.some((org) => org.id === id)) return;
    tenantSelection.set(userId, id);
    try { window.localStorage.setItem(`${ACTIVE_ORG_KEY}.${userId}`, id); } catch { /* Selection still works without storage. */ }
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
    // True until the workspace list is known, so pages never render with a missing workspace.
    loading: loading || (!!user &&
        ((profile.data === undefined && !profile.isError) || (orgs.data === undefined && !orgs.isError))),
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
