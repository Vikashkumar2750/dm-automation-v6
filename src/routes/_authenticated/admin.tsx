import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Building2, ShieldAlert, Users, Webhook, Zap, MessageSquare } from "lucide-react";
import { toast } from "sonner";

import { AppShell } from "@/components/app/AppShell";
import { EmptyState, PageHeader, Panel, StatCard, StatusBadge } from "@/components/app/primitives";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { getPlatformOverview, setOrganizationPlan } from "@/lib/admin.functions";

export const Route = createFileRoute("/_authenticated/admin")({
  head: () => ({
    meta: [
      { title: "Platform Overview — DM FB-IG-YT by Techaasvik" },
      {
        name: "description",
        content: "Workspaces, users, plans, automation volume and webhook health across the platform.",
      },
      { property: "og:title", content: "Platform Overview — DM FB-IG-YT by Techaasvik" },
      {
        property: "og:description",
        content: "Operations console for workspaces, plans and platform health.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AdminPage,
});

const PLANS = ["starter", "pro", "agency"] as const;

function AdminPage() {
  const fetchOverview = useServerFn(getPlatformOverview);
  const changePlan = useServerFn(setOrganizationPlan);
  const queryClient = useQueryClient();

  const { data, isLoading, error } = useQuery({
    queryKey: ["platform-overview"],
    queryFn: () => fetchOverview(),
    retry: false,
    refetchInterval: 60_000,
  });

  const planMutation = useMutation({
    mutationFn: (vars: { organizationId: string; plan: (typeof PLANS)[number] }) =>
      changePlan({ data: vars }),
    onSuccess: () => {
      toast.success("Plan updated");
      void queryClient.invalidateQueries({ queryKey: ["platform-overview"] });
    },
    onError: () => toast.error("Could not update the plan"),
  });

  const forbidden = Boolean(error) || (!isLoading && !data);
  const t = data?.totals;

  return (
    <AppShell>
      <PageHeader
        title="Platform Overview"
        description="Workspaces, users, plans, automation volume and incoming event health."
      />

      {forbidden ? (
        <Panel title="Restricted">
          <EmptyState
            icon={ShieldAlert}
            title="Super admin only"
            description="This console is limited to platform administrators."
          />
        </Panel>
      ) : (
        <div className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard
              icon={Building2}
              label="Workspaces"
              value={String(t?.organizations ?? 0)}
              sub={`${t?.accounts ?? 0} connected accounts`}
            />
            <StatCard
              icon={Users}
              label="Users"
              value={String(t?.users ?? 0)}
              sub="Across all workspaces"
            />
            <StatCard
              icon={MessageSquare}
              label="Messages (24h)"
              value={String(t?.messages24h ?? 0)}
              sub={`${t?.conversations ?? 0} conversations total`}
            />
            <StatCard
              icon={Zap}
              label="Automation runs (24h)"
              value={String(t?.automationRuns24h ?? 0)}
              sub={`${t?.postsPublished ?? 0} posts published`}
            />
          </div>

          <Panel title="Workspaces">
            {isLoading ? (
              <p className="text-sm text-muted-foreground">Loading…</p>
            ) : (data?.organizations.length ?? 0) === 0 ? (
              <EmptyState
                icon={Building2}
                title="No workspaces yet"
                description="Workspaces appear here as soon as people sign up."
              />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[640px] text-sm">
                  <thead className="text-left text-xs uppercase tracking-wide text-muted-foreground">
                    <tr>
                      <th className="pb-2">Workspace</th>
                      <th className="pb-2">Members</th>
                      <th className="pb-2">Accounts</th>
                      <th className="pb-2">Threads</th>
                      <th className="pb-2">Posts</th>
                      <th className="pb-2">Plan</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data?.organizations.map((o) => (
                      <tr key={o.id} className="border-t border-border">
                        <td className="py-3">
                          <div className="font-medium">{o.name}</div>
                          <div className="text-xs text-muted-foreground">
                            {new Date(o.created_at).toLocaleDateString()}
                          </div>
                        </td>
                        <td className="num py-3">{o.members}</td>
                        <td className="num py-3">{o.accounts}</td>
                        <td className="num py-3">{o.conversations}</td>
                        <td className="num py-3">{o.posts}</td>
                        <td className="py-3">
                          <Select
                            value={o.plan}
                            onValueChange={(plan) =>
                              planMutation.mutate({
                                organizationId: o.id,
                                plan: plan as (typeof PLANS)[number],
                              })
                            }
                          >
                            <SelectTrigger className="h-8 w-[130px] capitalize">
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
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Panel>

          <Panel title="Incoming events">
            {(data?.recentWebhooks.length ?? 0) === 0 ? (
              <EmptyState
                icon={Webhook}
                title="No events yet"
                description="Events from Instagram and Facebook will show up here."
              />
            ) : (
              <div className="space-y-2">
                {data?.recentWebhooks.map((h) => (
                  <div
                    key={h.id}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border px-3 py-2 text-sm"
                  >
                    <div className="min-w-0">
                      <span className="font-medium capitalize">{h.platform ?? "unknown"}</span>
                      <span className="text-muted-foreground"> · {h.event_type}</span>
                      {h.error ? (
                        <div className="truncate text-xs text-destructive">{h.error}</div>
                      ) : null}
                    </div>
                    <div className="flex items-center gap-2">
                      {!h.signature_valid ? (
                        <StatusBadge tone="danger">Bad signature</StatusBadge>
                      ) : null}
                      <StatusBadge
                        tone={
                          h.status === "failed"
                            ? "danger"
                            : h.status === "processed"
                              ? "success"
                              : "neutral"
                        }
                      >
                        {h.status}
                      </StatusBadge>
                      <span className="text-xs text-muted-foreground">
                        {new Date(h.received_at).toLocaleString()}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Panel>
        </div>
      )}
    </AppShell>
  );
}
