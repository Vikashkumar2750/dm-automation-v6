import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Info,
  RefreshCw,
  ShieldAlert,
  Siren,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { EmptyState, PageHeader, Panel, StatCard, StatusBadge } from "@/components/app/primitives";
import { cn } from "@/lib/utils";
import { listAutomationAlerts, type AlertItem } from "@/lib/admin.functions";

export const Route = createFileRoute("/_authenticated/admin/alerts")({
  head: () => ({
    meta: [
      { title: "Live Alerts — Techaasvik Operations" },
      {
        name: "description",
        content: "Every automation break, rejected event and account problem across all workspaces.",
      },
      { property: "og:title", content: "Live Alerts — Techaasvik Operations" },
      {
        property: "og:description",
        content: "Real-time health feed for automations, delivery and connected accounts.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AlertsPage,
});

const CATEGORIES = [
  { key: "all", label: "Everything" },
  { key: "automation", label: "Automations" },
  { key: "delivery", label: "Incoming events" },
  { key: "account", label: "Accounts" },
  { key: "publishing", label: "Publishing" },
  { key: "safety", label: "Safety" },
] as const;

const SEVERITIES = [
  { key: "all", label: "All levels" },
  { key: "critical", label: "Breaking" },
  { key: "warning", label: "Needs attention" },
  { key: "info", label: "Informational" },
] as const;

function severityTone(s: AlertItem["severity"]) {
  return s === "critical" ? "danger" : s === "warning" ? "warning" : "neutral";
}

function severityLabel(s: AlertItem["severity"]) {
  return s === "critical" ? "Breaking" : s === "warning" ? "Attention" : "Info";
}

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.round(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours} h ago`;
  return new Date(iso).toLocaleString();
}

function AlertsPage() {
  const fetchAlerts = useServerFn(listAutomationAlerts);
  const [category, setCategory] = useState<string>("all");
  const [severity, setSeverity] = useState<string>("all");

  const alerts = useQuery({
    queryKey: ["admin-alerts"],
    queryFn: () => fetchAlerts(),
    retry: false,
    refetchInterval: 30_000,
  });

  const items = alerts.data?.items ?? [];
  const filtered = useMemo(
    () =>
      items.filter(
        (i) =>
          (category === "all" || i.category === category) &&
          (severity === "all" || i.severity === severity),
      ),
    [items, category, severity],
  );

  const counts = alerts.data?.counts;
  const healthy = !alerts.isLoading && (counts?.critical ?? 0) === 0;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Live Alerts"
        description="Anything that breaks, gets rejected or needs a human — across every workspace, as it happens."
        actions={
          <Button
            variant="outline"
            size="sm"
            onClick={() => alerts.refetch()}
            disabled={alerts.isFetching}
          >
            <RefreshCw className={cn("mr-2 size-4", alerts.isFetching && "animate-spin")} />
            Refresh
          </Button>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          icon={Siren}
          label="Breaking now"
          value={String(counts?.critical ?? 0)}
          sub="Automations that could not run"
        />
        <StatCard
          icon={AlertTriangle}
          label="Needs attention"
          value={String(counts?.warning ?? 0)}
          sub="Expiring access, failed posts"
        />
        <StatCard
          icon={Info}
          label="Informational"
          value={String(counts?.info ?? 0)}
          sub="Skipped by rules or guardrails"
        />
        <StatCard
          icon={ShieldAlert}
          label="Events (24h)"
          value={String(counts?.total ?? 0)}
          sub={
            alerts.data
              ? `Updated ${new Date(alerts.data.generatedAt).toLocaleTimeString()}`
              : "Loading"
          }
        />
      </div>

      {(alerts.data?.topReasons.length ?? 0) > 0 && (
        <Panel title="Most common causes (last 24 hours)">
          <div className="flex flex-wrap gap-2">
            {alerts.data?.topReasons.map((r) => (
              <span
                key={r.reason}
                className="rounded-full border px-3 py-1 text-xs font-medium text-muted-foreground"
              >
                {r.reason} · {r.count}
              </span>
            ))}
          </div>
        </Panel>
      )}

      <Panel title="Activity feed">
        <div className="mb-4 flex flex-wrap gap-2">
          {CATEGORIES.map((c) => (
            <button
              key={c.key}
              type="button"
              onClick={() => setCategory(c.key)}
              className={cn(
                "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                category === c.key
                  ? "border-foreground bg-foreground text-background"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {c.label}
            </button>
          ))}
          <span className="mx-1 hidden h-6 w-px bg-border sm:block" />
          {SEVERITIES.map((s) => (
            <button
              key={s.key}
              type="button"
              onClick={() => setSeverity(s.key)}
              className={cn(
                "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                severity === s.key
                  ? "border-foreground bg-foreground text-background"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {s.label}
            </button>
          ))}
        </div>

        {alerts.isLoading ? (
          <p className="text-sm text-muted-foreground">Loading activity…</p>
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={CheckCircle2}
            title={healthy ? "Everything is running cleanly" : "Nothing matches this filter"}
            description={
              healthy
                ? "No automation failures, rejected events or account problems in the last 24 hours."
                : "Try a different category or level."
            }
          />
        ) : (
          <ol className="relative space-y-3 border-l pl-5">
            {filtered.map((item) => (
              <li key={item.id} className="relative">
                <span
                  className={cn(
                    "absolute -left-[1.6rem] top-3 size-2.5 rounded-full ring-4 ring-background",
                    item.severity === "critical"
                      ? "bg-destructive"
                      : item.severity === "warning"
                        ? "bg-amber-500"
                        : "bg-muted-foreground/50",
                  )}
                />
                <div className="rounded-xl border bg-card px-4 py-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <StatusBadge tone={severityTone(item.severity)}>
                      {severityLabel(item.severity)}
                    </StatusBadge>
                    <p className="min-w-0 flex-1 truncate text-sm font-semibold">{item.title}</p>
                    <span className="text-xs text-muted-foreground">{timeAgo(item.at)}</span>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {item.organizationName} · {item.category}
                  </p>
                  {item.detail && (
                    <p className="mt-2 break-words rounded-lg bg-muted/50 px-3 py-2 font-mono text-xs text-muted-foreground">
                      {item.detail}
                    </p>
                  )}
                  <p className="mt-2 text-xs text-foreground/80">What to do: {item.hint}</p>
                </div>
              </li>
            ))}
          </ol>
        )}
      </Panel>
    </div>
  );
}
