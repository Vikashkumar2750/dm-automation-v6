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
import { listAdminUsers, setUserSuperAdmin } from "@/lib/admin.functions";

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
            minWidth={820}
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
            ]}
          />
        )}
      </Panel>
    </div>
  );
}
