import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Pencil, RefreshCw, Users } from "lucide-react";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

import { AdminTable } from "@/components/app/AdminTable";
import { EmptyState, PageHeader, Panel, StatusBadge } from "@/components/app/primitives";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { adminUserAction, deleteAdminUser, listAdminUsers, listSuspendedUserIds, setUserSuperAdmin, updateAdminUserProfile, type AdminUserRow } from "@/lib/admin.functions";

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
  const [meId, setMeId] = useState<string | null>(null);
  useEffect(() => { void supabase.auth.getUser().then(({ data }) => setMeId(data.user?.id ?? null)); }, []);
  const [editing, setEditing] = useState<AdminUserRow | null>(null);
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
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

  const users = useQuery({
    queryKey: ["admin-users"],
    queryFn: () => fetchUsers(),
    retry: false,
  });
  const { data, isLoading } = users;

  const roleMutation = useMutation({
    mutationFn: (vars: { userId: string; grant: boolean }) => setSuper({ data: vars }),
    onSuccess: () => {
      toast.success("Platform access updated");
      void queryClient.invalidateQueries({ queryKey: ["admin-users"] });
    },
    onError: (e: Error) => toast.error(e.message || "Could not update access"),
  });
  const removeUser = useServerFn(deleteAdminUser);
  const [deleting, setDeleting] = useState<AdminUserRow | null>(null);
  const deleteMutation = useMutation({
    mutationFn: (userId: string) => removeUser({ data: { userId } }),
    onSuccess: () => {
      toast.success("User and owned workspaces deleted");
      setDeleting(null);
      void queryClient.invalidateQueries({ queryKey: ["admin-users"] });
      void queryClient.invalidateQueries({ queryKey: ["platform-overview"] });
    },
    onError: (e: Error) => toast.error(e.message || "Could not delete the user"),
  });
  const updateUser = useServerFn(updateAdminUserProfile);
  const editMutation = useMutation({
    mutationFn: () => {
      if (!editing) throw new Error("Choose a user");
      return updateUser({ data: { userId: editing.id, fullName, email, password } });
    },
    onSuccess: () => {
      toast.success("User profile updated");
      setEditing(null);
      setPassword("");
      void queryClient.invalidateQueries({ queryKey: ["admin-users"] });
    },
    onError: (e: Error) => toast.error(e.message || "Could not update user"),
  });

  function openEditor(user: AdminUserRow) {
    setEditing(user);
    setFullName(user.full_name ?? "");
    setEmail(user.email ?? "");
    setPassword("");
  }

  const q = search.trim().toLowerCase();
  const rows = (data ?? []).filter(
    (u) =>
      !q ||
      (u.email ?? "").toLowerCase().includes(q) ||
      (u.full_name ?? "").toLowerCase().includes(q),
  );

  return (
    <div className="space-y-6">
      <PageHeader title="Users" description="Accounts, workspace memberships and platform access." actions={<Button variant="outline" size="icon" aria-label="Refresh users" title="Refresh users" disabled={users.isFetching || suspended.isFetching} onClick={() => { void users.refetch(); void suspended.refetch(); }}><RefreshCw className={users.isFetching || suspended.isFetching ? "size-4 animate-spin" : "size-4"} /></Button>} />
      {(users.isError || suspended.isError) && <div role="alert" className="border-l-2 border-warning bg-warning-soft px-4 py-3 text-sm">{users.isError ? "Users could not be refreshed. " : ""}{suspended.isError ? "Suspension status could not be refreshed. " : ""}Previously loaded records may be out of date.</div>}

      <Panel
        title={data ? `${rows.length} of ${data.length} loaded users` : "Users"}
        action={
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search name or email"
            aria-label="Search users by name or email"
            className="h-9 w-full sm:w-56"
          />
        }
      >
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : !data ? <p className="text-sm text-muted-foreground">User data unavailable.</p> : rows.length === 0 ? (
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
                    {u.isSuperAdmin ? <StatusBadge tone="danger">Super admin</StatusBadge> : <span className="text-muted-foreground">—</span>}
                    {u.isSuperAdmin && u.id !== meId ? (
                      <Button size="sm" variant="outline" onClick={() => roleMutation.mutate({ userId: u.id, grant: false })}>
                        Revoke
                      </Button>
                    ) : null}
                  </div>
                ),
              },
              {
                header: "Account",
                cell: (u) => (
                  <div className="flex flex-wrap items-center gap-2">
                    {suspendedSet.has(u.id) ? <StatusBadge tone="danger">Suspended</StatusBadge> : null}
                    <Button size="sm" variant="outline" onClick={() => openEditor(u)}>
                      <Pencil className="size-3.5" /> Edit
                    </Button>
                    {u.id !== meId ? (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() =>
                        actionMutation.mutate({ userId: u.id, action: suspendedSet.has(u.id) ? "unsuspend" : "suspend" })
                      }
                    >
                      {suspendedSet.has(u.id) ? "Unsuspend" : "Suspend"}
                    </Button>
                    ) : null}
                    <Button size="sm" variant="ghost" onClick={() => actionMutation.mutate({ userId: u.id, action: "send_reset" })}>
                      Send reset
                    </Button>
                    {u.id !== meId && !u.isSuperAdmin ? (
                      <Button size="sm" variant="destructive" onClick={() => setDeleting(u)}>
                        Delete
                      </Button>
                    ) : null}
                  </div>
                ),
              },
            ]}
          />
        )}
      </Panel>
      <Dialog open={Boolean(deleting)} onOpenChange={(open) => !open && setDeleting(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete user permanently?</DialogTitle>
            <DialogDescription>
              {deleting?.email ?? "This user"} will lose access, and every workspace they own
              {deleting && deleting.workspaces.filter((w) => w.role === "owner").length > 0
                ? ` (${deleting.workspaces.filter((w) => w.role === "owner").map((w) => w.name).join(", ")})`
                : ""}{" "}
              will be deleted with all its data. This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleting(null)}>Cancel</Button>
            <Button variant="destructive" disabled={deleteMutation.isPending} onClick={() => deleting && deleteMutation.mutate(deleting.id)}>
              {deleteMutation.isPending ? "Deleting…" : "Delete user"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog open={Boolean(editing)} onOpenChange={(open) => !open && setEditing(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit user</DialogTitle>
            <DialogDescription>Update the user’s name, login email, or set a new password. Existing passwords are never shown.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <label className="space-y-1.5"><Label>Full name</Label><Input value={fullName} onChange={(e) => setFullName(e.target.value)} maxLength={100} /></label>
            <label className="space-y-1.5"><Label>Login email</Label><Input value={email} onChange={(e) => setEmail(e.target.value)} type="email" maxLength={200} /></label>
            <label className="space-y-1.5"><Label>New password</Label><Input value={password} onChange={(e) => setPassword(e.target.value)} type="password" minLength={10} maxLength={128} placeholder="Leave blank to keep current password" /><span className="block text-xs text-muted-foreground">Minimum 10 characters.</span></label>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>Cancel</Button>
            <Button disabled={editMutation.isPending || fullName.trim().length < 2 || !email.includes("@") || (password.length > 0 && password.length < 10)} onClick={() => editMutation.mutate()}>{editMutation.isPending ? "Saving…" : "Save changes"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
