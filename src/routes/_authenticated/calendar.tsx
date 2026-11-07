import { PlatformAccountFilter, matchesPlatformAccount } from "@/components/app/PlatformAccountFilter";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, CircleCheck, CircleX, Clock, Loader2, Plus } from "lucide-react";

import { AppShell } from "@/components/app/AppShell";
import { PublishingPageGate } from "@/components/app/PublishingPageGate";
import { PageHeader, Panel, StatusBadge } from "@/components/app/primitives";
import { PostComposer, type ComposerDraft } from "@/components/app/PostComposer";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useTenant } from "@/hooks/useTenant";
import { listSocialAccounts } from "@/lib/social-accounts.functions";
import { listPosts, runDuePosts, type Post } from "@/lib/publishing.functions";
import { listRecentRemotePosts } from "@/lib/automations.functions";
import { calendarPosts } from "@/lib/calendar-posts";
import { statusTone } from "./create-post";
import { formatLabel } from "@/components/app/PostListExtras";
import { findWorkspaceItem, itemSearch, workspaceItemId } from "@/lib/item-navigation";

export const Route = createFileRoute("/_authenticated/calendar")({
  validateSearch: (search) => itemSearch(search, "post"),
  head: () => ({
    meta: [
      { title: "Content Calendar — AutoDM by Techaasvik" },
      {
        name: "description",
        content: "Plan and schedule your content across every connected platform.",
      },
      { property: "og:title", content: "Content Calendar — AutoDM by Techaasvik" },
      {
        property: "og:description",
        content: "Plan and schedule your content across every connected platform.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: () => <PublishingPageGate feature="calendar"><CalendarPage /></PublishingPageGate>,
});

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function dayKey(date: Date) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function buildGrid(month: Date) {
  const first = new Date(month.getFullYear(), month.getMonth(), 1);
  const offset = (first.getDay() + 6) % 7; // Monday-first
  const start = new Date(first);
  start.setDate(first.getDate() - offset);
  return Array.from({ length: 42 }, (_, i) => {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    return d;
  });
}

function CalendarPage() {
  const { activeOrg } = useTenant();
  const queryClient = useQueryClient();
  const orgId = activeOrg?.id ?? "";
  const routeSearch = Route.useSearch();
  const navigate = Route.useNavigate();
  const requestedId = workspaceItemId(routeSearch.post, routeSearch.workspace, orgId);

  const fetchPosts = useServerFn(listPosts);
  const fetchRemote = useServerFn(listRecentRemotePosts);
  const fetchAccounts = useServerFn(listSocialAccounts);
  const flushDue = useServerFn(runDuePosts);

  const [month, setMonth] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const [accountId, setAccountId] = useState("all");
  const [platform, setPlatform] = useState("all");
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<ComposerDraft | null>(null);
  const [openedTarget, setOpenedTarget] = useState("");

  const postsQuery = useQuery({
    queryKey: ["posts", orgId],
    queryFn: () => fetchPosts({ data: { organizationId: orgId } }),
    enabled: Boolean(orgId),
    refetchInterval: 60_000,
  });

  const accountsQuery = useQuery({
    queryKey: ["social-accounts", orgId],
    queryFn: () => fetchAccounts({ data: { organizationId: orgId } }),
    enabled: Boolean(orgId),
  });

  const remoteQuery = useQuery({
    queryKey: ["remote-posts", orgId],
    meta: { background: true },
    gcTime: 30 * 60_000,
    queryFn: () => fetchRemote({ data: { organizationId: orgId } }),
    enabled: Boolean(orgId),
    staleTime: 10 * 60_000,
  });

  // Flush anything whose scheduled time has already passed whenever the page opens.
  useEffect(() => {
    if (!orgId) return;
    let cancelled = false;
    void flushDue({ data: { organizationId: orgId } })
      .then((result) => {
        if (!cancelled && result.published > 0) {
          void queryClient.invalidateQueries({ queryKey: ["posts", orgId] });
        }
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [orgId, flushDue, queryClient]);

  const posts = useMemo(() => calendarPosts(postsQuery.data ?? [], remoteQuery.data?.posts ?? [], orgId)
    .filter((p) => matchesPlatformAccount(p, platform, accountId)), [postsQuery.data, remoteQuery.data, orgId, platform, accountId]);
  const requestedPost = findWorkspaceItem(postsQuery.data ?? [], requestedId, orgId);
  useEffect(() => {
    const key = `${orgId}:${requestedId ?? ""}`;
    if (!requestedPost || key === openedTarget) return;
    setOpenedTarget(key);
    setPlatform("all");
    setAccountId("all");
    const at = requestedPost.scheduled_at ?? requestedPost.published_at;
    if (at && !Number.isNaN(new Date(at).getTime())) {
      const date = new Date(at);
      setMonth(new Date(date.getFullYear(), date.getMonth(), 1));
    }
    setDraft({ post: requestedPost });
    setOpen(true);
  }, [requestedPost, requestedId, orgId, openedTarget]);
  useEffect(() => {
    setOpen(false);
    setDraft(null);
    setOpenedTarget("");
  }, [orgId]);
  const changeOpen = (value: boolean) => {
    setOpen(value);
    if (!value && routeSearch.post) {
      setOpenedTarget("");
      void navigate({ search: {}, replace: true });
    }
  };

  const byDay = useMemo(() => {
    const map = new Map<string, Post[]>();
    for (const post of posts) {
      const iso = post.scheduled_at ?? post.published_at;
      if (!iso) continue;
      const key = dayKey(new Date(iso));
      const list = map.get(key) ?? [];
      list.push(post);
      map.set(key, list);
    }
    for (const list of map.values()) {
      list.sort((a, b) =>
        (a.scheduled_at ?? "").localeCompare(b.scheduled_at ?? ""),
      );
    }
    return map;
  }, [posts]);

  const grid = useMemo(() => buildGrid(month), [month]);
  const todayKey = dayKey(new Date());
  const drafts = posts.filter((p) => p.status === "draft" && !p.scheduled_at);

  const openOn = (date: Date) => {
    const at = new Date(date);
    at.setHours(10, 0, 0, 0);
    setDraft({ scheduledAt: at.toISOString() });
    setOpen(true);
  };

  const shiftMonth = (delta: number) =>
    setMonth((m) => new Date(m.getFullYear(), m.getMonth() + delta, 1));

  return (
    <AppShell>
      <PageHeader
        title="Content Calendar"
        description="Plan and schedule your content across every connected platform."
        actions={
          <div className="flex min-w-0 flex-nowrap items-center gap-2 overflow-x-auto">
            <PlatformAccountFilter orgId={orgId || null} platform={platform} onPlatformChange={setPlatform} accountId={accountId} onAccountChange={setAccountId} />
            <Button asChild>
              <Link to="/create-post/new">
                <Plus className="mr-2 size-4" /> New post
              </Link>
            </Button>
          </div>
        }
      />

      {routeSearch.post && (!requestedId || (postsQuery.isSuccess && !requestedPost)) && <div role="alert" className="mb-4 flex flex-wrap items-center justify-between gap-3 border-l-2 border-warning bg-warning-soft px-4 py-3 text-sm"><span>This post is unavailable in the current workspace.</span><Button variant="outline" size="sm" onClick={() => void navigate({ search: {}, replace: true })}>Back to calendar</Button></div>}
      <Panel
        title={month.toLocaleDateString("en-IN", { month: "long", year: "numeric" })}
        bodyClassName="p-0"
        action={
          <div className="flex items-center gap-1">
            <Button size="icon" variant="ghost" onClick={() => shiftMonth(-1)} aria-label="Previous month">
              <ChevronLeft className="size-4" />
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                const now = new Date();
                setMonth(new Date(now.getFullYear(), now.getMonth(), 1));
              }}
            >
              Today
            </Button>
            <Button size="icon" variant="ghost" onClick={() => shiftMonth(1)} aria-label="Next month">
              <ChevronRight className="size-4" />
            </Button>
          </div>
        }
      >
        {postsQuery.isLoading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="size-5 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <div className="min-w-[680px]">
              <div className="grid grid-cols-7 border-b">
                {WEEKDAYS.map((day) => (
                  <div
                    key={day}
                    className="px-2 py-2 text-center text-xs font-medium text-muted-foreground"
                  >
                    {day}
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-7">
                {grid.map((date) => {
                  const key = dayKey(date);
                  const items = byDay.get(key) ?? [];
                  const inMonth = date.getMonth() === month.getMonth();
                  return (
                    <button
                      type="button"
                      key={key}
                      onClick={() => openOn(date)}
                      className={cn(
                        "min-h-24 border-r border-b p-2 text-left align-top transition-colors hover:bg-surface-secondary",
                        !inMonth && "bg-surface-secondary/40 text-subtle-foreground",
                      )}
                    >
                      <span
                        className={cn(
                          "num inline-flex size-6 items-center justify-center rounded-md text-xs",
                          key === todayKey && "bg-primary text-primary-foreground",
                        )}
                      >
                        {date.getDate()}
                      </span>
                      <div className="mt-1 space-y-1">
                        {items.slice(0, 3).map((post) => (
                          <span
                            key={post.id}
                            onClick={(event) => {
                              event.stopPropagation();
                              if (post.id.startsWith("remote:")) {
                                if (post.permalink) window.open(post.permalink, "_blank", "noopener,noreferrer");
                                return;
                              }
                              setDraft({ post });
                              setOpen(true);
                            }}
                            title={post.status}
                            className={cn(
                              "flex items-center gap-1 truncate rounded-md border bg-surface-secondary px-1.5 py-1 text-[11px]",
                              post.status === "published" ? "border-success/40" : post.status === "failed" ? "border-destructive/40" : "border-info/40",
                            )}
                          >
                            {post.status === "published" ? (
                              <CircleCheck className="size-3.5 shrink-0 text-success" strokeWidth={2.25} aria-label="Published" />
                            ) : post.status === "failed" ? (
                              <CircleX className="size-3.5 shrink-0 text-destructive" strokeWidth={2.25} aria-label="Failed" />
                            ) : (
                              <Clock className="size-3.5 shrink-0 text-info" strokeWidth={2.25} aria-label="Scheduled" />
                            )}
                            <span className="truncate">
                            {new Date(post.scheduled_at ?? post.published_at ?? "").toLocaleTimeString(
                              "en-IN",
                              { hour: "numeric", minute: "2-digit" },
                            )}{" "}
                            · {post.platform} {formatLabel(post.post_format)}
                            </span>
                          </span>
                        ))}
                        {items.length > 3 && (
                          <span className="block text-[11px] text-muted-foreground">
                            +{items.length - 3} more
                          </span>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </Panel>

      {drafts.length > 0 && (
        <Panel title="Unscheduled drafts" className="mt-6" bodyClassName="p-0">
          <ul className="divide-y">
            {drafts.map((post) => (
              <li key={post.id} className="flex items-center gap-3 px-5 py-3">
                <button
                  type="button"
                  className="min-w-0 flex-1 truncate text-left text-sm"
                  onClick={() => {
                    setDraft({ post });
                    setOpen(true);
                  }}
                >
                  {post.caption.trim() || "(no caption)"}
                </button>
                <StatusBadge tone={statusTone[post.status]}>{post.status}</StatusBadge>
              </li>
            ))}
          </ul>
        </Panel>
      )}

      {orgId && (
        <PostComposer
          open={open}
          onOpenChange={changeOpen}
          organizationId={orgId}
          accounts={accountsQuery.data ?? []}
          draft={draft}
        />
      )}
    </AppShell>
  );
}
