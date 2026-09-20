import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Activity, Gauge, ShieldAlert, Webhook } from "lucide-react";

import { PageHeader, Panel, StatCard, StatusBadge } from "@/components/app/primitives";
import { getPlatformOverview, listAdminAccounts } from "@/lib/admin.functions";

export const Route = createFileRoute("/_authenticated/admin/health")({
  head: () => ({
    meta: [
      { title: "API Health — Techaasvik Operations" },
      { name: "description", content: "Delivery health, token expiry and platform error rates." },
      { property: "og:title", content: "API Health — Techaasvik Operations" },
      { property: "og:description", content: "Health signals for Instagram and Facebook APIs." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: HealthPage,
});

function HealthPage() {
  const fetchOverview = useServerFn(getPlatformOverview);
  const fetchAccounts = useServerFn(listAdminAccounts);

  const overview = useQuery({
    queryKey: ["platform-overview"],
    queryFn: () => fetchOverview(),
    retry: false,
    refetchInterval: 60_000,
  });
  const accounts = useQuery({
    queryKey: ["admin-accounts"],
    queryFn: () => fetchAccounts(),
    retry: false,
  });

  const t = overview.data?.totals;
  const hooks = overview.data?.recentWebhooks ?? [];
  const processed = hooks.filter((h) => h.status === "processed").length;
  const successRate = hooks.length ? Math.round((processed / hooks.length) * 100) : 100;
  const soon = Date.now() + 7 * 24 * 60 * 60 * 1000;
  const atRisk = (accounts.data ?? []).filter(
    (a) =>
      a.status !== "connected" ||
      (a.token_expires_at && new Date(a.token_expires_at).getTime() < soon),
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="API Health"
        description="Event delivery, error rates and credentials that need attention."
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          icon={Activity}
          label="Event success rate"
          value={`${successRate}%`}
          sub={`${hooks.length} recent events`}
        />
        <StatCard
          icon={Webhook}
          label="Failures (24h)"
          value={String(t?.webhookFailures24h ?? 0)}
          sub="Processing or signature errors"
        />
        <StatCard
          icon={Gauge}
          label="Queue depth"
          value={String(t?.queueDepth ?? 0)}
          sub={`${t?.failedJobs ?? 0} failed jobs`}
        />
        <StatCard
          icon={ShieldAlert}
          label="Credentials at risk"
          value={String(atRisk.length)}
          sub="Expiring within 7 days or disconnected"
        />
      </div>

      <Panel title="Accounts needing attention">
        {atRisk.length === 0 ? (
          <p className="text-sm text-muted-foreground">All connected accounts look healthy.</p>
        ) : (
          <div className="space-y-2">
            {atRisk.map((a) => (
              <div
                key={a.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg border px-3 py-2 text-sm"
              >
                <div className="min-w-0">
                  <p className="truncate font-medium">
                    {a.name} · <span className="capitalize">{a.platform}</span>
                  </p>
                  <p className="truncate text-xs text-muted-foreground">{a.organizationName}</p>
                </div>
                <div className="flex items-center gap-2">
                  <StatusBadge tone={a.status === "connected" ? "warning" : "danger"}>
                    {a.status}
                  </StatusBadge>
                  <span className="text-xs text-muted-foreground">
                    {a.token_expires_at
                      ? `expires ${new Date(a.token_expires_at).toLocaleDateString()}`
                      : "no expiry set"}
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
