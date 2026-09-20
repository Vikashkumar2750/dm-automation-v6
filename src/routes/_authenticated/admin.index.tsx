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
} from "lucide-react";

import { EmptyState, PageHeader, Panel, StatCard, StatusBadge } from "@/components/app/primitives";
import { getPlatformOverview } from "@/lib/admin.functions";

export const Route = createFileRoute("/_authenticated/admin/")({
  head: () => ({
    meta: [
      { title: "Platform Overview — Techaasvik Operations" },
      {
        name: "description",
        content: "Live platform health: workspaces, users, messages, automation runs and webhooks.",
      },
      { property: "og:title", content: "Platform Overview — Techaasvik Operations" },
      { property: "og:description", content: "Operations console for the messaging platform." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: OverviewPage,
});

function OverviewPage() {
  const fetchOverview = useServerFn(getPlatformOverview);
  const { data, isLoading } = useQuery({
    queryKey: ["platform-overview"],
    queryFn: () => fetchOverview(),
    retry: false,
    refetchInterval: 60_000,
  });

  const t = data?.totals;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Platform Overview"
        description="Workspaces, users, traffic, queue depth and incoming event health."
      />

      {data?.globalSendPaused ? (
        <div className="panel flex items-center gap-3 border-danger p-4 text-sm">
          <ShieldAlert className="size-5 text-danger" />
          <span>
            Global sending is paused. No automated replies are going out.{" "}
            <Link to="/admin/settings" className="font-medium underline">
              Change in system settings
            </Link>
          </span>
        </div>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          icon={Building2}
          label="Workspaces"
          value={String(t?.organizations ?? 0)}
          sub={`${t?.accounts ?? 0} connected accounts`}
        />
        <StatCard icon={Users} label="Users" value={String(t?.users ?? 0)} sub="All workspaces" />
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
          sub={`${t?.pausedOrgs ?? 0} workspaces paused`}
        />
        <StatCard
          icon={Gauge}
          label="Queue depth"
          value={String(t?.queueDepth ?? 0)}
          sub={`${t?.failedJobs ?? 0} failed jobs`}
        />
        <StatCard
          icon={Webhook}
          label="Webhook failures (24h)"
          value={String(t?.webhookFailures24h ?? 0)}
          sub="Signature or processing errors"
        />
        <StatCard
          icon={ShieldAlert}
          label="Token issues"
          value={String(t?.tokenIssues ?? 0)}
          sub="Expiring or disconnected accounts"
        />
        <StatCard
          icon={Building2}
          label="Posts published"
          value={String(t?.postsPublished ?? 0)}
          sub="All time"
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Panel title="Plans">
          {(data?.byPlan.length ?? 0) === 0 ? (
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
          ) : (data?.organizations.length ?? 0) === 0 ? (
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
                  className="flex items-center justify-between rounded-lg border px-3 py-2 text-sm hover:bg-surface-secondary"
                >
                  <span className="truncate font-medium">{o.name}</span>
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
        action={
          <Link to="/admin/webhooks" className="text-sm font-medium text-primary">
            All webhooks
          </Link>
        }
      >
        {(data?.recentWebhooks.length ?? 0) === 0 ? (
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
  );
}
