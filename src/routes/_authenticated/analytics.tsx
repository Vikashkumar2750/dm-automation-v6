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
import { Bot, MessageSquare, Send, Timer, CheckCircle2 } from "lucide-react";

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
import { getAnalytics } from "@/lib/analytics.functions";
import { AutomationReportPanel } from "@/components/app/AutomationReportPanel";

export const Route = createFileRoute("/_authenticated/analytics")({
  head: () => ({
    meta: [
      { title: "Analytics — DM FB-IG-YT by Techaasvik" },
      {
        name: "description",
        content:
          "Engagement, automation performance and publishing results across Instagram and Facebook.",
      },
      { property: "og:title", content: "Analytics — DM FB-IG-YT by Techaasvik" },
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
  const fetchAnalytics = useServerFn(getAnalytics);

  const { data, isLoading } = useQuery({
    queryKey: ["analytics", activeOrg?.id, rangeDays],
    enabled: Boolean(activeOrg?.id),
    refetchInterval: 60_000,
    queryFn: () =>
      fetchAnalytics({ data: { organizationId: activeOrg!.id, rangeDays } }),
  });

  const t = data?.totals;

  return (
    <AppShell>
      <PageHeader
        title="Analytics"
        description="Conversations, reply speed, automation share and publishing results."
        actions={
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
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Conversations"
          value={String(t?.conversations ?? 0)}
          icon={MessageSquare}
          sub={`${t?.openThreads ?? 0} open · ${t?.resolved ?? 0} resolved`}
        />
        <StatCard
          label="Messages received"
          value={String(t?.inbound ?? 0)}
          icon={MessageSquare}
          sub={`${t?.unread ?? 0} unread right now`}
        />
        <StatCard
          label="Replies sent"
          value={String(t?.outbound ?? 0)}
          icon={Send}
          sub={`${t?.manual ?? 0} manual · ${t?.automated ?? 0} automated`}
        />
        <StatCard
          label="Automation share"
          value={`${data?.automationShare ?? 0}%`}
          icon={Bot}
          sub={`${t?.automationBlocked ?? 0} runs skipped by safety rules`}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Answered conversations"
          value={`${data?.responseRate ?? 0}%`}
          icon={CheckCircle2}
          sub="Threads that got at least one reply"
        />
        <StatCard
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
          label="Posts published"
          value={String(t?.postsPublished ?? 0)}
          icon={CheckCircle2}
          sub={`${t?.postsScheduled ?? 0} scheduled · ${t?.postsFailed ?? 0} failed`}
        />
        <StatCard
          label="Automated replies"
          value={String(t?.automated ?? 0)}
          icon={Bot}
          sub={`Last ${rangeDays} days`}
        />
      </div>

      <Panel
        title="Activity"
      >
        <div className="h-[280px] w-full min-w-0">
          {isLoading ? (
            <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
              Loading…
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
          {(data?.byPlatform.length ?? 0) === 0 ? (
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
          {(data?.byChannel.length ?? 0) === 0 ? (
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
          {(data?.topRules.length ?? 0) === 0 ? (
            <EmptyState
              icon={MessageSquare}
              title="No automation runs"
              description="Create a rule on the Automations page to start replying automatically."
            />
          ) : (
            <div className="space-y-3">
              {data?.topRules.map((r) => (
                <div key={r.name} className="flex items-center justify-between gap-3 text-sm">
                  <span className="truncate">{r.name}</span>
                  <span className="num font-medium">{r.runs}</span>
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
