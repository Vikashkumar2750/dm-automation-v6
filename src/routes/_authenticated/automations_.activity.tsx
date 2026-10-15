import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft, ChevronRight, Zap } from "lucide-react";

import { useState } from "react";
import { PlatformAccountFilter, matchesPlatformAccount } from "@/components/app/PlatformAccountFilter";
import { AppShell } from "@/components/app/AppShell";
import { EmptyState, PageHeader, Panel, StatusBadge } from "@/components/app/primitives";
import { Button } from "@/components/ui/button";
import { useTenant } from "@/hooks/useTenant";
import { activityName, explainReason, stepLabel } from "@/lib/activity-explain";
import { activityJourneys, filterActivityJourneys } from "@/lib/activity-journeys";
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
  validateSearch: (s: Record<string, unknown>) => ({ source: s["source"] === "flows" || s["source"] === "rules" || s["source"] === "system" ? s["source"] : "rules", filter: s["filter"] === "sent" || s["filter"] === "skipped" || s["filter"] === "failed" ? s["filter"] : "all" }),
  component: ActivityPage,
});

const tone = { sent: "success", matched: "info", skipped: "neutral", failed: "danger" } as const;
const groupTone = { completed: "success", in_progress: "info", skipped: "neutral", failed: "danger" } as const;
const groupLabel = { completed: "Completed", in_progress: "In progress", skipped: "Skipped", failed: "Failed" } as const;
const FILTERS = ["all", "sent", "skipped", "failed"] as const;

function RunMarker({ label }: { label: string }) {
  return (
    <div className="relative my-3 h-px bg-foreground/60">
      <span className="absolute -top-1.5 left-2 bg-card px-1 text-[9px] font-semibold uppercase leading-none tracking-wider text-foreground/70">{label}</span>
    </div>
  );
}

function ActivityPage() {
  const { activeOrg } = useTenant();
  const orgId = activeOrg?.id;
  const fetchRuns = useServerFn(listAutomationRuns);
  const fetchRules = useServerFn(listAutomationRules);
  const { source, filter } = Route.useSearch();
  const navigate = Route.useNavigate();
  const [platform, setPlatform] = useState("all");
  const [accountId, setAccountId] = useState("all");

  const runsQuery = useQuery({
    queryKey: ["automation-runs-all", orgId, source],
    enabled: Boolean(orgId),
    queryFn: () => {
      if (!orgId) throw new Error("Workspace not available");
      return fetchRuns({ data: { organizationId: orgId, limit: 300, source } });
    },
    refetchInterval: 15_000,
  });
  const rulesQuery = useQuery({
    queryKey: ["automation-rules", orgId],
    enabled: Boolean(orgId),
    queryFn: () => {
      if (!orgId) throw new Error("Workspace not available");
      return fetchRules({ data: { organizationId: orgId } });
    },
  });
  const rules = rulesQuery.data ?? [];
  const ruleName = (id: string | null) =>
    !id ? "Safety settings" : (rules.find((r) => r.id === id)?.name ?? "Deleted rule");
  const journeys = filterActivityJourneys(activityJourneys((runsQuery.data ?? []).filter((r) => matchesPlatformAccount({ platform: r.contact?.platform, social_account_id: r.contact?.socialAccountId }, platform, accountId))), filter);
  const entries = journeys.flatMap((journey) => journey.groups.map((group) => ({ group, journey })));
  const stepCount = entries.reduce((count, { group }) => count + group.steps.length, 0);

  return (
    <AppShell>
      <div className="space-y-6">
        <Button asChild variant="ghost" size="sm">
          <Link to="/automations"><ArrowLeft className="size-4" /> Back to automations</Link>
        </Button>
        <PageHeader
          title="Automation activity"
          description="Comment triggers, button taps, follow checks and link opens."
        />
        <div className="flex flex-wrap items-center justify-between gap-2"><div className="flex gap-2">{(["flows", "rules", "system"] as const).map((s) => <Button key={s} variant={source === s ? "default" : "outline"} onClick={() => navigate({ search: { source: s, filter } })}>{s === "flows" ? "FLOW" : s === "rules" ? "Rule" : "System / safety"}</Button>)}</div><PlatformAccountFilter orgId={orgId ?? null} platforms={["instagram", "facebook"]} platform={platform} onPlatformChange={setPlatform} accountId={accountId} onAccountChange={setAccountId} /></div>
        <Panel
          title={`${journeys.length} automations · ${entries.length} entries · ${stepCount} steps`}
          bodyClassName="p-0"
          action={
            <div className="flex gap-1">
              {FILTERS.map((f) => (
                <Button key={f} size="sm" variant={filter === f ? "default" : "outline"} className="capitalize" onClick={() => navigate({ search: { source, filter: f } })}>
                  {f}
                </Button>
              ))}
            </div>
          }
        >
          {runsQuery.isLoading ? (
            <p className="p-5 text-sm text-muted-foreground">Loading…</p>
          ) : entries.length === 0 ? (
            <div className="p-5">
              <EmptyState icon={Zap} title="No activity" description="Nothing matches this filter yet." />
            </div>
          ) : (
            <ul className="space-y-3 p-3">
              {entries.map(({ group: g, journey }) => {
                const first = g.steps[0];
                if (!first) return null;
                const name = activityName(first, ruleName);
                const c = g.steps.find((x) => x.contact)?.contact;
                return (
                  <li key={g.key} className="pt-1 pb-1">
                    {journey.startKey === g.key && <RunMarker label="Start" />}
                    <details className="group">
                      <summary className="flex cursor-pointer list-none items-center gap-3 px-5 py-3 hover:bg-muted/50">
                        <StatusBadge tone={groupTone[g.status]}>{groupLabel[g.status]}</StatusBadge>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium">{name}</p>
                          <p className="truncate text-xs text-muted-foreground">
                            {c ? `${c.channel === "comment" ? "Comment" : "DM"} · ${c.platform === "facebook" ? "Facebook" : c.platform === "instagram" ? "Instagram" : c.platform}${c.name ? ` · @${c.name}` : ""} · ` : ""}
                            {g.steps.length} step{g.steps.length > 1 ? "s" : ""}{g.sent ? ` · ${g.sent} sent` : ""} · {new Date(g.startedAt).toLocaleString()}
                          </p>
                        </div>
                        <ChevronRight className="size-4 text-muted-foreground transition-transform group-open:rotate-90" />
                      </summary>
                      <ol className="ml-8 border-l pb-2">
                        {g.steps.map((run) => {
                            const ok = run.status === "sent" || run.status === "matched";
                            const ex = ok ? null : explainReason(run.detail);
                            return (
                              <li key={run.id}>
                                <Link to="/automations/activity/$runId" params={{ runId: run.id }} search={{ source, filter }}
                                  className="flex items-center gap-3 px-4 py-2 hover:bg-muted/50">
                                  <StatusBadge tone={tone[run.status]}>{run.status}</StatusBadge>
                                  <div className="min-w-0 flex-1">
                                    <p className="truncate text-sm">{ok ? stepLabel(run.detail) : ex?.title}</p>
                                    {ex?.hint && <p className="truncate text-xs text-muted-foreground">{ex.hint}</p>}
                                    <p className="text-xs text-muted-foreground">{new Date(run.created_at).toLocaleTimeString()}</p>
                                  </div>
                                  <ChevronRight className="size-4 text-muted-foreground" />
                                </Link>
                              </li>
                            );
                          })}
                      </ol>
                    </details>
                    {journey.endKey === g.key && <RunMarker label="End" />}
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
