import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useWorkflowsEnabled } from "@/hooks/useWorkflowsEnabled";
import {
  ArrowRight,
  AlertCircle,
  CheckCircle2,
  PenSquare,
  RefreshCw,
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
  Circle,
  ShoppingBag,
  IndianRupee,
  Users,
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
import { useWorkspaceFeatures } from "@/hooks/useWorkspaceFeatures";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { getAnalytics } from "@/lib/analytics.functions";
import { getAutomationUsage, listOrgActivityFeed } from "@/lib/automations.functions";
import { listConversations } from "@/lib/inbox.functions";
import { listPosts } from "@/lib/publishing.functions";
import { listSocialAccounts } from "@/lib/social-accounts.functions";
import { getRevenue } from "@/lib/revenue.functions";
import { summarizeDashboardLeads } from "@/lib/dashboard-summary";

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
  const features = useWorkspaceFeatures().data;
  const [rangeDays, setRangeDays] = useState(7);
  const orgId = activeOrg?.id ?? null;
  const firstName = profile.name.split(" ")[0] || "there";

  const fetchAnalytics = useServerFn(getAnalytics);
  const fetchAccounts = useServerFn(listSocialAccounts);
  const fetchPosts = useServerFn(listPosts);
  const fetchConversations = useServerFn(listConversations);
  const fetchUsage = useServerFn(getAutomationUsage);
  const fetchRevenue = useServerFn(getRevenue);
  const revenueEnabled = Boolean(features) && features?.revenue !== "hidden";
  const revenue = useQuery({
    queryKey: ["revenue", orgId, "all"],
    enabled: Boolean(orgId) && revenueEnabled,
    staleTime: 60_000,
    queryFn: () => fetchRevenue({ data: { organizationId: orgId ?? "" } }),
  });

  const analytics = useQuery({
    queryKey: ["analytics", orgId, rangeDays],
    enabled: !!orgId,
    refetchInterval: 60_000,
    queryFn: () => fetchAnalytics({ data: { organizationId: orgId ?? "", rangeDays } }),
  });
  const accounts = useQuery({
    queryKey: ["social-accounts", orgId],
    enabled: !!orgId,
    queryFn: () => fetchAccounts({ data: { organizationId: orgId ?? "" } }),
  });
  const posts = useQuery({
    queryKey: ["posts", orgId],
    enabled: !!orgId,
    queryFn: () => fetchPosts({ data: { organizationId: orgId ?? "" } }),
  });
  const conversations = useQuery({
    queryKey: ["conversations", orgId, "dashboard"],
    enabled: !!orgId,
    refetchInterval: 60_000,
    queryFn: () => fetchConversations({ data: { organizationId: orgId ?? "" } }),
  });
  const usage = useQuery({
    queryKey: ["automation-usage", orgId],
    enabled: !!orgId,
    queryFn: () => fetchUsage({ data: { organizationId: orgId ?? "" } }),
  });
  const fetchActivity = useServerFn(listOrgActivityFeed);
  const activity = useQuery({
    queryKey: ["org-activity", orgId],
    enabled: !!orgId,
    refetchInterval: 30_000,
    queryFn: () => fetchActivity({ data: { organizationId: orgId ?? "" } }),
  });
  const activityItems = activity.data ?? [];

  const a = analytics.data;
  const [needAccount, setNeedAccount] = useState(false);
  const hasAccount = (accounts.data ?? []).length > 0;
  const accountRows = accounts.data ?? [];
  const upcoming = (posts.data ?? [])
    .filter((p) => p.status === "scheduled" && p.scheduled_at)
    .sort((x, y) => (x.scheduled_at ?? "").localeCompare(y.scheduled_at ?? ""))
    .slice(0, 5);
  const recentThreads = (conversations.data ?? []).slice(0, 5);
  const attentionAccounts = accountRows.filter((account) => account.status !== "connected");
  const failedPosts = (posts.data ?? []).filter((post) => post.status === "failed");
  const calendarVisible = features?.calendar !== "hidden" && Boolean(features);
  const postVisible = features?.create_post !== "hidden" && Boolean(features);
  const leadSummary = summarizeDashboardLeads(revenue.data?.leads ?? []);
  const setupSteps = [
    { label: "Connect a social account", to: "/social-accounts" as const, complete: accountRows.some((account) => account.status === "connected"), ready: accounts.isSuccess },
    { label: "Activate an automation", to: "/automations" as const, complete: (a?.totals.activeRules ?? 0) + (a?.totals.activeFlows ?? 0) > 0, ready: analytics.isSuccess },
    ...(features?.revenue === "enabled" && features?.delivery_pages === "enabled" ? [{ label: "Activate a delivery page", to: "/revenue" as const, complete: (revenue.data?.pages ?? []).some((page: { active: boolean }) => page.active), ready: revenue.isSuccess }] : []),
  ];
  const setupReady = setupSteps.every((step) => step.ready);
  const setupComplete = setupSteps.filter((step) => step.complete).length;
  const isRefreshing = analytics.isFetching || accounts.isFetching || posts.isFetching || conversations.isFetching || usage.isFetching || activity.isFetching || (revenueEnabled && revenue.isFetching);
  const refreshOverview = () => {
    void analytics.refetch(); void accounts.refetch(); void posts.refetch();
    void conversations.refetch(); void usage.refetch(); void activity.refetch();
    if (revenueEnabled) void revenue.refetch();
  };
  const dataError = analytics.isError || accounts.isError || posts.isError || conversations.isError || usage.isError || activity.isError || (revenueEnabled && revenue.isError);

  return (
    <AppShell>
      <PageHeader
        title={`${greeting()}, ${firstName}`}
        description={`${activeOrg?.name ?? "Your workspace"} · Last ${rangeDays} days`}
        actions={
          <>
          <Button variant="outline" size="icon" onClick={refreshOverview} disabled={isRefreshing} aria-label="Refresh overview" title="Refresh overview">
            <RefreshCw className={isRefreshing ? "size-4 animate-spin" : "size-4"} />
          </Button>
          {hasAccount ? (
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
          )}
          </>
        }
      />

      <AutomationNotificationBanner />
      {dataError && (
        <div role="alert" className="mb-5 flex flex-wrap items-center justify-between gap-3 border-l-2 border-warning bg-warning-soft px-4 py-3 text-sm">
          <span>Some overview data couldn’t be refreshed.</span>
          <Button variant="outline" size="sm" onClick={refreshOverview}><RefreshCw className="size-4" />Try again</Button>
        </div>
      )}
      <section aria-label="Quick actions" className="mb-6 flex flex-wrap gap-2 border-y py-4">
        <Button asChild variant="outline"><Link to="/inbox"><InboxIcon className="size-4" />Open inbox</Link></Button>
        {postVisible && <Button asChild variant="outline"><Link to="/create-post"><PenSquare className="size-4" />Create post{features?.create_post === "coming_soon" && <span className="text-xs text-muted-foreground">Coming soon</span>}</Link></Button>}
        <Button asChild variant="outline"><Link to="/social-accounts"><Share2 className="size-4" />Connect account</Link></Button>
        {features?.revenue === "enabled" && <Button asChild variant="outline"><Link to="/revenue"><TrendingUp className="size-4" />Sales & Revenue</Link></Button>}
      </section>
      <section aria-label="Needs attention" className="mb-6">
        <div className="mb-3 flex items-center gap-2">
          <AlertCircle className="size-4 text-warning" /><h2 className="text-lg font-semibold">Needs attention</h2>
        </div>
        <div className="flex flex-wrap gap-x-6 gap-y-3 border-b pb-4 text-sm">
          {!hasAccount && accounts.isSuccess && <Button asChild variant="link" className="h-auto p-0"><Link to="/social-accounts">Connect your first account<ArrowRight className="size-4" /></Link></Button>}
          {attentionAccounts.length > 0 && <Button asChild variant="link" className="h-auto p-0 text-warning"><Link to="/social-accounts">{attentionAccounts.length} account{attentionAccounts.length === 1 ? "" : "s"} need attention<ArrowRight className="size-4" /></Link></Button>}
          {(a?.totals.unread ?? 0) > 0 && <Button asChild variant="link" className="h-auto p-0"><Link to="/inbox">{a?.totals.unread} unread messages<ArrowRight className="size-4" /></Link></Button>}
          {postVisible && failedPosts.length > 0 && <Button asChild variant="link" className="h-auto p-0 text-danger"><Link to="/create-post">{failedPosts.length} failed posts<ArrowRight className="size-4" /></Link></Button>}
          {accounts.isSuccess && analytics.isSuccess && posts.isSuccess && hasAccount && attentionAccounts.length === 0 && (a?.totals.unread ?? 0) === 0 && (!postVisible || failedPosts.length === 0) && <span className="inline-flex items-center gap-2 text-muted-foreground"><CheckCircle2 className="size-4 text-success" />You’re all caught up</span>}
        </div>
      </section>
      {setupReady && setupComplete < setupSteps.length && (
        <section aria-label="Workspace setup" className="mb-6 border-b pb-5">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-lg font-semibold">Workspace setup</h2>
            <span className="text-sm text-muted-foreground">{setupComplete} of {setupSteps.length} complete</span>
          </div>
          <div className="flex flex-wrap gap-3">
            {setupSteps.map((step) => (
              <Button key={step.to} asChild variant="outline" className="h-auto min-h-10 max-w-full whitespace-normal py-2 text-left">
                <Link to={step.to}>
                  {step.complete ? <CheckCircle2 className="size-4 shrink-0 text-success" /> : <Circle className="size-4 shrink-0 text-muted-foreground" />}
                  {step.label}
                  {!step.complete && <ArrowRight className="size-4 shrink-0" />}
                </Link>
              </Button>
            ))}
          </div>
        </section>
      )}
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
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold">Workspace performance</h2>
        <ToggleGroup type="single" value={String(rangeDays)} onValueChange={(value) => { if (value) setRangeDays(Number(value)); }} aria-label="Analytics period" variant="outline">
          <ToggleGroupItem value="7" aria-label="Last 7 days">7 days</ToggleGroupItem>
          <ToggleGroupItem value="30" aria-label="Last 30 days">30 days</ToggleGroupItem>
        </ToggleGroup>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard info="All chat threads (DMs and comments) and how many are open." icon={MessagesSquare} label="Conversations" value={String(a?.totals.conversations ?? 0)} sub={`${a?.totals.openThreads ?? 0} open`} />
        <StatCard info="Messages and comments people sent you in the selected period." icon={MessageSquare} label="Messages received" value={String(a?.totals.inbound ?? 0)} sub={`${a?.totals.unread ?? 0} unread`} />
        <StatCard info="Replies sent in the selected period, manual and automated." icon={Send} label="Replies sent" value={String(a?.totals.outbound ?? 0)} sub={`${a?.totals.automated ?? 0} automated`} />
        <StatCard info="Percentage of people who got at least one reply, and the typical time to first reply." icon={UserCheck} label="Answered" value={`${a?.responseRate ?? 0}%`} sub={`Median ${a?.medianFirstResponseMinutes ?? 0} min`} />
        <StatCard info="Posts published from this tool, plus how many are scheduled." icon={CalendarCheck} label="Posts published" value={String(a?.totals.postsPublished ?? 0)} sub={`${a?.totals.postsScheduled ?? 0} scheduled`} />
        <StatCard info="Out of all replies sent, the percentage sent automatically." icon={TrendingUp} label="Automation share" value={`${a?.automationShare ?? 0}%`} sub="Of all replies" />
        <StatCard info="Automations switched on right now: keyword rules plus Flow Builder flows." icon={Workflow} label="Active automations" value={String((a?.totals.activeRules ?? 0) + (a?.totals.activeFlows ?? 0))} sub={`${a?.totals.activeRules ?? 0} rules · ${a?.totals.activeFlows ?? 0} flows`} />
        <StatCard info="Automations that ran and sent something in the selected period. One run counts once, however many steps." icon={Zap} label="Automation runs" value={String(a?.totals.automationRuns ?? 0)} sub={`Last ${rangeDays} days`} />
      </div>

      {revenueEnabled && (
        <section aria-label="Leads and sales" className="mt-6 border-y py-5">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-lg font-semibold">Leads & sales</h2>
            <Button asChild variant="link" className="h-auto p-0"><Link to="/revenue">Sales & Revenue<ArrowRight className="size-4" /></Link></Button>
          </div>
          {revenue.isSuccess ? <>
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <StatCard icon={IndianRupee} label="Collected revenue" value={new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 2 }).format(revenue.data.funnel.revenuePaise / 100)} sub="Last 30 days · recorded payments" />
              <StatCard icon={ShoppingBag} label="Successful payments" value={String(revenue.data.funnel.paid)} sub="Last 30 days" />
              <StatCard icon={Users} label="Completed forms" value={String(leadSummary.completed)} sub="Within latest captured leads" />
              <StatCard icon={UserCheck} label="Incomplete forms" value={String(leadSummary.incomplete)} sub="Form / OTP / sign-in unfinished" />
            </div>
            <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
              <span>Lead summary: latest {leadSummary.captured} captured leads (up to 200); sales: last 30 days.</span>
              <Button asChild variant="link" size="sm" className="h-auto p-0"><Link to="/contacts">Open contacts<ArrowRight className="size-3" /></Link></Button>
            </div>
          </> : <p className="text-sm text-muted-foreground" role="status">{revenue.isError ? "Sales summary is unavailable. Try refreshing the overview." : "Loading sales summary…"}</p>}
        </section>
      )}

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
                <Tooltip contentStyle={{ background: "var(--color-popover)", borderColor: "var(--color-border)", color: "var(--color-popover-foreground)" }} />
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
                <div key={acc.id} className="flex min-w-0 flex-wrap items-center justify-between gap-3 border-b pb-3 last:border-0 last:pb-0">
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
                <Link to="/inbox" search={{ conversation: c.id, workspace: orgId ?? undefined }} key={c.id} className="flex items-center gap-3 rounded-lg border px-4 py-3 transition-colors hover:bg-surface-secondary">
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
                  <ArrowRight className="size-4 shrink-0 text-muted-foreground" />
                </Link>
              ))}
              <Link to="/inbox" className="inline-flex items-center gap-1 pt-1 text-sm font-medium text-primary">
                View more <ArrowRight className="size-4" />
              </Link>
            </div>
          )}
        </Panel>

        <div className="space-y-4">
          {calendarVisible && <Panel
            title="Upcoming posts"
            action={
              <Link to="/calendar" className="inline-flex items-center gap-1 text-sm font-medium text-primary">
                {features?.calendar === "coming_soon" ? "Coming soon" : "Calendar"} <ArrowRight className="size-4" />
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
                    <Link to="/calendar" search={{ post: p.id, workspace: orgId ?? undefined }} className="flex min-w-0 flex-1 items-start gap-3 rounded-md p-1 transition-colors hover:bg-surface-secondary">
                    <PlatformBadge platform={p.platform} size="sm" />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{p.caption || "(no caption)"}</p>
                      <p className="text-xs text-muted-foreground">
                        {p.scheduled_at ? new Date(p.scheduled_at).toLocaleString() : ""}
                      </p>
                    </div>
                    <ArrowRight className="size-4 shrink-0 text-muted-foreground" />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Panel>}

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
              {features?.ai === "enabled" && <Button asChild variant="outline" className="w-full">
                <Link to="/ai-assistant">
                  <Sparkles className="size-4" />
                  Ask the AI assistant
                </Link>
              </Button>}
            </div>
          </Panel>

          <Panel
            title="Live automation activity"
            action={
              <span className="flex items-center gap-3">
                {(features ? features.workflows === "enabled" : workflowsOn) && <Link to="/workflows" className="inline-flex items-center gap-1 text-sm font-medium text-primary">
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
                {activityItems.slice(0, 5).map((item) => (
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
            {activityItems.length > 5 && (
              <Link to="/automations" className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-primary">
                View more <ArrowRight className="size-4" />
              </Link>
            )}
          </Panel>
        </div>
      </div>
      <section className="mt-8 border-t pt-6" aria-labelledby="dashboard-templates-title">
        <h2 id="dashboard-templates-title" className="mb-4 text-lg font-semibold">Automation templates</h2>
        <TemplateSlider canCreate={hasAccount} onNeedAccount={() => setNeedAccount(true)} />
      </section>
    </AppShell>
  );
}
