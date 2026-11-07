import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Activity, Gauge, RefreshCw, ShieldAlert, Webhook } from "lucide-react";

import { PageHeader, Panel, StatCard, StatusBadge } from "@/components/app/primitives";
import { getPlatformOverview, listAdminAccounts } from "@/lib/admin.functions";
import { OtpDeliveryPanel } from "@/components/app/OtpDeliveryPanel";
import { Button } from "@/components/ui/button";
import { incomingProcessingRate, summarizeIncomingEvents } from "@/lib/admin-overview-summary";

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
  const processing = incomingProcessingRate(hooks);
  const incoming = summarizeIncomingEvents(hooks);
  const value = (count: number | undefined) => count === undefined ? "—" : count.toLocaleString();
  const soon = Date.now() + 7 * 24 * 60 * 60 * 1000;
  const atRisk = (accounts.data ?? []).filter(
    (a) =>
      a.status !== "connected" ||
      (a.platform !== "youtube" &&
        a.token_expires_at &&
        new Date(a.token_expires_at).getTime() < soon),
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="API Health"
        description="Event delivery, error rates and credentials that need attention."
        actions={<Button variant="outline" size="icon" aria-label="Refresh API health" title="Refresh API health" disabled={overview.isFetching || accounts.isFetching} onClick={() => { void overview.refetch(); void accounts.refetch(); }}><RefreshCw className={overview.isFetching || accounts.isFetching ? "size-4 animate-spin" : "size-4"} /></Button>}
      />
      {(overview.isError || accounts.isError) && <div role="alert" className="border-l-2 border-warning bg-warning-soft px-4 py-3 text-sm">Health data could not be refreshed. Previously loaded results may be out of date.</div>}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          icon={Activity}
          label="Verified processing success"
          value={processing.rate === null ? "—" : `${processing.rate}%`}
          sub={overview.data ? `${processing.completed} finalized outcomes · ${processing.pending} pending · latest 25 events` : "Awaiting event data"}
        />
        <StatCard
          icon={Webhook}
          label="Verified event failures"
          value={overview.data ? value(incoming.deliveryFailures) : "—"}
          sub={overview.data ? `Latest 25 events · ${incoming.rejectedProbes} unsigned probes excluded` : "Awaiting event data"}
        />
        <StatCard
          icon={Gauge}
          label="Queue depth"
          value={value(t?.queueDepth)}
          sub={`${value(t?.failedJobs)} failed jobs`}
        />
        <StatCard
          icon={ShieldAlert}
          label="Credentials at risk"
          value={accounts.data ? value(atRisk.length) : "—"}
          sub="Expiring within 7 days or disconnected"
        />
      </div>

      <Panel title="Accounts needing attention">
        {!accounts.data ? <p role="status" className="text-sm text-muted-foreground">{accounts.isLoading ? "Loading account health…" : "Account health unavailable."}</p> : atRisk.length === 0 ? (
          <p className="text-sm text-muted-foreground">{accounts.isError ? "No account risks in the previously loaded results." : accounts.data.length === 0 ? "No connected accounts in the loaded results." : "No account risks in the loaded results."}</p>
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
      <OtpDeliveryPanel />
    </div>
  );
}
