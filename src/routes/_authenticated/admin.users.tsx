import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Users } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { AdminTable } from "@/components/app/AdminTable";
import { EmptyState, PageHeader, Panel, StatusBadge } from "@/components/app/primitives";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { adminUserAction, listAdminUsers, listSuspendedUserIds, setUserSuperAdmin } from "@/lib/admin.functions";

export const Route = createFileRoute("/_authenticated/admin/users")({
  head: () => ({
    meta: [
      { title: "Users — Techaasvik Operations" },
      { name: "description", content: "Every user on the platform, their workspaces and roles." },
      { property: "og:title", content: "Users — Techaasvik Operations" },
      { property: "og:description", content: "User management in the operations console." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: UsersPage,
});

function UsersPage() {
  const fetchUsers = useServerFn(listAdminUsers);
  const setSuper = useServerFn(setUserSuperAdmin);
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const userAction = useServerFn(adminUserAction);
  const fetchSuspended = useServerFn(listSuspendedUserIds);
  const suspended = useQuery({ queryKey: ["admin-suspended"], queryFn: () => fetchSuspended(), retry: false });
  const suspendedSet = new Set(suspended.data ?? []);
  const actionMutation = useMutation({
    mutationFn: (vars: { userId: string; action: "suspend" | "unsuspend" | "send_reset" }) =>
      userAction({ data: { ...vars, redirectTo: `${window.location.origin}/reset-password` } }),
    onSuccess: (_r, v) => {
      toast.success(v.action === "send_reset" ? "Password reset email sent" : v.action === "suspend" ? "User suspended" : "User reactivated");
      void queryClient.invalidateQueries({ queryKey: ["admin-suspended"] });
    },
    onError: (e: Error) => toast.error(e.message || "Action failed"),
  });

  const { data, isLoading } = useQuery({
    queryKey: ["admin-users"],
    queryFn: () => fetchUsers(),
    retry: false,
  });

  const roleMutation = useMutation({
    mutationFn: (vars: { userId: string; grant: boolean }) => setSuper({ data: vars }),
    onSuccess: () => {
      toast.success("Platform access updated");
      void queryClient.invalidateQueries({ queryKey: ["admin-users"] });
    },
    onError: (e: Error) => toast.error(e.message || "Could not update access"),
  });

  const q = search.trim().toLowerCase();
  const rows = (data ?? []).filter(
    (u) =>
      !q ||
      (u.email ?? "").toLowerCase().includes(q) ||
      (u.full_name ?? "").toLowerCase().includes(q),
  );

  return (
    <div className="space-y-6">
      <PageHeader title="Users" description="Accounts, workspace memberships and platform access." />

      <Panel
        title={`${rows.length} users`}
        action={
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search name or email"
            className="h-9 w-56"
          />
        }
      >
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : rows.length === 0 ? (
          <EmptyState icon={Users} title="No users" description="No users match this search." />
        ) : (
          <AdminTable
            rows={rows}
            minWidth={1080}
            columns={[
              {
                header: "User",
                cell: (u) => (
                  <div className="min-w-0">
                    <p className="font-medium">{u.full_name ?? "—"}</p>
                    <p className="text-xs text-muted-foreground">{u.email}</p>
                  </div>
                ),
              },
              {
                header: "Workspaces",
                cell: (u) =>
                  u.workspaces.length === 0 ? (
                    <span className="text-muted-foreground">None</span>
                  ) : (
                    <div className="flex flex-wrap gap-1">
                      {u.workspaces.map((w) => (
                        <StatusBadge key={w.id} tone="neutral">
                          {w.name} · {w.role}
                        </StatusBadge>
                      ))}
                    </div>
                  ),
              },
              { header: "Joined", cell: (u) => new Date(u.created_at).toLocaleDateString() },
              {
                header: "Platform access",
                cell: (u) => (
                  <div className="flex items-center gap-2">
                    {u.isSuperAdmin ? <StatusBadge tone="danger">Super admin</StatusBadge> : null}
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() =>
                        roleMutation.mutate({ userId: u.id, grant: !u.isSuperAdmin })
                      }
                    >
                      {u.isSuperAdmin ? "Revoke" : "Make super admin"}
                    </Button>
                  </div>
                ),
              },
              {
                header: "Account",
                cell: (u) => (
                  <div className="flex flex-wrap items-center gap-2">
                    {suspendedSet.has(u.id) ? <StatusBadge tone="danger">Suspended</StatusBadge> : null}
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() =>
                        actionMutation.mutate({ userId: u.id, action: suspendedSet.has(u.id) ? "unsuspend" : "suspend" })
                      }
                    >
                      {suspendedSet.has(u.id) ? "Unsuspend" : "Suspend"}
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => actionMutation.mutate({ userId: u.id, action: "send_reset" })}>
                      Send reset
                    </Button>
                  </div>
                ),
              },
            ]}
          />
        )}
      </Panel>
    </div>
  );
}
