import { createFileRoute, Outlet } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ShieldAlert } from "lucide-react";

import { AdminShell } from "@/components/app/AdminShell";
import { EmptyState, Panel } from "@/components/app/primitives";
import { getMyPlatformRole, getPlatformSettings } from "@/lib/admin.functions";

export const Route = createFileRoute("/_authenticated/admin")({
  component: AdminLayout,
});

function AdminLayout() {
  const fetchRole = useServerFn(getMyPlatformRole);
  const fetchSettings = useServerFn(getPlatformSettings);

  const roleQuery = useQuery({
    queryKey: ["platform-role"],
    queryFn: () => fetchRole(),
    retry: false,
  });

  const allowed = roleQuery.data?.isSuperAdmin === true;

  const settingsQuery = useQuery({
    queryKey: ["platform-settings"],
    queryFn: () => fetchSettings(),
    retry: false,
    enabled: allowed,
  });

  if (roleQuery.isLoading) {
    return (
      <AdminShell>
        <p className="text-sm text-muted-foreground">Checking access…</p>
      </AdminShell>
    );
  }

  if (!allowed) {
    return (
      <AdminShell>
        <Panel title="Restricted">
          <EmptyState
            icon={ShieldAlert}
            title="Super admin only"
            description="This console is limited to platform administrators."
          />
        </Panel>
      </AdminShell>
    );
  }

  return (
    <AdminShell banner={settingsQuery.data?.incident_banner ?? null}>
      <Outlet />
    </AdminShell>
  );
}
