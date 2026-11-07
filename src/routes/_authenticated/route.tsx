import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";

import { supabase } from "@/integrations/supabase/client";
import { SidebarGroupProvider } from "@/hooks/useSidebarGroup";
import { WorkspaceAccountFilterProvider } from "@/hooks/useWorkspaceAccountFilter";

// Remember the super-admin answer so clicking between pages never waits on the same
// check. A cached answer is used instantly and quietly refreshed in the background.
let roleCache: { userId: string; isSuperAdmin: boolean; at: number } | null = null;
let roleRefresh: Promise<boolean> | null = null;

function fetchRole(userId: string) {
  roleRefresh ??= Promise.resolve(
    supabase.rpc("current_user_has_platform_role", { _role: "super_admin" }),
  )
    .then(({ data }) => {
      roleCache = { userId, isSuperAdmin: data === true, at: Date.now() };
      return roleCache.isSuperAdmin;
    })
    .finally(() => {
      roleRefresh = null;
    });
  return roleRefresh;
}

async function isSuperAdminUser(userId: string) {
  if (roleCache && roleCache.userId === userId) {
    if (Date.now() - roleCache.at > 60_000) void fetchRole(userId);
    return roleCache.isSuperAdmin;
  }
  return fetchRole(userId);
}

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async ({ location }) => {
    // Read the signed-in session locally (no network round trip on every click).
    // Every server call still verifies the token, so this is only a page guard.
    const { data } = await supabase.auth.getSession();
    const user = data.session?.user;
    if (!user) throw redirect({ to: "/auth" });

    // Super admins never see the customer app: decide before any page renders,
    // so there is no flash of the workspace dashboard.
    if (!location.pathname.startsWith("/admin")) {
      if (await isSuperAdminUser(user.id)) throw redirect({ to: "/admin", replace: true });
    }

    return { user };
  },
  component: AuthenticatedLayout,
});

function AuthenticatedLayout() {
  const { user } = Route.useRouteContext();
  return <SidebarGroupProvider key={user.id}><WorkspaceAccountFilterProvider><Outlet /></WorkspaceAccountFilterProvider></SidebarGroupProvider>;
}
