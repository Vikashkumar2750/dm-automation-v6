import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useWorkflowsEnabled } from "@/hooks/useWorkflowsEnabled";
import {
  ArrowRight,
  CalendarCheck,
  Inbox as InboxIcon,
  MessageSquare,
  MessagesSquare,
  Plus,
  Send,
  Share2,
  Sparkles,
  TrendingUp,
  UserCheck,
  Zap,
  Workflow,
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

import { useState } from "react";
import { AppShell } from "@/components/app/AppShell";
import { TemplateSlider } from "@/components/app/TemplateSlider";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AutomationNotificationBanner } from "@/components/app/AutomationNotifications";
import {
  EmptyState,
  PageHeader,
  Panel,
  PlatformBadge,
  StatCard,
  StatusBadge,
  UsageMeter,
} from "@/components/app/primitives";
import { Button } from "@/components/ui/button";
import { useTenant } from "@/hooks/useTenant";
import { getAnalytics } from "@/lib/analytics.functions";
import { getAutomationUsage, listOrgActivityFeed } from "@/lib/automations.functions";
import { listConversations } from "@/lib/inbox.functions";
import { listPosts } from "@/lib/publishing.functions";
import { listSocialAccounts } from "@/lib/social-accounts.functions";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [
      { title: "Dashboard — AutoDM by Techaasvik" },
      {
        name: "description",
        content:
          "Publish to Instagram, Facebook and YouTube, manage comments and conversations, and automate eligible replies from one workspace.",
      },
      { property: "og:title", content: "Dashboard — AutoDM by Techaasvik" },
      {
        property: "og:description",
        content:
          "Social publishing, unified engagement and conversation automation for creators, MSMEs and agencies.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Dashboard,
});

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

function Dashboard() {
  const { profile, activeOrg } = useTenant();
  const workflowsOn = useWorkflowsEnabled();
  const orgId = activeOrg?.id ?? null;
  const firstName = profile.name.split(" ")[0] || "there";

  const fetchAnalytics = useServerFn(getAnalytics);
  const fetchAccounts = useServerFn(listSocialAccounts);
  const fetchPosts = useServerFn(listPosts);
  const fetchConversations = useServerFn(listConversations);
  const fetchUsage = useServerFn(getAutomationUsage);

  const analytics = useQuery({
    queryKey: ["analytics", orgId, 7],
    enabled: !!orgId,
    refetchInterval: 60_000,
    queryFn: () => fetchAnalytics({ data: { organizationId: orgId!, rangeDays: 7 } }),
  });
  const accounts = useQuery({
    queryKey: ["social-accounts", orgId],
    enabled: !!orgId,
    queryFn: () => fetchAccounts({ data: { organizationId: orgId! } }),
  });
  const posts = useQuery({
    queryKey: ["posts", orgId],
    enabled: !!orgId,
    queryFn: () => fetchPosts({ data: { organizationId: orgId! } }),
  });
  const conversations = useQuery({
    queryKey: ["conversations", orgId, "dashboard"],
    enabled: !!orgId,
    refetchInterval: 60_000,
    queryFn: () => fetchConversations({ data: { organizationId: orgId! } }),
  });
  const usage = useQuery({
    queryKey: ["automation-usage", orgId],
    enabled: !!orgId,
    queryFn: () => fetchUsage({ data: { organizationId: orgId! } }),
  });
  const fetchActivity = useServerFn(listOrgActivityFeed);
  const activity = useQuery({
    queryKey: ["org-activity", orgId],
    enabled: !!orgId,
    refetchInterval: 30_000,
    queryFn: () => fetchActivity({ data: { organizationId: orgId! } }),
  });
  const activityItems = activity.data ?? [];

  const a = analytics.data;
  const [needAccount, setNeedAccount] = useState(false);
  const hasAccount = (accounts.data ?? []).length > 0;
  const accountRows = accounts.data ?? [];
  const upcoming = (posts.data ?? [])
    .filter((p) => p.status === "scheduled" && p.scheduled_at)
    .sort((x, y) => (x.scheduled_at! < y.scheduled_at! ? -1 : 1))
    .slice(0, 5);
  const recentThreads = (conversations.data ?? []).slice(0, 5);

  return (
    <AppShell>
      <PageHeader
        title={`${greeting()}, ${firstName}`}
        description="Last 7 days across your connected accounts."
        actions={
          hasAccount ? (
            <Button asChild>
              <Link to="/automations" search={{ new: true }}>
                <Plus className="size-4" />
                Create new automation
              </Link>
            </Button>
          ) : (
            <Button onClick={() => setNeedAccount(true)}>
              <Plus className="size-4" />
              Create new automation
            </Button>
          )
        }
      />

      <AutomationNotificationBanner />
      <Panel title="Automation templates" className="mb-6">
        <TemplateSlider canCreate={hasAccount} onNeedAccount={() => setNeedAccount(true)} />
      </Panel>
      <Dialog open={needAccount} onOpenChange={setNeedAccount}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Connect an account first</DialogTitle>
            <DialogDescription>Automations run on a connected Instagram, Facebook or YouTube account. Connect one to create your first automation.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button asChild><Link to="/social-accounts">Connect account</Link></Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard info="All chat threads (DMs and comments) and how many are open." icon={MessagesSquare} label="Conversations" value={String(a?.totals.conversations ?? 0)} sub={`${a?.totals.openThreads ?? 0} open`} />
        <StatCard info="Messages and comments people sent you in the last 7 days." icon={MessageSquare} label="Messages received" value={String(a?.totals.inbound ?? 0)} sub={`${a?.totals.unread ?? 0} unread`} />
        <StatCard info="Replies sent in the last 7 days, manual and automated." icon={Send} label="Replies sent" value={String(a?.totals.outbound ?? 0)} sub={`${a?.totals.automated ?? 0} automated`} />
        <StatCard info="Percentage of people who got at least one reply, and the typical time to first reply." icon={UserCheck} label="Answered" value={`${a?.responseRate ?? 0}%`} sub={`Median ${a?.medianFirstResponseMinutes ?? 0} min`} />
        <StatCard info="Posts published from this tool, plus how many are scheduled." icon={CalendarCheck} label="Posts published" value={String(a?.totals.postsPublished ?? 0)} sub={`${a?.totals.postsScheduled ?? 0} scheduled`} />
        <StatCard info="Out of all replies sent, the percentage sent automatically." icon={TrendingUp} label="Automation share" value={`${a?.automationShare ?? 0}%`} sub="Of all replies" />
        <StatCard info="Automations switched on right now: keyword rules plus Flow Builder flows." icon={Workflow} label="Active automations" value={String((a?.totals.activeRules ?? 0) + (a?.totals.activeFlows ?? 0))} sub={`${a?.totals.activeRules ?? 0} rules · ${a?.totals.activeFlows ?? 0} flows`} />
        <StatCard info="Automations that ran and sent something in the last 7 days. One run counts once, however many steps." icon={Zap} label="Automation runs" value={String(a?.totals.automationRuns ?? 0)} sub="Last 7 days" />
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-3">
        <Panel
          className="min-w-0 xl:col-span-2"
          title="Activity"
          action={
            <Link to="/analytics" className="inline-flex items-center gap-1 text-sm font-medium text-primary">
              Full analytics <ArrowRight className="size-4" />
            </Link>
          }
        >
          <div className="h-64 min-w-0">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={a?.series ?? []}>
                <defs>
                  <linearGradient id="dashIn" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--color-chart-1)" stopOpacity={0.35} />
                    <stop offset="100%" stopColor="var(--color-chart-1)" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="dashOut" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--color-chart-2)" stopOpacity={0.35} />
                    <stop offset="100%" stopColor="var(--color-chart-2)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
                <XAxis dataKey="date" tickLine={false} axisLine={false} fontSize={12} />
                <YAxis tickLine={false} axisLine={false} fontSize={12} width={32} allowDecimals={false} />
                <Tooltip />
                <Area type="monotone" dataKey="inbound" stroke="var(--color-chart-1)" fill="url(#dashIn)" name="Received" />
                <Area type="monotone" dataKey="outbound" stroke="var(--color-chart-2)" fill="url(#dashOut)" name="Replied" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Panel>

        <Panel
          title="Connected accounts"
          action={
            <Link to="/social-accounts" className="inline-flex items-center gap-1 text-sm font-medium text-primary">
              Manage <ArrowRight className="size-4" />
            </Link>
          }
        >
          {accountRows.length === 0 ? (
            <EmptyState
              icon={Share2}
              title="No accounts yet"
              description="Connect Instagram or Facebook to start receiving messages."
              action={
                <Button asChild>
                  <Link to="/social-accounts">Connect account</Link>
                </Button>
              }
            />
          ) : (
            <div className="space-y-3">
              {accountRows.map((acc) => (
                <div key={acc.id} className="flex items-center gap-3">
                  <PlatformBadge platform={acc.platform} withLabel={acc.name} />
                  <StatusBadge
                    tone={acc.status === "connected" ? "success" : acc.status === "attention" ? "warning" : "danger"}
                  >
                    {acc.status}
                  </StatusBadge>
                </div>
              ))}
            </div>
          )}
        </Panel>
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-3">
        <Panel
          title="Latest conversations"
          className="xl:col-span-2"
          action={
            <Link to="/inbox" className="inline-flex items-center gap-1 text-sm font-medium text-primary">
              Open inbox <ArrowRight className="size-4" />
            </Link>
          }
        >
          {recentThreads.length === 0 ? (
            <EmptyState
              icon={InboxIcon}
              title="No conversations yet"
              description="Messages and comments land here once an account is connected."
            />
          ) : (
            <div className="space-y-2">
              {recentThreads.map((c) => (
                <div key={c.id} className="flex items-center gap-3 rounded-xl border px-4 py-3">
                  <PlatformBadge platform={c.platform} size="sm" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">
                      {c.external_user_name || c.external_user_id}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      {c.last_message_preview ?? "No preview"}
                    </p>
                  </div>
                  {c.unread_count > 0 && <StatusBadge tone="info">{c.unread_count}</StatusBadge>}
                </div>
              ))}
            </div>
          )}
        </Panel>

        <div className="space-y-4">
          <Panel
            title="Upcoming posts"
            action={
              <Link to="/calendar" className="inline-flex items-center gap-1 text-sm font-medium text-primary">
                Calendar <ArrowRight className="size-4" />
              </Link>
            }
          >
            {upcoming.length === 0 ? (
              <EmptyState
                icon={CalendarCheck}
                title="Nothing scheduled"
                description="Schedule a post to see it here."
              />
            ) : (
              <ul className="space-y-3">
                {upcoming.map((p) => (
                  <li key={p.id} className="flex items-start gap-3">
                    <PlatformBadge platform={p.platform} size="sm" />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{p.caption || "(no caption)"}</p>
                      <p className="text-xs text-muted-foreground">
                        {p.scheduled_at ? new Date(p.scheduled_at).toLocaleString() : ""}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          <Panel
            title="Automation usage"
            action={
              <Link to="/usage" className="inline-flex items-center gap-1 text-sm font-medium text-primary">
                Details <ArrowRight className="size-4" />
              </Link>
            }
          >
            <div className="space-y-4">
              <UsageMeter
                label="Replies this hour"
                used={usage.data?.sentLastHour ?? 0}
                limit={usage.data?.hourlyLimit || 1}
              />
              <UsageMeter
                label="Replies today"
                used={usage.data?.sentLastDay ?? 0}
                limit={usage.data?.dailyLimit || 1}
              />
              <Button asChild variant="outline" className="w-full">
                <Link to="/ai-assistant">
                  <Sparkles className="size-4" />
                  Ask the AI assistant
                </Link>
              </Button>
            </div>
          </Panel>

          <Panel
            title="Live automation activity"
            action={
              <span className="flex items-center gap-3">
                {workflowsOn && <Link to="/workflows" className="inline-flex items-center gap-1 text-sm font-medium text-primary">
                  Post workflows <ArrowRight className="size-4" />
                </Link>}
                <Link to="/automations" className="inline-flex items-center gap-1 text-sm font-medium text-primary">
                  Automations <ArrowRight className="size-4" />
                </Link>
              </span>
            }
          >
            {activityItems.length === 0 ? (
              <EmptyState
                icon={Zap}
                title="No activity yet"
                description="Every comment, DM, auto-reply, skip and failure shows up here in real time."
              />
            ) : (
              <ul className="space-y-3">
                {activityItems.slice(0, 10).map((item) => (
                  <li key={item.id} className="flex items-start gap-3">
                    <StatusBadge tone={item.tone}>{item.kind === "run" ? "rule" : "event"}</StatusBadge>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium leading-snug">{item.title}</p>
                      {item.hint && (
                        <p className="text-xs text-muted-foreground">{item.hint}</p>
                      )}
                      <p className="text-xs text-muted-foreground">
                        {new Date(item.at).toLocaleString()}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </div>
      </div>
    </AppShell>
  );
}
