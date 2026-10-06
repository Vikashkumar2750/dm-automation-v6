import { createFileRoute, Navigate, Outlet } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";

import { AdminShell } from "@/components/app/AdminShell";
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
    // Non-admins never see the admin console — send them back to their dashboard.
    return <Navigate to="/dashboard" replace />;
  }

  return (
    <AdminShell banner={settingsQuery.data?.incident_banner ?? null}>
      <Outlet />
    </AdminShell>
  );
}
