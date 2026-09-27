import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { ArrowLeft, ChevronRight, Zap } from "lucide-react";

import { AppShell } from "@/components/app/AppShell";
import { EmptyState, PageHeader, Panel, StatusBadge } from "@/components/app/primitives";
import { Button } from "@/components/ui/button";
import { useTenant } from "@/hooks/useTenant";
import { explainReason, stepLabel } from "@/lib/activity-explain";
import { listAutomationRules, listAutomationRuns } from "@/lib/automations.functions";

export const Route = createFileRoute("/_authenticated/automations_/activity")({
  head: () => ({
    meta: [
      { title: "Automation activity — AutoDM by Techaasvik" },
      { name: "description", content: "Every automation step: sent, skipped and failed, with reasons." },
      { property: "og:title", content: "Automation activity — Techaasvik" },
      { property: "og:description", content: "Full automation activity log." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ActivityPage,
});

const tone = { sent: "success", matched: "info", skipped: "neutral", failed: "danger" } as const;
const FILTERS = ["all", "sent", "skipped", "failed"] as const;

function ActivityPage() {
  const { activeOrg } = useTenant();
  const orgId = activeOrg?.id;
  const fetchRuns = useServerFn(listAutomationRuns);
  const fetchRules = useServerFn(listAutomationRules);
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>("all");

  const runsQuery = useQuery({
    queryKey: ["automation-runs-all", orgId],
    enabled: Boolean(orgId),
    queryFn: () => fetchRuns({ data: { organizationId: orgId!, limit: 300 } }),
    refetchInterval: 15_000,
  });
  const rulesQuery = useQuery({
    queryKey: ["automation-rules", orgId],
    enabled: Boolean(orgId),
    queryFn: () => fetchRules({ data: { organizationId: orgId! } }),
  });
  const rules = rulesQuery.data ?? [];
  const ruleName = (id: string | null) =>
    !id ? "Safety settings" : (rules.find((r) => r.id === id)?.name ?? "Deleted rule");
  const runs = (runsQuery.data ?? []).filter((r) => filter === "all" || r.status === filter);

  return (
    <AppShell>
      <div className="space-y-6">
        <Button asChild variant="ghost" size="sm">
          <Link to="/automations"><ArrowLeft className="size-4" /> Back to automations</Link>
        </Button>
        <PageHeader
          title="Automation activity"
          description="Every step your automations took. Tap any entry to see full details."
        />
        <Panel
          title={`${runs.length} entries`}
          bodyClassName="p-0"
          action={
            <div className="flex gap-1">
              {FILTERS.map((f) => (
                <Button key={f} size="sm" variant={filter === f ? "default" : "outline"} className="capitalize" onClick={() => setFilter(f)}>
                  {f}
                </Button>
              ))}
            </div>
          }
        >
          {runsQuery.isLoading ? (
            <p className="p-5 text-sm text-muted-foreground">Loading…</p>
          ) : runs.length === 0 ? (
            <div className="p-5">
              <EmptyState icon={Zap} title="No activity" description="Nothing matches this filter yet." />
            </div>
          ) : (
            <ul className="divide-y">
              {runs.map((run) => {
                const ok = run.status === "sent" || run.status === "matched";
                const ex = ok ? null : explainReason(run.detail);
                return (
                  <li key={run.id}>
                    <Link
                      to="/automations/activity/$runId"
                      params={{ runId: run.id }}
                      className="flex items-center gap-3 px-5 py-3 hover:bg-muted/50"
                    >
                      <StatusBadge tone={tone[run.status]}>{run.status}</StatusBadge>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">
                          {ok ? `${ruleName(run.rule_id)}: ${stepLabel(run.detail)}` : `${ex!.title} — ${ruleName(run.rule_id)}`}
                        </p>
                        {ex?.hint && <p className="truncate text-xs text-muted-foreground">{ex.hint}</p>}
                        <p className="text-xs text-muted-foreground">{new Date(run.created_at).toLocaleString()}</p>
                      </div>
                      <ChevronRight className="size-4 text-muted-foreground" />
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </Panel>
      </div>
    </AppShell>
  );
}
