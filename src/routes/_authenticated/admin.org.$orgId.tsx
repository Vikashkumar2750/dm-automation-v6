import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AlertTriangle, ArrowLeft } from "lucide-react";
import { toast } from "sonner";

import { AdminTable } from "@/components/app/AdminTable";
import { PageHeader, Panel, StatCard, StatusBadge } from "@/components/app/primitives";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Building2, MessageSquare, Share2, Workflow } from "lucide-react";
import {
  getAdminOrganization,
  setSimulatorAccess,
  setOrganizationAutomationPause,
  setOrganizationPlan,
} from "@/lib/admin.functions";

export const Route = createFileRoute("/_authenticated/admin/org/$orgId")({
  head: () => ({
    meta: [
      { title: "Workspace detail — Techaasvik Operations" },
      { name: "description", content: "Plan, usage, accounts, automations and errors for one workspace." },
      { property: "og:title", content: "Workspace detail — Techaasvik Operations" },
      { property: "og:description", content: "Tenant detail view in the operations console." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: OrgDetailPage,
});

const PLANS = ["starter", "pro", "agency"] as const;

function OrgDetailPage() {
  const { orgId } = Route.useParams();
  const fetchOrg = useServerFn(getAdminOrganization);
  const changePlan = useServerFn(setOrganizationPlan);
  const setPause = useServerFn(setOrganizationAutomationPause);
  const setSimulator = useServerFn(setSimulatorAccess);
  const queryClient = useQueryClient();

  const { data, isLoading, error } = useQuery({
    queryKey: ["admin-org", orgId],
    queryFn: () => fetchOrg({ data: { organizationId: orgId } }),
    retry: false,
  });

  const invalidate = () => void queryClient.invalidateQueries({ queryKey: ["admin-org", orgId] });

  const planMutation = useMutation({
    mutationFn: (plan: (typeof PLANS)[number]) =>
      changePlan({ data: { organizationId: orgId, plan } }),
    onSuccess: () => {
      toast.success("Plan updated");
      invalidate();
    },
    onError: () => toast.error("Could not update the plan"),
  });

  const pauseMutation = useMutation({
    mutationFn: (paused: boolean) => setPause({ data: { organizationId: orgId, paused } }),
    onSuccess: () => {
      toast.success("Automation state updated");
      invalidate();
    },
    onError: () => toast.error("Could not update the workspace"),
  });

  const simulatorMutation = useMutation({
    mutationFn: (vars: { userId?: string; enabled: boolean | null }) =>
      setSimulator({ data: { organizationId: orgId, userId: vars.userId ?? null, enabled: vars.enabled } }),
    onSuccess: () => {
      toast.success("Test console access updated");
      invalidate();
    },
    onError: () => toast.error("Could not update test console access"),
  });

  if (isLoading) return <p className="text-sm text-muted-foreground">Loading…</p>;
  if (error || !data)
    return (
      <Panel title="Not found">
        <p className="text-sm text-muted-foreground">This workspace could not be loaded.</p>
      </Panel>
    );

  return (
    <div className="space-y-6">
      <Link
        to="/admin/organizations"
        className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" /> All organizations
      </Link>

      <PageHeader
        title={data.org.name}
        description={`Created ${new Date(data.org.created_at).toLocaleDateString()} · ${data.org.slug}`}
        actions={
          <div className="flex items-center gap-2">
            <Select
              value={data.org.plan}
              onValueChange={(p) => planMutation.mutate(p as (typeof PLANS)[number])}
            >
              <SelectTrigger className="h-9 w-[140px] capitalize">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PLANS.map((p) => (
                  <SelectItem key={p} value={p} className="capitalize">
                    {p}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              variant={data.org.automationsPaused ? "default" : "outline"}
              onClick={() => pauseMutation.mutate(!data.org.automationsPaused)}
            >
              {data.org.automationsPaused ? "Resume automations" : "Pause automations"}
            </Button>
          </div>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard icon={Building2} label="Members" value={String(data.org.members)} />
        <StatCard icon={Share2} label="Connected accounts" value={String(data.org.accounts)} />
        <StatCard
          icon={MessageSquare}
          label="Conversations"
          value={String(data.org.conversations)}
        />
        <StatCard
          icon={Workflow}
          label="Automation runs (24h)"
          value={String(data.usage.runs24h)}
          sub={`${data.usage.postsScheduled} posts scheduled`}
        />
      </div>

      <Panel title="Social accounts">
        {data.accounts.length === 0 ? (
          <p className="text-sm text-muted-foreground">No accounts connected.</p>
        ) : (
          <AdminTable
            rows={data.accounts}
            minWidth={640}
            columns={[
              { header: "Account", cell: (a) => <span className="font-medium">{a.name}</span> },
              { header: "Platform", cell: (a) => <span className="capitalize">{a.platform}</span> },
              {
                header: "Status",
                cell: (a) => (
                  <StatusBadge tone={a.status === "connected" ? "success" : "warning"}>
                    {a.status}
                  </StatusBadge>
                ),
              },
              {
                header: "Token expires",
                cell: (a) =>
                  a.token_expires_at ? new Date(a.token_expires_at).toLocaleDateString() : "—",
              },
            ]}
          />
        )}
      </Panel>

      <Panel title="Automation test console">
        <div className="space-y-3 text-sm">
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border px-3 py-2">
            <div>
              <p className="font-medium">Workspace access</p>
              <p className="text-xs text-muted-foreground">Allows owners, admins and managers in this workspace to run dry tests.</p>
            </div>
            <Button
              variant={data.org.simulatorEnabled ? "default" : "outline"}
              onClick={() => simulatorMutation.mutate({ enabled: !data.org.simulatorEnabled })}
            >
              {data.org.simulatorEnabled ? "Enabled" : "Disabled"}
            </Button>
          </div>
          {data.members.map((member) => (
            <div key={member.user_id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border px-3 py-2">
              <div className="min-w-0">
                <p className="truncate font-medium">{member.full_name ?? member.email ?? member.user_id}</p>
                <p className="text-xs text-muted-foreground">Individual access override</p>
              </div>
              <Button
                size="sm"
                variant={member.simulatorEnabled ? "default" : "outline"}
                onClick={() => simulatorMutation.mutate({ userId: member.user_id, enabled: !member.simulatorEnabled })}
              >
                {member.simulatorEnabled ? "Enabled for user" : "Enable for user"}
              </Button>
            </div>
          ))}
        </div>
      </Panel>

      <Panel title="Automations">
        {data.automations.length === 0 ? (
          <p className="text-sm text-muted-foreground">No automation rules.</p>
        ) : (
          <AdminTable
            rows={data.automations}
            minWidth={640}
            columns={[
              { header: "Rule", cell: (r) => <span className="font-medium">{r.name}</span> },
              { header: "Trigger", cell: (r) => r.trigger },
              { header: "Action", cell: (r) => r.action },
              { header: "Runs (24h)", cell: (r) => <span className="num">{r.runs24h}</span> },
              {
                header: "State",
                cell: (r) => (
                  <StatusBadge tone={r.is_active ? "success" : "neutral"}>
                    {r.is_active ? "Active" : "Off"}
                  </StatusBadge>
                ),
              },
            ]}
          />
        )}
      </Panel>

      <div className="grid gap-6 lg:grid-cols-2">
        <Panel title="Team">
          <div className="space-y-2">
            {data.members.map((m) => (
              <div
                key={m.user_id}
                className="flex items-center justify-between rounded-lg border px-3 py-2 text-sm"
              >
                <div className="min-w-0">
                  <p className="truncate font-medium">{m.full_name ?? m.email ?? m.user_id}</p>
                  <p className="truncate text-xs text-muted-foreground">{m.email}</p>
                </div>
                <StatusBadge tone="info">{m.role}</StatusBadge>
              </div>
            ))}
          </div>
        </Panel>

        <Panel title="Recent errors">
          {data.recentErrors.length === 0 ? (
            <p className="text-sm text-muted-foreground">No recent errors.</p>
          ) : (
            <div className="space-y-2">
              {data.recentErrors.map((e) => (
                <div key={e.id} className="rounded-lg border px-3 py-2 text-sm">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="size-4 text-warning" />
                    <span className="font-medium capitalize">{e.source}</span>
                    <span className="ml-auto text-xs text-muted-foreground">
                      {new Date(e.at).toLocaleString()}
                    </span>
                  </div>
                  <p className="mt-1 text-xs break-words text-muted-foreground">{e.detail}</p>
                </div>
              ))}
            </div>
          )}
        </Panel>
      </div>
    </div>
  );
}
