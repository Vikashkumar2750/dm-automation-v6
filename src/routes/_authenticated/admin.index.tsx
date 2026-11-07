import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  Building2,
  Gauge,
  MessageSquare,
  ShieldAlert,
  Users,
  Webhook,
  Zap,
  ArrowRight,
  RefreshCw,
  CheckCircle2,
  Settings,
  Activity,
} from "lucide-react";

import { EmptyState, PageHeader, Panel, StatCard, StatusBadge } from "@/components/app/primitives";
import { getPlatformOverview } from "@/lib/admin.functions";
import { Button } from "@/components/ui/button";
import { summarizeIncomingEvents } from "@/lib/admin-overview-summary";

export const Route = createFileRoute("/_authenticated/admin/")({
  head: () => ({
    meta: [
      { title: "Super Admin Command Centre — AutoDM Operations" },
      {
        name: "description",
        content: "Live platform health: workspaces, users, messages, automation runs and webhooks.",
      },
      { property: "og:title", content: "Super Admin Command Centre — AutoDM Operations" },
      { property: "og:description", content: "Workspace oversight, priority actions and incoming event monitoring for AutoDM administrators." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: OverviewPage,
});

function OverviewPage() {
  const fetchOverview = useServerFn(getPlatformOverview);
  const overview = useQuery({
    queryKey: ["platform-overview"],
    queryFn: () => fetchOverview(),
    retry: false,
    refetchInterval: 60_000,
  });
  const { data, isLoading } = overview;
  const t = data?.totals;
  const incoming = summarizeIncomingEvents(data?.recentWebhooks ?? []);
  const value = (count: number | undefined) => count === undefined ? "—" : count.toLocaleString();
  const priorities = data ? [
    ...(data.globalSendPaused ? [{ key: "sending", title: "Global sending is paused", detail: "Review the platform sending switch before resuming.", count: "Paused", to: "/admin/settings" as const, tone: "danger" as const }] : []),
    ...(incoming.deliveryFailures > 0 ? [{ key: "delivery", title: "Verified incoming events failed", detail: "Within the latest 25 events; review delivery diagnostics.", count: String(incoming.deliveryFailures), to: "/admin/webhooks" as const, tone: "danger" as const }] : []),
    ...(t && t.failedJobs > 0 ? [{ key: "jobs", title: "Failed publishing jobs", detail: "Review the publishing queue and provider errors.", count: String(t.failedJobs), to: "/admin/jobs" as const, tone: "danger" as const }] : []),
    ...(t && t.tokenIssues > 0 ? [{ key: "accounts", title: "Account access needs attention", detail: "Disconnected accounts or access expiring within 7 days.", count: String(t.tokenIssues), to: "/admin/accounts" as const, tone: "warning" as const }] : []),
    ...(t && t.pausedOrgs > 0 ? [{ key: "workspaces", title: "Workspace automation is paused", detail: "Inspect workspace settings before changing any pause.", count: String(t.pausedOrgs), to: "/admin/organizations" as const, tone: "warning" as const }] : []),
  ] : [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Command Centre"
        description="Platform oversight · activity from the last 24 hours"
        actions={<><span className="text-xs text-muted-foreground" role="status">{overview.dataUpdatedAt ? `Updated ${new Date(overview.dataUpdatedAt).toLocaleTimeString()}` : "Awaiting overview"}</span><Button variant="outline" size="icon" aria-label="Refresh platform overview" title="Refresh platform overview" disabled={overview.isFetching} onClick={() => void overview.refetch()}><RefreshCw className={overview.isFetching ? "size-4 animate-spin" : "size-4"} /></Button><Button asChild variant="outline"><Link to="/admin/settings"><Settings className="size-4" />System settings</Link></Button></>}
      />
      {overview.isError && <div role="alert" className="flex flex-wrap items-center justify-between gap-3 border-l-2 border-warning bg-warning-soft px-4 py-3 text-sm"><span>Overview could not be refreshed{data ? "; previously loaded data is shown." : "."}</span><Button variant="outline" size="sm" onClick={() => void overview.refetch()} disabled={overview.isFetching}>Try again</Button></div>}
      {!isLoading && !overview.isError && !data && <div role="alert" className="border-l-2 border-warning bg-warning-soft px-4 py-3 text-sm">Overview data is unavailable for this session.</div>}

      <section aria-label="Priority actions" className="border-y py-5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3"><h2 className="text-xl font-semibold">Priority actions</h2><Button asChild variant="link" className="h-auto p-0"><Link to="/admin/alerts">Live alerts<ArrowRight className="size-4" /></Link></Button></div>
        {isLoading ? <p role="status" className="text-sm text-muted-foreground">Loading priority actions…</p> : !data ? <p className="text-sm text-muted-foreground">Priority status is unavailable.</p> : priorities.length === 0 ? <div className="flex items-center gap-2 text-sm"><CheckCircle2 className="size-5 text-success" /><span>No priority issues in the loaded overview.</span></div> : <div className="divide-y">{priorities.map((item) => <Link key={item.key} to={item.to} className="flex min-w-0 items-center gap-3 py-3 transition-colors hover:bg-surface-secondary"><ShieldAlert className={item.tone === "danger" ? "size-5 shrink-0 text-danger" : "size-5 shrink-0 text-warning"} /><div className="min-w-0 flex-1"><p className="break-words text-sm font-semibold">{item.title}</p><p className="mt-1 break-words text-xs text-muted-foreground">{item.detail}</p></div><StatusBadge tone={item.tone}>{item.count}</StatusBadge><ArrowRight className="size-4 shrink-0 text-muted-foreground" /></Link>)}</div>}
      </section>

      <section aria-label="Operations shortcuts" className="flex flex-wrap gap-2"><Button asChild variant="outline"><Link to="/admin/organizations"><Building2 className="size-4" />Workspaces</Link></Button><Button asChild variant="outline"><Link to="/admin/users"><Users className="size-4" />Users</Link></Button><Button asChild variant="outline"><Link to="/admin/jobs"><Gauge className="size-4" />Jobs & queue</Link></Button><Button asChild variant="outline"><Link to="/admin/health"><Activity className="size-4" />API health</Link></Button></section>

      <h2 className="text-xl font-semibold">Platform snapshot</h2>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          icon={Building2}
          label="Workspaces"
          value={value(t?.organizations)}
          sub={`${value(t?.accounts)} social accounts total`}
        />
        <StatCard icon={Users} label="Users" value={value(t?.users)} sub="All workspaces" />
        <StatCard
          icon={MessageSquare}
          label="Messages (24h)"
          value={value(t?.messages24h)}
          sub={`${value(t?.conversations)} conversations total`}
        />
        <StatCard
          icon={Zap}
          label="Automation runs (24h)"
          value={value(t?.automationRuns24h)}
          sub={`${value(t?.pausedOrgs)} workspaces paused`}
        />
        <StatCard
          icon={Gauge}
          label="Scheduled posts"
          value={value(t?.queueDepth)}
          sub={`${value(t?.failedJobs)} failed publishing jobs`}
        />
        <StatCard
          icon={Webhook}
          label="Verified event failures"
          value={data ? value(incoming.deliveryFailures) : "—"}
          sub="Latest 25 incoming events · sample"
        />
        <StatCard
          icon={ShieldAlert}
          label="Token issues"
          value={value(t?.tokenIssues)}
          sub="Expiring or disconnected accounts"
        />
        <StatCard
          icon={Building2}
          label="Posts published"
          value={value(t?.postsPublished)}
          sub="All time"
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Panel title="Assigned workspace plan distribution">
          {!data ? <p className="text-sm text-muted-foreground">{isLoading ? "Loading plans…" : "Plan data unavailable."}</p> : data.byPlan.length === 0 ? (
            <p className="text-sm text-muted-foreground">No workspaces yet.</p>
          ) : (
            <div className="space-y-2">
              {data?.byPlan.map((p) => (
                <div key={p.plan} className="flex items-center justify-between text-sm">
                  <span className="capitalize">{p.plan}</span>
                  <span className="num font-medium">{p.count}</span>
                </div>
              ))}
            </div>
          )}
        </Panel>

        <Panel
          title="Newest workspaces"
          action={
            <Link to="/admin/organizations" className="text-sm font-medium text-primary">
              View all
            </Link>
          }
        >
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : !data ? <p className="text-sm text-muted-foreground">Workspace data unavailable.</p> : data.organizations.length === 0 ? (
            <EmptyState
              icon={Building2}
              title="No workspaces yet"
              description="Workspaces appear here as soon as people sign up."
            />
          ) : (
            <div className="space-y-2">
              {data?.organizations.slice(0, 6).map((o) => (
                <Link
                  key={o.id}
                  to="/admin/org/$orgId"
                  params={{ orgId: o.id }}
                  className="flex min-w-0 flex-wrap items-center justify-between gap-2 rounded-lg border px-3 py-2 text-sm hover:bg-surface-secondary"
                >
                  <span className="min-w-0 flex-1 truncate font-medium">{o.name}</span>
                  <span className="flex items-center gap-2">
                    {o.automationsPaused ? <StatusBadge tone="warning">Paused</StatusBadge> : null}
                    <StatusBadge tone="info">{o.plan}</StatusBadge>
                  </span>
                </Link>
              ))}
            </div>
          )}
        </Panel>
      </div>

      <Panel
        title="Incoming events"
        description={data ? `Latest ${data.recentWebhooks.length} events (up to 25); ${incoming.rejectedProbes} unsigned probes retained in the audit.` : "Latest incoming event sample"}
        action={
          <Link to="/admin/webhooks" className="text-sm font-medium text-primary">
            All webhooks
          </Link>
        }
      >
        {!data ? <p className="text-sm text-muted-foreground">{isLoading ? "Loading events…" : "Event data unavailable."}</p> : data.recentWebhooks.length === 0 ? (
          <EmptyState
            icon={Webhook}
            title="No events yet"
            description="Events from Instagram and Facebook will show up here."
          />
        ) : (
          <div className="space-y-2">
            {data?.recentWebhooks.slice(0, 10).map((h) => (
              <div
                key={h.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg border px-3 py-2 text-sm"
              >
                <div className="min-w-0">
                  <span className="font-medium capitalize">{h.platform ?? "unknown"}</span>
                  <span className="text-muted-foreground"> · {h.event_type}</span>
                  {h.error ? (
                    <div className="break-words text-xs text-destructive">{h.error}</div>
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
  );
}
