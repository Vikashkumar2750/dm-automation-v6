import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { Building2, Plus } from "lucide-react";
import { toast } from "sonner";

import { AppShell } from "@/components/app/AppShell";
import { PageHeader, Panel, EmptyState } from "@/components/app/primitives";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useTenant } from "@/hooks/useTenant";
import {
  createClientWorkspace,
  getWorkspace,
  listClientWorkspaces,
  updateWorkspace,
} from "@/lib/workspace.functions";

export const Route = createFileRoute("/_authenticated/settings")({
  head: () => ({
    meta: [
      { title: "Settings — AutoDM by Techaasvik" },
      {
        name: "description",
        content: "Workspace name, white-label branding, support email and client workspaces.",
      },
      { property: "og:title", content: "Workspace settings & branding" },
      {
        property: "og:description",
        content: "Rename your workspace, set brand colour and logo, and add client workspaces.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: SettingsPage,
});

const TIMEZONES = [
  "Asia/Kolkata",
  "Asia/Dubai",
  "Europe/London",
  "America/New_York",
  "America/Los_Angeles",
  "Australia/Sydney",
];

function SettingsPage() {
  const { activeOrg, switchOrg } = useTenant();
  const orgId = activeOrg?.id ?? null;
  const queryClient = useQueryClient();

  const fetchWorkspace = useServerFn(getWorkspace);
  const fetchClients = useServerFn(listClientWorkspaces);
  const saveWorkspace = useServerFn(updateWorkspace);
  const addClient = useServerFn(createClientWorkspace);

  const workspace = useQuery({
    queryKey: ["workspace", orgId],
    enabled: !!orgId,
    queryFn: () => fetchWorkspace({ data: { organizationId: orgId! } }),
  });

  const clients = useQuery({
    queryKey: ["client-workspaces", orgId],
    enabled: !!orgId,
    queryFn: () => fetchClients({ data: { organizationId: orgId! } }),
  });

  const [form, setForm] = useState({
    name: "",
    brandName: "",
    logoUrl: "",
    brandColor: "",
    supportEmail: "",
    timezone: "Asia/Kolkata",
  });
  const [clientName, setClientName] = useState("");

  useEffect(() => {
    const w = workspace.data;
    if (!w) return;
    setForm({
      name: w.name,
      brandName: w.brand_name ?? "",
      logoUrl: w.logo_url ?? "",
      brandColor: w.brand_color ?? "",
      supportEmail: w.support_email ?? "",
      timezone: w.timezone || "Asia/Kolkata",
    });
  }, [workspace.data]);

  const canEdit = ["owner", "admin"].includes(workspace.data?.my_role ?? "");
  const planExpired =
    !!workspace.data?.plan_expires_at && new Date(workspace.data.plan_expires_at) < new Date();
  const isAgency = workspace.data?.plan === "agency" && !planExpired;

  const save = useMutation({
    mutationFn: () =>
      saveWorkspace({
        data: {
          organizationId: orgId!,
          name: form.name.trim(),
          brandName: form.brandName.trim() || null,
          logoUrl: form.logoUrl.trim() || null,
          brandColor: form.brandColor.trim() || null,
          supportEmail: form.supportEmail.trim() || null,
          timezone: form.timezone,
        },
      }),
    onSuccess: () => {
      toast.success("Branding saved");
      queryClient.invalidateQueries();
    },
    onError: (e: Error) =>
      toast.error(
        e.message === "not_allowed"
          ? "Only owners and admins can change branding"
          : e.message.includes("hex")
            ? "Use a hex colour like #2563eb"
            : "Could not save — check the details and try again",
      ),
  });

  const create = useMutation({
    mutationFn: () =>
      addClient({ data: { parentOrganizationId: orgId!, name: clientName.trim() } }),
    onSuccess: (res) => {
      setClientName("");
      toast.success("Client workspace created");
      queryClient.invalidateQueries();
      switchOrg(res.id);
    },
    onError: (e: Error) =>
      toast.error(
        e.message === "agency_only"
          ? "Client workspaces are available on the Agency plan only"
          : e.message === "not_allowed"
            ? "Only the workspace owner or admin can add clients"
            : `Could not create the client workspace: ${e.message}`,
      ),
  });

  if (!orgId) {
    return (
      <AppShell>
      <div className="space-y-6">
        <PageHeader title="Settings" description="Workspace profile, branding and clients." />
        <Panel title="Workspace">
          <EmptyState
            icon={Building2}
            title="No workspace yet"
            description="Create or join a workspace to manage settings."
          />
        </Panel>
      </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
    <div className="space-y-6">
      <PageHeader
        title="Settings"
        description="Workspace profile, white-label branding and client workspaces."
      />

      <Panel title="Branding" >
        {!isAgency && (
          <div className="mb-4 flex flex-col gap-3 rounded-xl border bg-surface-secondary p-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-muted-foreground">
              White-label branding (brand name, logo, colour, support email) is available on the
              Agency plan. Upgrade to unlock it. You can still change the workspace name and time
              zone.
            </p>
            <Button asChild size="sm">
              <Link to="/billing">Upgrade to Agency</Link>
            </Button>
          </div>
        )}
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="ws-name">Workspace name</Label>
            <Input
              id="ws-name"
              value={form.name}
              disabled={!canEdit}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="ws-brand">Brand name shown in the app</Label>
            <Input
              id="ws-brand"
              placeholder="Your agency name"
              value={form.brandName}
              disabled={!canEdit}
              onChange={(e) => setForm((f) => ({ ...f, brandName: e.target.value }))}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="ws-logo">Logo link</Label>
            <Input
              id="ws-logo"
              placeholder="https://…/logo.png"
              value={form.logoUrl}
              disabled={!canEdit}
              onChange={(e) => setForm((f) => ({ ...f, logoUrl: e.target.value }))}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="ws-color">Brand colour</Label>
            <div className="flex items-center gap-3">
              <input
                type="color"
                aria-label="Brand colour"
                className="size-10 cursor-pointer rounded-lg border bg-surface-secondary"
                value={/^#[0-9a-fA-F]{6}$/.test(form.brandColor) ? form.brandColor : "#2563eb"}
                disabled={!canEdit}
                onChange={(e) => setForm((f) => ({ ...f, brandColor: e.target.value }))}
              />
              <Input
                id="ws-color"
                placeholder="#2563eb"
                value={form.brandColor}
                disabled={!canEdit}
                onChange={(e) => setForm((f) => ({ ...f, brandColor: e.target.value }))}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="ws-email">Support email</Label>
            <Input
              id="ws-email"
              placeholder="support@yourbrand.com"
              value={form.supportEmail}
              disabled={!canEdit}
              onChange={(e) => setForm((f) => ({ ...f, supportEmail: e.target.value }))}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="ws-tz">Time zone</Label>
            <select
              id="ws-tz"
              className="h-10 w-full rounded-lg border bg-surface-secondary px-3 text-sm outline-none focus:border-ring"
              value={form.timezone}
              disabled={!canEdit}
              onChange={(e) => setForm((f) => ({ ...f, timezone: e.target.value }))}
            >
              {TIMEZONES.map((tz) => (
                <option key={tz} value={tz}>
                  {tz}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="mt-5 flex items-center gap-3">
          <Button onClick={() => save.mutate()} disabled={!canEdit || save.isPending}>
            {save.isPending ? "Saving…" : "Save changes"}
          </Button>
          {!canEdit && (
            <p className="text-xs text-muted-foreground">
              Only owners and admins can edit branding.
            </p>
          )}
        </div>
      </Panel>

      <Panel title="Client workspaces">
        {isAgency ? (
          <div className="flex flex-col gap-3 sm:flex-row">
            <Input
              placeholder="New client name"
              value={clientName}
              onChange={(e) => setClientName(e.target.value)}
              disabled={!canEdit}
            />
            <Button
              onClick={() => create.mutate()}
              disabled={!canEdit || clientName.trim().length < 2 || create.isPending}
            >
              <Plus className="size-4" />
              {create.isPending ? "Creating…" : "Add client"}
            </Button>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            {workspace.data?.plan === "agency" && planExpired
              ? "Your Agency plan has expired. Renew it in Billing to add client workspaces."
              : "Client workspaces are available on the Agency plan. Upgrade to manage separate workspaces for your clients."}
          </p>
        )}

        <div className="mt-4 space-y-2">
          {(clients.data ?? []).map((c) => (
            <div
              key={c.id}
              className="flex items-center gap-3 rounded-xl border bg-surface-secondary px-4 py-3"
            >
              <span
                className="inline-flex size-9 items-center justify-center rounded-lg text-sm font-bold text-primary-foreground"
                style={{ background: c.brand_color ?? "var(--color-primary)" }}
              >
                {(c.brand_name ?? c.name).slice(0, 1).toUpperCase()}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{c.brand_name ?? c.name}</p>
                <p className="text-xs text-muted-foreground">
                  {c.plan} · {c.members} member{c.members === 1 ? "" : "s"} · {c.accounts} account
                  {c.accounts === 1 ? "" : "s"}
                  {c.is_client ? " · client" : ""}
                </p>
              </div>
              {c.id === orgId ? (
                <span className="text-xs text-muted-foreground">Current</span>
              ) : (
                <Button variant="outline" size="sm" onClick={() => switchOrg(c.id)}>
                  Open
                </Button>
              )}
            </div>
          ))}
          {clients.isSuccess && (clients.data ?? []).length === 0 && (
            <EmptyState
              icon={Building2}
              title="No workspaces yet"
              description="Add a client to manage their accounts separately."
            />
          )}
        </div>
      </Panel>
    </div>
    </AppShell>
  );
}
