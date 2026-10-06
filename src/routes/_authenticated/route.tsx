import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";

import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async ({ location }) => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/auth" });

    // Super admins never see the customer app: decide before any page renders,
    // so there is no flash of the workspace dashboard.
    if (!location.pathname.startsWith("/admin")) {
      const { data: isSuperAdmin } = await supabase.rpc("current_user_has_platform_role", {
        _role: "super_admin",
      });
      if (isSuperAdmin) throw redirect({ to: "/admin", replace: true });
    }

    return { user: data.user };
  },
  component: () => <Outlet />,
});
