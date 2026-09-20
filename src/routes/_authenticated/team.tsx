import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Copy, Mail, Trash2, UsersRound } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { EmptyState, PageHeader, Panel, StatusBadge } from "@/components/app/primitives";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useTenant } from "@/hooks/useTenant";
import {
  changeMemberRole,
  inviteTeammate,
  listInvites,
  listTeam,
  removeMember,
  revokeInvite,
  type OrgRole,
} from "@/lib/team.functions";

export const Route = createFileRoute("/_authenticated/team")({
  head: () => ({
    meta: [
      { title: "Team — DM FB-IG-YT by Techaasvik" },
      { name: "description", content: "Invite teammates and control what each role can do." },
      { property: "og:title", content: "Team — DM FB-IG-YT by Techaasvik" },
      {
        property: "og:description",
        content: "Invite teammates and control what each role can do.",
      },
    ],
  }),
  component: TeamPage,
});

const assignableRoles: { value: OrgRole; label: string; blurb: string }[] = [
  { value: "admin", label: "Admin", blurb: "Everything except deleting the workspace" },
  { value: "manager", label: "Manager", blurb: "Accounts, automations and publishing" },
  { value: "agent", label: "Agent", blurb: "Inbox replies only" },
  { value: "viewer", label: "Viewer", blurb: "Read-only access" },
];

const roleLabel: Record<OrgRole, string> = {
  owner: "Owner",
  admin: "Admin",
  manager: "Manager",
  agent: "Agent",
  viewer: "Viewer",
};

function TeamPage() {
  const { activeOrg } = useTenant();
  const organizationId = activeOrg?.id ?? "";
  const canManage = activeOrg?.role === "owner" || activeOrg?.role === "admin";
  const queryClient = useQueryClient();

  const fetchTeam = useServerFn(listTeam);
  const fetchInvites = useServerFn(listInvites);
  const invite = useServerFn(inviteTeammate);
  const revoke = useServerFn(revokeInvite);
  const setRole = useServerFn(changeMemberRole);
  const remove = useServerFn(removeMember);

  const [email, setEmail] = useState("");
  const [role, setRoleValue] = useState<OrgRole>("agent");

  const members = useQuery({
    queryKey: ["team", organizationId],
    enabled: !!organizationId,
    queryFn: () => fetchTeam({ data: { organizationId } }),
  });

  const invites = useQuery({
    queryKey: ["team-invites", organizationId],
    enabled: !!organizationId && canManage,
    queryFn: () => fetchInvites({ data: { organizationId } }),
  });

  function refresh() {
    queryClient.invalidateQueries({ queryKey: ["team", organizationId] });
    queryClient.invalidateQueries({ queryKey: ["team-invites", organizationId] });
  }

  const inviteMutation = useMutation({
    mutationFn: () => invite({ data: { organizationId, email, role } }),
    onSuccess: (result) => {
      if ("error" in result && result.error) {
        toast.error(
          result.error === "already_invited"
            ? "This email already has a pending invite."
            : "Owner role cannot be invited.",
        );
        return;
      }
      setEmail("");
      toast.success("Invite created — share the link with your teammate.");
      refresh();
    },
    onError: () => toast.error("Could not create the invite."),
  });

  const revokeMutation = useMutation({
    mutationFn: (id: string) => revoke({ data: { organizationId, id } }),
    onSuccess: () => {
      toast.success("Invite revoked.");
      refresh();
    },
  });

  const roleMutation = useMutation({
    mutationFn: (vars: { memberId: string; role: OrgRole }) =>
      setRole({ data: { organizationId, ...vars } }),
    onSuccess: (result) => {
      if ("error" in result && result.error) {
        toast.error("The workspace owner's role can't be changed.");
        return;
      }
      toast.success("Role updated.");
      refresh();
    },
  });

  const removeMutation = useMutation({
    mutationFn: (memberId: string) => remove({ data: { organizationId, memberId } }),
    onSuccess: (result) => {
      if ("error" in result && result.error) {
        toast.error("This person can't be removed.");
        return;
      }
      toast.success("Teammate removed.");
      refresh();
    },
  });

  function copyLink(token: string) {
    const url = `${window.location.origin}/invite/${token}`;
    void navigator.clipboard.writeText(url);
    toast.success("Invite link copied.");
  }

  return (
    <div>
      <PageHeader
        title="Team"
        description="Invite teammates and control what each role can do."
      />

      {canManage && (
        <Panel title="Invite a teammate" className="mb-6">
          <form
            className="flex flex-wrap items-end gap-3"
            onSubmit={(e) => {
              e.preventDefault();
              if (!email.trim()) return;
              inviteMutation.mutate();
            }}
          >
            <div className="min-w-[220px] flex-1">
              <Label htmlFor="invite-email">Work email</Label>
              <Input
                id="invite-email"
                type="email"
                placeholder="teammate@company.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="mt-1.5"
              />
            </div>
            <div className="w-44">
              <Label>Role</Label>
              <Select value={role} onValueChange={(v) => setRoleValue(v as OrgRole)}>
                <SelectTrigger className="mt-1.5">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {assignableRoles.map((r) => (
                    <SelectItem key={r.value} value={r.value}>
                      {r.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button type="submit" disabled={inviteMutation.isPending}>
              <Mail className="size-4" />
              Send invite
            </Button>
          </form>
          <p className="mt-3 text-xs text-subtle-foreground">
            {assignableRoles.find((r) => r.value === role)?.blurb} · The invite link works for
            14 days and only for this email address.
          </p>
        </Panel>
      )}

      <Panel title="Members" bodyClassName="p-0">
        {members.data && members.data.length > 0 ? (
          <ul className="divide-y">
            {members.data.map((m) => (
              <li key={m.id} className="flex flex-wrap items-center gap-3 px-5 py-4">
                <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-full bg-surface-secondary text-sm font-medium">
                  {(m.name || m.email || "U").slice(0, 2).toUpperCase()}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">
                    {m.name}
                    {m.is_self && <span className="text-muted-foreground"> (you)</span>}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">{m.email}</p>
                </div>
                {canManage && m.role !== "owner" && !m.is_self ? (
                  <Select
                    value={m.role}
                    onValueChange={(v) =>
                      roleMutation.mutate({ memberId: m.id, role: v as OrgRole })
                    }
                  >
                    <SelectTrigger className="w-36">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {assignableRoles.map((r) => (
                        <SelectItem key={r.value} value={r.value}>
                          {r.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <StatusBadge tone={m.role === "owner" ? "info" : "neutral"}>
                    {roleLabel[m.role]}
                  </StatusBadge>
                )}
                {canManage && m.role !== "owner" && !m.is_self && (
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={`Remove ${m.name}`}
                    onClick={() => removeMutation.mutate(m.id)}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                )}
              </li>
            ))}
          </ul>
        ) : (
          <div className="p-5">
            <EmptyState
              icon={UsersRound}
              title={members.isLoading ? "Loading team…" : "No teammates yet"}
              description="Invite the people who will handle messages, automations and publishing."
            />
          </div>
        )}
      </Panel>

      {canManage && invites.data && invites.data.length > 0 && (
        <Panel title="Pending invites" className="mt-6" bodyClassName="p-0">
          <ul className="divide-y">
            {invites.data.map((i) => (
              <li key={i.id} className="flex flex-wrap items-center gap-3 px-5 py-4">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{i.email}</p>
                  <p className="text-xs text-muted-foreground">
                    {roleLabel[i.role]} · expires{" "}
                    {new Date(i.expires_at).toLocaleDateString("en-IN")}
                  </p>
                </div>
                <Button variant="outline" size="sm" onClick={() => copyLink(i.token)}>
                  <Copy className="size-4" />
                  Copy link
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={`Revoke invite for ${i.email}`}
                  onClick={() => revokeMutation.mutate(i.id)}
                >
                  <Trash2 className="size-4" />
                </Button>
              </li>
            ))}
          </ul>
        </Panel>
      )}
    </div>
  );
}
