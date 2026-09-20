import { createFileRoute, Link } from "@tanstack/react-router";
import {
  MessageSquare,
  MessagesSquare,
  Send,
  UserCheck,
  CalendarCheck,
  TrendingUp,
  ArrowRight,
  Sparkles,
  Plus,
  Inbox as InboxIcon,
  CheckCircle2,
  Circle,
} from "lucide-react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { AppShell } from "@/components/app/AppShell";
import {
  Panel,
  PageHeader,
  PlatformBadge,
  StatCard,
  StatusBadge,
  UsageMeter,
} from "@/components/app/primitives";
import { Button } from "@/components/ui/button";
import {
  connectedAccounts,
  conversations,
  currentUser,
  engagementSeries,
  kpis,
  topAutomations,
  upcomingPosts,
  usageMeters,
} from "@/lib/demo-data";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Dashboard — DM FB-IG-YT by Techaasvik" },
      {
        name: "description",
        content:
          "Publish to Instagram, Facebook and YouTube, manage comments and conversations, and automate eligible replies from one workspace.",
      },
      { property: "og:title", content: "Dashboard — DM FB-IG-YT by Techaasvik" },
      {
        property: "og:description",
        content:
          "Social publishing, unified engagement and conversation automation for creators, MSMEs and agencies.",
      },
    ],
  }),
  component: Dashboard,
});

const kpiIcons = [
  MessagesSquare,
  MessageSquare,
  Send,
  UserCheck,
  CalendarCheck,
  TrendingUp,
];

function Dashboard() {
  return (
    <AppShell>
      <PageHeader
        title={`Good morning, ${currentUser.name.split(" ")[0]}`}
        description="Here's what's happening with your social media today."
        actions={
          <>
            <Button variant="outline">Last 7 days</Button>
            <Button asChild>
              <Link to="/create-post">
                <Plus className="size-4" />
                Create Post
              </Link>
            </Button>
          </>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-6">
        {kpis.map((kpi, i) => (
          <StatCard
            key={kpi.label}
            icon={kpiIcons[i] ?? MessageSquare}
            label={kpi.label}
            value={kpi.value}
            delta={kpi.delta}
            sub={kpi.sub}
          />
        ))}
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-3">
        <Panel
          className="xl:col-span-2"
          title="Connected Accounts"
          action={
            <Link
              to="/social-accounts"
              className="inline-flex items-center gap-1 text-sm font-medium text-primary"
            >
              Manage all <ArrowRight className="size-4" />
            </Link>
          }
        >
          <div className="grid gap-4 md:grid-cols-3">
            {connectedAccounts.map((account) => (
              <div key={account.platform} className="rounded-xl border p-4">
                <div className="flex items-center justify-between">
                  <PlatformBadge
                    platform={account.platform}
                    withLabel={account.handle}
                  />
                  <StatusBadge tone="success">Connected</StatusBadge>
                </div>
                <p className="num mt-4 text-xl font-semibold">{account.metric}</p>
                <p className="text-xs text-muted-foreground">{account.metricLabel}</p>
                <ul className="mt-4 space-y-1.5">
                  {account.capabilities.map((cap) => (
                    <li
                      key={cap.name}
                      className="flex items-center gap-2 text-sm text-muted-foreground"
                    >
                      {cap.enabled ? (
                        <CheckCircle2 className="size-4 text-success" />
                      ) : (
                        <Circle className="size-4 text-subtle-foreground" />
                      )}
                      {cap.name}
                    </li>
                  ))}
                </ul>
                <Button variant="outline" size="sm" className="mt-4 w-full">
                  Manage
                </Button>
              </div>
            ))}
          </div>
        </Panel>

        <Panel title="Engagement Overview" bodyClassName="p-4">
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={engagementSeries}>
                <defs>
                  {(["instagram", "facebook", "youtube"] as const).map((k, i) => (
                    <linearGradient key={k} id={`fill-${k}`} x1="0" y1="0" x2="0" y2="1">
                      <stop
                        offset="5%"
                        stopColor={`var(--chart-${i + 1})`}
                        stopOpacity={0.25}
                      />
                      <stop
                        offset="95%"
                        stopColor={`var(--chart-${i + 1})`}
                        stopOpacity={0}
                      />
                    </linearGradient>
                  ))}
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                <XAxis
                  dataKey="day"
                  tickLine={false}
                  axisLine={false}
                  fontSize={12}
                  stroke="var(--muted-foreground)"
                />
                <YAxis
                  tickLine={false}
                  axisLine={false}
                  fontSize={12}
                  width={32}
                  stroke="var(--muted-foreground)"
                />
                <Tooltip
                  contentStyle={{
                    borderRadius: 10,
                    border: "1px solid var(--border)",
                    fontSize: 12,
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="instagram"
                  stroke="var(--chart-1)"
                  fill="url(#fill-instagram)"
                  strokeWidth={2}
                />
                <Area
                  type="monotone"
                  dataKey="facebook"
                  stroke="var(--chart-2)"
                  fill="url(#fill-facebook)"
                  strokeWidth={2}
                />
                <Area
                  type="monotone"
                  dataKey="youtube"
                  stroke="var(--chart-3)"
                  fill="url(#fill-youtube)"
                  strokeWidth={2}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Panel>
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-3">
        <Panel
          title="Recent Conversations"
          action={
            <Link
              to="/inbox"
              className="inline-flex items-center gap-1 text-sm font-medium text-primary"
            >
              View all <ArrowRight className="size-4" />
            </Link>
          }
          bodyClassName="p-2"
        >
          <ul>
            {conversations.map((c) => (
              <li
                key={c.name}
                className="flex items-center gap-3 rounded-lg px-3 py-2.5 hover:bg-surface-secondary"
              >
                <PlatformBadge platform={c.platform} size="sm" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{c.name}</p>
                  <p className="truncate text-xs text-muted-foreground">{c.preview}</p>
                </div>
                <span className="text-xs text-subtle-foreground">{c.time}</span>
                <StatusBadge tone={c.state === "Pending" ? "warning" : "success"}>
                  {c.state}
                </StatusBadge>
              </li>
            ))}
          </ul>
        </Panel>

        <Panel
          title="Top Automations"
          action={
            <Link
              to="/automations"
              className="inline-flex items-center gap-1 text-sm font-medium text-primary"
            >
              View all <ArrowRight className="size-4" />
            </Link>
          }
        >
          <ol className="space-y-4">
            {topAutomations.map((a, i) => (
              <li key={a.name}>
                <div className="flex items-center justify-between gap-3">
                  <span className="truncate text-sm font-medium">
                    {i + 1}. {a.name}
                  </span>
                  <span className="num shrink-0 text-sm">
                    {a.runs.toLocaleString("en-IN")}
                    <span className="ml-2 text-xs text-success">{a.delta}</span>
                  </span>
                </div>
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-surface-secondary">
                  <div
                    className="h-full rounded-full bg-primary"
                    style={{ width: `${a.share}%` }}
                  />
                </div>
              </li>
            ))}
          </ol>
        </Panel>

        <Panel
          title="Upcoming Posts"
          action={
            <Link
              to="/calendar"
              className="inline-flex items-center gap-1 text-sm font-medium text-primary"
            >
              View all <ArrowRight className="size-4" />
            </Link>
          }
          bodyClassName="p-2"
        >
          <ul>
            {upcomingPosts.map((p) => (
              <li
                key={p.title}
                className="flex items-center gap-3 rounded-lg px-3 py-2.5 hover:bg-surface-secondary"
              >
                <PlatformBadge platform={p.platform} size="sm" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{p.title}</p>
                  <p className="truncate text-xs text-muted-foreground">{p.when}</p>
                </div>
                <StatusBadge tone="info">{p.status}</StatusBadge>
              </li>
            ))}
          </ul>
        </Panel>
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-3">
        <Panel
          className="xl:col-span-2"
          title="Usage & Limits"
          action={
            <Link
              to="/usage"
              className="inline-flex items-center gap-1 text-sm font-medium text-primary"
            >
              View all <ArrowRight className="size-4" />
            </Link>
          }
        >
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {usageMeters.map((m) => (
              <UsageMeter key={m.label} {...m} />
            ))}
          </div>
        </Panel>

        <Panel title="Quick Actions">
          <div className="grid grid-cols-2 gap-2">
            <Button variant="outline" asChild className="justify-start">
              <Link to="/create-post">
                <Plus className="size-4" /> Create Post
              </Link>
            </Button>
            <Button variant="outline" asChild className="justify-start">
              <Link to="/automations">
                <Sparkles className="size-4" /> New Automation
              </Link>
            </Button>
            <Button variant="outline" asChild className="justify-start">
              <Link to="/inbox">
                <InboxIcon className="size-4" /> View Inbox
              </Link>
            </Button>
            <Button variant="outline" asChild className="justify-start">
              <Link to="/social-accounts">
                <Plus className="size-4" /> Add Account
              </Link>
            </Button>
          </div>
        </Panel>
      </div>
    </AppShell>
  );
}
