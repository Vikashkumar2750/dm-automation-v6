import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";

import { supabase } from "@/integrations/supabase/client";

// Remember the super-admin answer briefly so clicking between pages doesn't wait on
// the same check again and again.
let roleCache: { userId: string; isSuperAdmin: boolean; at: number } | null = null;

async function isSuperAdminUser(userId: string) {
  if (roleCache && roleCache.userId === userId && Date.now() - roleCache.at < 60_000) {
    return roleCache.isSuperAdmin;
  }
  const { data } = await supabase.rpc("current_user_has_platform_role", { _role: "super_admin" });
  roleCache = { userId, isSuperAdmin: data === true, at: Date.now() };
  return roleCache.isSuperAdmin;
}

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async ({ location }) => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/auth" });

    // Super admins never see the customer app: decide before any page renders,
    // so there is no flash of the workspace dashboard.
    if (!location.pathname.startsWith("/admin")) {
      if (await isSuperAdminUser(data.user.id)) throw redirect({ to: "/admin", replace: true });
    }

    return { user: data.user };
  },
  component: () => <Outlet />,
});
