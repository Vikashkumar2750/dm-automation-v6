import { PlatformAccountFilter } from "@/components/app/PlatformAccountFilter";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Bot, MessageSquare, Send, Timer, CheckCircle2, Zap, Workflow, RefreshCw } from "lucide-react";

import { AppShell } from "@/components/app/AppShell";
import {
  EmptyState,
  PageHeader,
  Panel,
  PlatformBadge,
  StatCard,
} from "@/components/app/primitives";
import { Button } from "@/components/ui/button";
import { useTenant } from "@/hooks/useTenant";
import { useWorkspaceAccountFilter } from "@/hooks/useWorkspaceAccountFilter";
import { getAnalytics } from "@/lib/analytics.functions";
import { AutomationReportPanel } from "@/components/app/AutomationReportPanel";

export const Route = createFileRoute("/_authenticated/analytics")({
  head: () => ({
    meta: [
      { title: "Analytics — AutoDM by Techaasvik" },
      {
        name: "description",
        content:
          "Engagement, automation performance and publishing results across Instagram and Facebook.",
      },
      { property: "og:title", content: "Analytics — AutoDM by Techaasvik" },
      {
        property: "og:description",
        content:
          "Track conversations, reply speed, automation share and published posts in one report.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AnalyticsPage,
});

const RANGES = [7, 30, 90] as const;

function AnalyticsPage() {
  const { activeOrg } = useTenant();
  const [rangeDays, setRangeDays] = useState<number>(30);
  const { accountId, setAccountId, platform, setPlatform } = useWorkspaceAccountFilter(activeOrg?.id);
  const fetchAnalytics = useServerFn(getAnalytics);

  const { data, isError, isFetching, refetch } = useQuery({
    queryKey: ["analytics", activeOrg?.id, rangeDays, accountId, platform],
    enabled: Boolean(activeOrg?.id),
    refetchInterval: 60_000,
    queryFn: () => {
      if (!activeOrg) throw new Error("No workspace selected");
      return fetchAnalytics({ data: { organizationId: activeOrg.id, rangeDays, ...(accountId !== "all" ? { socialAccountId: accountId } : {}), ...(platform !== "all" ? { platform } : {}) } });
    },
  });

  const t = data?.totals;
  const metric = (value: number | null | undefined) => value == null ? "—" : value.toLocaleString();
  const unavailable = isError ? "Analytics unavailable. Refresh to retry." : "Loading analytics…";

  return (
    <AppShell>
      <PageHeader
        title="Analytics"
        description={`Message performance: last ${rangeDays} days. Conversation and post statuses reflect current stored records.`}
        actions={
          <div className="flex flex-wrap items-center gap-2">
          <PlatformAccountFilter orgId={activeOrg?.id ?? null} platform={platform} onPlatformChange={setPlatform} accountId={accountId} onAccountChange={setAccountId} />
          <Button size="icon" variant="outline" aria-label="Refresh analytics" disabled={isFetching} onClick={() => void refetch()}><RefreshCw className="size-4" /></Button>
          <div className="flex items-center gap-1 rounded-lg border border-border p-1">
            {RANGES.map((r) => (
              <Button
                key={r}
                size="sm"
                variant={rangeDays === r ? "secondary" : "ghost"}
                onClick={() => setRangeDays(r)}
              >
                {r}d
              </Button>
            ))}
          </div>
          </div>
        }
      />
      {isError && <p role="alert" className="mb-4 text-sm text-destructive">Analytics could not be refreshed. Previously loaded results may be out of date.</p>}
      <p className="mb-4 text-xs text-muted-foreground">Message metrics use up to 10,000 messages in the selected period; these are loaded results, not guaranteed full-history totals. Active rules and flows are workspace-wide.</p>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          info="All chat threads (DMs and comments) in this workspace, with how many are open or resolved."
          label="Conversations"
          value={metric(t?.conversations)}
          icon={MessageSquare}
          sub={t ? `${t.openThreads} open · ${t.resolved} resolved · current records` : "Unavailable"}
        />
        <StatCard
          info="Messages and comments people sent you in the selected period."
          label="Messages received"
          value={metric(t?.inbound)}
          icon={MessageSquare}
          sub={t ? `${t.unread} unread right now` : "Unavailable"}
        />
        <StatCard
          info="All replies sent in the period — typed by your team (manual) or sent by automations."
          label="Replies sent"
          value={metric(t?.outbound)}
          icon={Send}
          sub={t ? `${t.manual} manual · ${t.automated} automated` : "Unavailable"}
        />
        <StatCard
          info="Out of all replies sent, the percentage sent automatically."
          label="Automation share"
          value={data ? `${data.automationShare}%` : "—"}
          icon={Bot}
          sub={t ? `${t.automationBlocked} runs skipped by safety rules` : "Unavailable"}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          info="Percentage of people who wrote to you and got at least one reply."
          label="Answered conversations"
          value={data ? `${data.responseRate}%` : "—"}
          icon={CheckCircle2}
          sub="Threads that got at least one reply"
        />
        <StatCard
          info="Typical time between a person's first message and your first reply."
          label="Median first reply"
          value={
            data?.medianFirstResponseMinutes === null || data?.medianFirstResponseMinutes === undefined
              ? "—"
              : `${data.medianFirstResponseMinutes} min`
          }
          icon={Timer}
          sub="Time from first message to first reply"
        />
        <StatCard
          info="Posts published from this tool, plus how many are scheduled or failed."
          label="Posts published"
          value={metric(t?.postsPublished)}
          icon={CheckCircle2}
          sub={t ? `${t.postsScheduled} scheduled · ${t.postsFailed} failed · current records` : "Unavailable"}
        />
        <StatCard
          info="Messages sent automatically by rules, flows or the AI agent in the period."
          label="Automated replies"
          value={metric(t?.automated)}
          icon={Bot}
          sub={`Last ${rangeDays} days`}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <StatCard
          info="Total automations switched on right now: keyword rules plus Flow Builder flows."
          label="Active automations"
          value={t ? metric(t.activeRules + t.activeFlows) : "—"}
          icon={Workflow}
          sub={t ? `${t.activeRules} rules · ${t.activeFlows} flows · workspace-wide` : "Unavailable"}
        />
        <StatCard
          info="How many automations ran and sent something. One run counts once, however many steps it sent."
          label="Automation runs"
          value={metric(t?.automationRuns)}
          icon={Zap}
          sub={`Last ${rangeDays} days`}
        />
      </div>

      <Panel
        title={`Activity · last ${rangeDays} days`}
      >
        <div className="h-[280px] w-full min-w-0">
          {!data ? (
            <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
              {unavailable}
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data?.series ?? []} margin={{ top: 8, right: 8, bottom: 0, left: -18 }}>
                <defs>
                  <linearGradient id="aIn" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--chart-1)" stopOpacity={0.35} />
                    <stop offset="100%" stopColor="var(--chart-1)" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="aOut" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--chart-2)" stopOpacity={0.35} />
                    <stop offset="100%" stopColor="var(--chart-2)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                <XAxis
                  dataKey="date"
                  tickFormatter={(v: string) => v.slice(5)}
                  tick={{ fontSize: 11 }}
                  stroke="var(--muted-foreground)"
                  tickLine={false}
                  axisLine={false}
                  minTickGap={24}
                />
                <YAxis
                  tick={{ fontSize: 11 }}
                  stroke="var(--muted-foreground)"
                  tickLine={false}
                  axisLine={false}
                  allowDecimals={false}
                />
                <Tooltip
                  contentStyle={{
                    background: "var(--popover)",
                    border: "1px solid var(--border)",
                    borderRadius: 12,
                    fontSize: 12,
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="inbound"
                  name="Received"
                  stroke="var(--chart-1)"
                  fill="url(#aIn)"
                  strokeWidth={2}
                />
                <Area
                  type="monotone"
                  dataKey="outbound"
                  name="Replied"
                  stroke="var(--chart-2)"
                  fill="url(#aOut)"
                  strokeWidth={2}
                />
                <Area
                  type="monotone"
                  dataKey="automated"
                  name="Automated"
                  stroke="var(--chart-3)"
                  fill="transparent"
                  strokeWidth={2}
                  strokeDasharray="4 3"
                />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>
      </Panel>

      <div className="grid gap-4 lg:grid-cols-3">
        <Panel title="By platform">
          {!data ? <p role="status" className="text-sm text-muted-foreground">{unavailable}</p> : data.byPlatform.length === 0 ? (
            <EmptyState
              icon={MessageSquare}
              title="No conversations yet"
              description="Connect an account and incoming messages will show up here."
            />
          ) : (
            <div className="space-y-3">
              {data?.byPlatform.map((p) => (
                <div key={p.platform} className="flex items-center justify-between gap-3">
                  <PlatformBadge platform={p.platform} withLabel={p.platform} />
                  <div className="text-right text-sm">
                    <div className="num font-medium">{p.conversations} threads</div>
                    <div className="text-xs text-muted-foreground">
                      {p.inbound} in · {p.outbound} out
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Panel>

        <Panel title="By type">
          {!data ? <p role="status" className="text-sm text-muted-foreground">{unavailable}</p> : data.byChannel.length === 0 ? (
            <EmptyState icon={MessageSquare} title="Nothing yet" description="Types appear once messages arrive." />
          ) : (
            <div className="space-y-3">
              {data?.byChannel.map((c) => (
                <div key={c.channel} className="flex items-center justify-between gap-3 text-sm">
                  <span className="capitalize">{c.channel === "dm" ? "Direct messages" : "Comments"}</span>
                  <span className="num font-medium">{c.conversations}</span>
                </div>
              ))}
            </div>
          )}
        </Panel>

        <Panel title="Top automations">
          {!data ? <p role="status" className="text-sm text-muted-foreground">{unavailable}</p> : data.topRules.length === 0 ? (
            <EmptyState
              icon={MessageSquare}
              title="No automation runs"
              description="Create a rule on the Automations page to start replying automatically."
            />
          ) : (
            <div className="space-y-3">
              {data?.topRules.map((r) => (
                <div key={r.name} className="flex items-center justify-between gap-3 text-sm">
                  <span className="min-w-0 break-words">{r.name}</span>
                  <span className="num shrink-0 font-medium">{r.runs}</span>
                </div>
              ))}
            </div>
          )}
        </Panel>
      </div>
      {activeOrg?.id && (
        <div className="mt-6">
          <AutomationReportPanel orgId={activeOrg.id} />
        </div>
      )}
    </AppShell>
  );
}
