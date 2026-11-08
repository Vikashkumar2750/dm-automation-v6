import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Link } from "@tanstack/react-router";
import { AlertTriangle, Bell, Check, CheckCheck, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useTenant, useSession } from "@/hooks/useTenant";
import { listAutomationRuns, listAutomationRules, type AutomationRun } from "@/lib/automations.functions";
import { activityName, activitySource, explainReason } from "@/lib/activity-explain";
import { notificationRuns, notificationStorageKey, workspaceAttention, type WorkspaceAttention } from "@/lib/automation-notifications";
import { listSocialAccounts } from "@/lib/social-accounts.functions";
import { listPosts } from "@/lib/publishing.functions";
import { getAnalytics } from "@/lib/analytics.functions";
import { useWorkspaceFeatures } from "@/hooks/useWorkspaceFeatures";

type NotificationState = {
  runs: AutomationRun[]; unread: AutomationRun[]; readIds: string[];
  attention: WorkspaceAttention[]; unreadIds: string[];
  loading: boolean; error: boolean; name: (run: AutomationRun) => string;
  markRead: (ids: string[]) => void; refresh: () => void;
};
const Notifications = createContext<NotificationState | null>(null);

export function AutomationNotificationsProvider({ children }: { children: ReactNode }) {
  const { activeOrg } = useTenant();
  const { user } = useSession();
  const orgId = activeOrg?.id;
  const userId = user?.id;
  const client = useQueryClient();
  const fetchRuns = useServerFn(listAutomationRuns);
  const fetchRules = useServerFn(listAutomationRules);
  const fetchAccounts = useServerFn(listSocialAccounts);
  const fetchPosts = useServerFn(listPosts);
  const fetchAnalytics = useServerFn(getAnalytics);
  const features = useWorkspaceFeatures().data;
  const enabled = Boolean(userId && orgId);
  const accounts = useQuery({
    queryKey: ["social-accounts", orgId], enabled, staleTime: 30_000, refetchInterval: 60_000,
    queryFn: () => fetchAccounts({ data: { organizationId: orgId ?? "" } }),
  });
  const posts = useQuery({
    queryKey: ["posts", orgId], enabled: enabled && Boolean(features) && features?.create_post !== "hidden", staleTime: 30_000, refetchInterval: 60_000,
    queryFn: () => fetchPosts({ data: { organizationId: orgId ?? "" } }),
  });
  const analytics = useQuery({
    queryKey: ["analytics", orgId, 7], enabled, staleTime: 30_000, refetchInterval: 60_000,
    queryFn: () => fetchAnalytics({ data: { organizationId: orgId ?? "", rangeDays: 7 } }),
  });
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => setHydrated(true), []);
  const key = userId && orgId ? notificationStorageKey(userId, orgId) : null;
  const reads = useQuery({
    queryKey: ["notification-reads", key], enabled: hydrated && Boolean(key), staleTime: Infinity,
    queryFn: (): string[] => {
      try {
        const saved: unknown = JSON.parse(localStorage.getItem(key ?? "") ?? "[]");
        return Array.isArray(saved) ? saved.filter((id): id is string => typeof id === "string") : [];
      } catch { return []; }
    },
  });
  const runsQuery = useQuery({
    queryKey: ["automation-notifications", userId, orgId], enabled: Boolean(userId && orgId),
    refetchInterval: 15_000, staleTime: 10_000,
    queryFn: () => {
      if (!orgId) throw new Error("No workspace selected");
      return fetchRuns({ data: { organizationId: orgId, limit: 500 } });
    },
  });
  const rulesQuery = useQuery({
    queryKey: ["automation-rules", orgId], enabled: Boolean(userId && orgId),
    queryFn: () => {
      if (!orgId) throw new Error("No workspace selected");
      return fetchRules({ data: { organizationId: orgId } });
    },
  });
  const runs = notificationRuns(runsQuery.data ?? [], Date.now());
  const readIds = reads.data ?? [];
  const unread = reads.isSuccess ? runs.filter((run) => !readIds.includes(run.id)) : [];
  const attention = workspaceAttention({
    accounts: accounts.isSuccess ? accounts.data : undefined,
    unread: analytics.isSuccess ? analytics.data?.totals.unread : undefined,
    posts: posts.isSuccess ? posts.data : undefined,
    postsVisible: Boolean(features) && features?.create_post !== "hidden",
  });
  const unreadIds = reads.isSuccess ? [...unread.map((run) => run.id), ...attention.filter((item) => !readIds.includes(item.id)).map((item) => item.id)] : [];
  const markRead = (ids: string[]) => {
    if (!key) return;
    const saved = [...new Set([...(client.getQueryData<string[]>(["notification-reads", key]) ?? []), ...ids])].slice(-2000);
    client.setQueryData(["notification-reads", key], saved);
    try { localStorage.setItem(key, JSON.stringify(saved)); } catch { /* Session read state remains available. */ }
  };
  return <Notifications.Provider value={{ runs, unread, readIds, attention, unreadIds,
    loading: runsQuery.isLoading || reads.isLoading || accounts.isLoading || analytics.isLoading || posts.isLoading, error: runsQuery.isError || accounts.isError || analytics.isError || posts.isError,
    name: (run) => activityName(run, (id) => rulesQuery.data?.find((r) => r.id === id)?.name ?? "Deleted rule"),
    markRead, refresh: () => { void runsQuery.refetch(); void accounts.refetch(); void analytics.refetch(); if (features?.create_post !== "hidden" && features) void posts.refetch(); },
  }}>{children}</Notifications.Provider>;
}

export function AutomationNotificationBell() {
  const state = useContext(Notifications);
  if (!state) return null;
  return <Popover>
    <PopoverTrigger asChild>
      <Button variant="ghost" size="icon" className="relative" aria-label={`Notifications${state.unreadIds.length ? `, ${state.unreadIds.length} unread` : ""}`}>
        <Bell className="size-5" />
        {state.unreadIds.length > 0 && <span className="absolute -top-1 -right-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-warning px-1 text-xs font-semibold text-warning-foreground">{state.unreadIds.length > 99 ? "99+" : state.unreadIds.length}</span>}
      </Button>
    </PopoverTrigger>
    <PopoverContent align="end" className="w-96 max-w-[calc(100vw-1.5rem)] p-0" aria-label="Workspace notifications">
      <div className="flex items-center justify-between gap-2 border-b p-3">
        <div><h2 className="text-sm font-semibold">Notifications</h2><p className="text-xs text-muted-foreground">Workspace attention & recent automation alerts</p></div>
        <Button variant="ghost" size="icon" title="Mark all as read" aria-label="Mark all as read" disabled={!state.unreadIds.length} onClick={() => state.markRead(state.unreadIds)}><CheckCheck className="size-4" /></Button>
      </div>
      <div className="max-h-96 overflow-y-auto">
        {state.attention.map((item) => {
          const unread = !state.readIds.includes(item.id);
          const title = item.kind === "messages" ? `${item.count} unread messages` : item.kind === "posts" ? `${item.count} failed post${item.count === 1 ? "" : "s"}` : item.count ? `${item.count} account${item.count === 1 ? "" : "s"} need attention` : "Connect your first account";
          return <div key={item.id} className={`flex items-start gap-2 border-b p-3 ${unread ? "bg-warning/5" : ""}`}>
            <AlertTriangle className="mt-1 size-4 shrink-0 text-warning" />
            <div className="min-w-0 flex-1"><Link to={item.to} className="break-words text-sm font-medium text-primary" onClick={() => state.markRead([item.id])}>{title}</Link></div>
            <Button size="icon" variant="ghost" aria-label="Mark as read" title={unread ? "Mark as read" : "Read"} disabled={!unread} onClick={() => state.markRead([item.id])}><Check className="size-4" /></Button>
          </div>;
        })}
        {state.error && <div className="p-4"><p className="text-sm text-destructive">Some notifications couldn’t load.</p><Button variant="ghost" size="sm" onClick={state.refresh}><RefreshCw className="size-4" />Retry</Button></div>}
        {state.loading ? <p className="p-4 text-sm text-muted-foreground">Loading notifications…</p> : !state.runs.length && !state.attention.length && !state.error ? <p className="p-4 text-sm text-muted-foreground">You’re all caught up.</p> : null}
        {state.runs.length > 0 && <p className="border-b px-3 py-2 text-xs text-muted-foreground">Automation skips & failures · last 24 hours</p>}
        {state.runs.map((run) => {
          const reason = explainReason(run.detail);
          const unread = !state.readIds.includes(run.id);
          return <div key={run.id} className={`flex items-start gap-2 border-b p-3 ${unread ? "bg-warning/5" : ""}`}>
            <AlertTriangle className={`mt-1 size-4 shrink-0 ${run.status === "failed" ? "text-destructive" : "text-warning"}`} />
            <div className="min-w-0 flex-1 space-y-1">
              <p className="break-words text-sm font-semibold">{state.name(run)} · {run.status === "failed" ? "Failed" : "Skipped"}</p>
              <p className="break-words text-sm">{reason.title}</p>
              {reason.hint && <p className="break-words text-xs text-muted-foreground">{reason.hint}</p>}
              <p className="text-xs text-muted-foreground">{run.contact ? `${run.contact.platform}${run.contact.name ? ` · @${run.contact.name}` : ""} · ` : ""}{new Date(run.created_at).toLocaleString()}</p>
              <Link to="/automations/activity/$runId" params={{ runId: run.id }} search={{ source: activitySource(run), filter: run.status === "failed" ? "failed" : "skipped" }} className="inline-block text-xs font-medium text-primary" onClick={() => state.markRead([run.id])}>View in Activity</Link>
            </div>
            <Button size="icon" variant="ghost" aria-label="Mark as read" title={unread ? "Mark as read" : "Read"} disabled={!unread} onClick={() => state.markRead([run.id])}><Check className="size-4" /></Button>
          </div>;
        })}
      </div>
      <div className="border-t p-3"><Link to="/account-health" className="text-xs font-medium text-primary">Account health</Link></div>
    </PopoverContent>
  </Popover>;
}

export function AutomationNotificationBanner() {
  const state = useContext(Notifications);
  const first = state?.unread[0];
  if (!state || !first) return null;
  const failed = state.unread.filter((r) => r.status === "failed").length;
  const skipped = state.unread.length - failed;
  return <section aria-label="Automation alerts" className="mb-4 flex flex-wrap items-start gap-3 border-y border-warning/40 bg-warning/10 px-4 py-3">
    <AlertTriangle className="mt-0.5 size-5 shrink-0 text-warning" />
    <div className="min-w-0 flex-1"><h2 className="text-sm font-semibold">{[skipped ? `${skipped} skipped` : "", failed ? `${failed} failed` : ""].filter(Boolean).join(" · ")} automation alerts</h2><p className="break-words text-sm text-muted-foreground">{state.name(first)} — {explainReason(first.detail).title}</p></div>
    <div className="flex flex-wrap gap-2">
      <Button size="sm" variant="outline" asChild><Link to="/automations/activity/$runId" params={{ runId: first.id }} search={{ source: activitySource(first), filter: first.status === "failed" ? "failed" : "skipped" }} onClick={() => state.markRead([first.id])}>View details</Link></Button>
      <Button size="sm" variant="ghost" onClick={() => state.markRead(state.unread.map((r) => r.id))}><CheckCheck className="size-4" />Mark all as read</Button>
    </div>
  </section>;
}