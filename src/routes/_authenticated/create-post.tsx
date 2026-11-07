import { Pager, pageSlice } from "@/components/app/Pager";
import { PlatformAccountFilter, matchesPlatformAccount } from "@/components/app/PlatformAccountFilter";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { Copy, Loader2, Pencil, PenSquare, Plus, Send, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { AppShell } from "@/components/app/AppShell";
import { PublishingPageGate } from "@/components/app/PublishingPageGate";
import {
  EmptyState,
  PageHeader,
  Panel,
  PlatformBadge,
  StatusBadge,
} from "@/components/app/primitives";
import { PostComposer, type ComposerDraft } from "@/components/app/PostComposer";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FORMAT_TABS, FormatBadge, PostMediaThumb, StatsRow, formatKey, type FormatTab } from "@/components/app/PostListExtras";
import { useTenant } from "@/hooks/useTenant";
import { useWorkspaceAccountFilter } from "@/hooks/useWorkspaceAccountFilter";
import { ConnectedAccountLabel } from "@/components/app/ConnectedAccountLabel";
import { listSocialAccounts } from "@/lib/social-accounts.functions";
import { listRecentRemotePosts } from "@/lib/automations.functions";
import {
  deletePost,
  editPublishedCaption,
  editYouTubeDetails,
  getPostStats,
  listPosts,
  publishNow,
  type Post,
} from "@/lib/publishing.functions";

export const Route = createFileRoute("/_authenticated/create-post")({
  head: () => ({
    meta: [
      { title: "Create Post — AutoDM by Techaasvik" },
      {
        name: "description",
        content: "Compose once, schedule and publish to Instagram and Facebook.",
      },
      { property: "og:title", content: "Create Post — AutoDM by Techaasvik" },
      {
        property: "og:description",
        content: "Compose once, schedule and publish to Instagram and Facebook.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: () => <PublishingPageGate feature="create_post"><CreatePostPage /></PublishingPageGate>,
});

export const statusTone = {
  draft: "neutral",
  scheduled: "info",
  publishing: "warning",
  published: "success",
  failed: "danger",
} as const;

export function formatWhen(iso: string | null) {
  if (!iso) return "No date";
  return new Date(iso).toLocaleString("en-IN", {
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
  });
}

function CreatePostPage() {
  const { activeOrg } = useTenant();
  const queryClient = useQueryClient();
  const orgId = activeOrg?.id ?? "";

  const fetchPosts = useServerFn(listPosts);
  const fetchAccounts = useServerFn(listSocialAccounts);
  const publish = useServerFn(publishNow);
  const remove = useServerFn(deletePost);
  const editLive = useServerFn(editPublishedCaption);
  const fetchStats = useServerFn(getPostStats);
  const [tab, setTab] = useState<FormatTab>("all");
  const [page, setPage] = useState(1);
  const [toDelete, setToDelete] = useState<Post | null>(null);
  const [liveEdit, setLiveEdit] = useState<{ post: Post; caption: string } | null>(null);
  const [ytEdit, setYtEdit] = useState<{ post: Post; title: string; description: string; tags: string } | null>(null);
  const editYt = useServerFn(editYouTubeDetails);
  const { platform: platformFilter, setPlatform: setPlatformFilter, accountId: accountFilter, setAccountId: setAccountFilter } = useWorkspaceAccountFilter(orgId);
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [range, setRange] = useState<"all" | "7" | "30" | "custom">("all");

  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<ComposerDraft | null>(null);

  const postsQuery = useQuery({
    queryKey: ["posts", orgId],
    queryFn: () => fetchPosts({ data: { organizationId: orgId } }),
    enabled: Boolean(orgId),
  });

  const fetchRemote = useServerFn(listRecentRemotePosts);
  const remoteQuery = useQuery({
    queryKey: ["remote-posts", orgId],
    meta: { background: true },
    gcTime: 30 * 60_000,
    queryFn: () => fetchRemote({ data: { organizationId: orgId } }),
    enabled: Boolean(orgId),
    staleTime: 10 * 60_000,
  });

  const accountsQuery = useQuery({
    queryKey: ["social-accounts", orgId],
    queryFn: () => fetchAccounts({ data: { organizationId: orgId } }),
    enabled: Boolean(orgId),
  });

  const invalidate = () =>
    void queryClient.invalidateQueries({ queryKey: ["posts", orgId] });

  const publishMutation = useMutation({
    mutationFn: (id: string) => publish({ data: { id } }),
    onSuccess: () => {
      toast.success("Published");
      invalidate();
    },
    onError: (error: Error) => {
      toast.error(error.message);
      invalidate();
    },
  });

  const statsQuery = useQuery({
    queryKey: ["post-stats", orgId],
    queryFn: () => fetchStats({ data: { organizationId: orgId } }),
    enabled: Boolean(orgId),
    staleTime: 5 * 60_000,
  });

  const liveEditMutation = useMutation({
    mutationFn: (v: { id: string; caption: string }) => editLive({ data: v }),
    onSuccess: () => {
      toast.success("Caption updated on Facebook");
      setLiveEdit(null);
      invalidate();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const ytEditMutation = useMutation({
    mutationFn: (v: { id: string; title: string; description: string; tags: string[] }) => editYt({ data: v }),
    onSuccess: () => {
      toast.success("Video updated on YouTube");
      setYtEdit(null);
      invalidate();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const deleteMutation = useMutation({
    mutationFn: (v: { id: string; alsoRemote: boolean }) => remove({ data: v }),
    onSuccess: (res) => {
      setToDelete(null);
      if (res.remote === "deleted") toast.success("Post deleted here and on the platform");
      else if (res.remote === "unsupported")
        toast.success("Removed from AutoDM. Instagram doesn't let apps delete posts — please delete it in the Instagram app.", { duration: 8000 });
      else toast.success("Post deleted");
      invalidate();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const postDate = (p: Post) => (p.published_at ?? p.scheduled_at ?? p.created_at ?? "").slice(0, 10);
  const ownIds = new Set((postsQuery.data ?? []).map((p) => p.external_post_id).filter(Boolean));
  const livePosts: Post[] = (remoteQuery.data?.posts ?? [])
    .filter((r) => !ownIds.has(r.externalPostId))
    .map((r) => ({
      id: `remote:${r.id}`,
      organization_id: orgId,
      social_account_id: r.socialAccountId,
      platform: r.platform,
      caption: r.caption,
      media_url: r.mediaUrl,
      media_urls: r.mediaUrl ? [r.mediaUrl] : [],
      post_format:
        r.platform === "youtube" || r.mediaType === "REELS" ? "reel"
        : r.mediaType === "CAROUSEL_ALBUM" ? "carousel"
        : r.mediaType === "STORY" ? "story" : "feed",
      group_id: null,
      media_type: r.mediaType === "VIDEO" || r.mediaType === "REELS" ? "video" : "image",
      scheduled_at: null,
      status: "published",
      external_post_id: r.externalPostId,
      permalink: r.permalink,
      error: null,
      published_at: r.publishedAt,
      created_at: r.publishedAt ?? "",
    }));
  const allPosts = [...(postsQuery.data ?? []), ...livePosts].filter((p) =>
    matchesPlatformAccount(p, platformFilter, accountFilter) &&
    (!fromDate || postDate(p) >= fromDate) &&
    (!toDate || postDate(p) <= toDate),
  );
  const posts = tab === "all" ? allPosts : allPosts.filter((p) => formatKey(p.post_format) === tab);
  // Story copies are saved without a caption; show the caption of the post they were made with.
  const groupCaption = new Map<string, string>();
  for (const p of allPosts) if (p.group_id && p.caption.trim() && !groupCaption.has(p.group_id)) groupCaption.set(p.group_id, p.caption);
  const captionOf = (p: (typeof allPosts)[number]) => p.caption.trim() || (p.group_id ? groupCaption.get(p.group_id) : "") || "(no caption)";
  const accounts = accountsQuery.data ?? [];

  const openEdit = (post: Post) => {
    if (post.status === "published") {
      if (post.platform === "facebook") setLiveEdit({ post, caption: post.caption });
      else if (post.platform === "youtube") {
        const lines = post.caption.split("\n");
        const tags = Array.from(post.caption.matchAll(/#(\w+)/g)).map((m) => m[1]!).filter((t) => t.toLowerCase() !== "shorts");
        const body = lines.slice(1).join("\n").replace(/(^|\s)#\w+/g, "").trim();
        setYtEdit({ post, title: (lines[0] ?? "").replace(/\s*#shorts/i, "").trim(), description: body, tags: tags.join(", ") });
      }
      else toast.info("Instagram doesn't allow editing a published post. Use Duplicate to post an updated version.");
      return;
    }
    setDraft({ post });
    setOpen(true);
  };

  const openDuplicate = (post: Post) => {
    setDraft({ post, duplicate: true });
    setOpen(true);
  };

  return (
    <AppShell>
      <PageHeader
        title="Create Post"
        description="Compose once, schedule it, and let the queue publish for you."
        actions={
          <Button asChild>
            <Link to="/create-post/new">
              <Plus className="mr-2 size-4" /> New post
            </Link>
          </Button>
        }
      />

      <Panel
        title="Your posts"
        bodyClassName="p-0"
        action={
          <div className="flex flex-wrap items-center gap-2">
            <PlatformAccountFilter orgId={orgId || null} platform={platformFilter} onPlatformChange={setPlatformFilter} accountId={accountFilter} onAccountChange={setAccountFilter} />
            <select
              aria-label="Date range"
              value={range}
              onChange={(e) => {
                const v = e.target.value as typeof range;
                setRange(v);
                if (v === "all") { setFromDate(""); setToDate(""); }
                else if (v !== "custom") {
                  const d = new Date(Date.now() - (v === "7" ? 7 : 30) * 86400000);
                  setFromDate(d.toISOString().slice(0, 10));
                  setToDate("");
                }
              }}
              className="h-8 rounded-md border bg-background px-2 text-xs"
            >
              <option value="all">Maximum (all time)</option>
              <option value="7">Last 7 days</option>
              <option value="30">Last 30 days</option>
              <option value="custom">Custom range</option>
            </select>
            {range === "custom" && (
              <>
                <Input type="date" aria-label="From date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} className="h-8 w-36 text-xs" />
                <span className="text-xs text-muted-foreground">to</span>
                <Input type="date" aria-label="To date" value={toDate} min={fromDate || undefined} onChange={(e) => setToDate(e.target.value)} className="h-8 w-36 text-xs" />
              </>
            )}
            {(fromDate || toDate || platformFilter !== "all" || accountFilter !== "all" || range !== "all") && (
              <Button size="sm" variant="ghost" onClick={() => { setFromDate(""); setToDate(""); setRange("all"); setPlatformFilter("all"); setAccountFilter("all"); }}>Clear</Button>
            )}
          </div>
        }
      >
        {(postsQuery.isError || remoteQuery.isError) && <div role="alert" className="flex flex-wrap items-center justify-between gap-3 p-5 text-sm text-destructive"><span>Some posts could not be refreshed. Loaded results may be out of date.</span><Button variant="outline" size="sm" onClick={() => { void postsQuery.refetch(); void remoteQuery.refetch(); }}>Try again</Button></div>}
        <div className="flex gap-1 overflow-x-auto border-b px-5 py-2">
          {FORMAT_TABS.map((t) => {
            const count = t.key === "all" ? allPosts.length : allPosts.filter((p) => formatKey(p.post_format) === t.key).length;
            return (
              <Button key={t.key} size="sm" variant={tab === t.key ? "secondary" : "ghost"} onClick={() => setTab(t.key)}>
                {t.label} <span className="ml-1 text-muted-foreground">{count}</span>
              </Button>
            );
          })}
        </div>
        {postsQuery.isLoading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="size-5 animate-spin text-muted-foreground" />
          </div>
        ) : (postsQuery.isError || remoteQuery.isError) && posts.length === 0 ? (
          <p role="status" className="p-5 text-sm text-muted-foreground">Posts unavailable. Refresh to retry.</p>
        ) : posts.length === 0 ? (
          <div className="p-5">
            <EmptyState
              icon={PenSquare}
              title="No posts yet"
              description="Write your first caption, pick a time, and it will go out automatically."
              action={
                <Button asChild>
                  <Link to="/create-post/new">
                    <Plus className="mr-2 size-4" /> New post
                  </Link>
                </Button>
              }
            />
          </div>
        ) : (
          <ul className="divide-y">
            {pageSlice(posts, page, 10).map((post) => (
              <li
                key={post.id}
                className="flex flex-wrap items-start gap-3 px-5 py-4"
              >
                <PostMediaThumb refs={post.media_urls?.length ? post.media_urls : post.media_url ? [post.media_url] : []} />
                <button
                  type="button"
                  onClick={() => openEdit(post)}
                  className="min-w-0 flex-1 text-left"
                >
                  <span className="flex items-center gap-2">
                    <PlatformBadge platform={post.platform} size="sm" />
                    <FormatBadge postFormat={post.post_format} />
                  </span>
                  <ConnectedAccountLabel orgId={orgId} accountId={post.social_account_id} />
                  <p className="mt-1 truncate text-sm font-medium">
                    {captionOf(post)}
                  </p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {post.status === "published"
                      ? `Published ${formatWhen(post.published_at)}`
                      : formatWhen(post.scheduled_at)}
                    {post.error ? ` · ${post.error}` : ""}
                  </p>
                  {post.status === "published" && <StatsRow stats={statsQuery.data?.[post.id]} />}
                </button>
                <div className="flex items-center gap-2">
                  <StatusBadge tone={statusTone[post.status]}>
                    {post.status}
                  </StatusBadge>
                  {post.status !== "published" && (
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={publishMutation.isPending}
                      onClick={() => publishMutation.mutate(post.id)}
                    >
                      <Send className="mr-1.5 size-3.5" /> Publish now
                    </Button>
                  )}
                  {post.id.startsWith("remote:") ? (
                    post.permalink && (
                      <Button size="sm" variant="ghost" asChild>
                        <a href={post.permalink} target="_blank" rel="noreferrer">Open</a>
                      </Button>
                    )
                  ) : (<>
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => openEdit(post)}
                    aria-label="Edit post"
                    title="Edit"
                  >
                    <Pencil className="size-4" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => openDuplicate(post)}
                    aria-label="Duplicate post"
                    title="Duplicate"
                  >
                    <Copy className="size-4" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => setToDelete(post)}
                    aria-label="Delete post"
                  >
                    <Trash2 className="size-4" />
                  </Button>
                  </>)}
                </div>
              </li>
            ))}
          </ul>
        )}
        <div className="border-t px-5 pb-3"><Pager page={page} total={posts.length} perPage={10} onPage={setPage} /></div>
      </Panel>

      <Dialog open={Boolean(toDelete)} onOpenChange={(o) => !o && setToDelete(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete this post?</DialogTitle>
            <DialogDescription>
              {toDelete?.status !== "published"
                ? "It hasn't been published, so it's only removed from AutoDM."
                : toDelete.platform === "instagram"
                  ? "Instagram doesn't let apps delete posts. We'll remove it from AutoDM — delete it in the Instagram app too."
                  : `Delete it from ${toDelete.platform === "facebook" ? "Facebook" : "YouTube"} as well, or only from AutoDM?`}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            {toDelete?.status === "published" && toDelete.platform !== "instagram" && (
              <Button variant="outline" disabled={deleteMutation.isPending} onClick={() => toDelete && deleteMutation.mutate({ id: toDelete.id, alsoRemote: false })}>
                Only from AutoDM
              </Button>
            )}
            <Button
              variant="destructive"
              disabled={deleteMutation.isPending}
              onClick={() => toDelete && deleteMutation.mutate({ id: toDelete.id, alsoRemote: toDelete.status === "published" })}
            >
              {deleteMutation.isPending && <Loader2 className="mr-2 size-4 animate-spin" />}
              {toDelete?.status === "published" && toDelete.platform !== "instagram" ? "Delete everywhere" : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(liveEdit)} onOpenChange={(o) => !o && setLiveEdit(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit live Facebook post</DialogTitle>
            <DialogDescription>The new caption updates on your Facebook Page right away.</DialogDescription>
          </DialogHeader>
          <Textarea rows={6} value={liveEdit?.caption ?? ""} onChange={(e) => liveEdit && setLiveEdit({ ...liveEdit, caption: e.target.value })} />
          <DialogFooter>
            <Button disabled={liveEditMutation.isPending} onClick={() => liveEdit && liveEditMutation.mutate({ id: liveEdit.post.id, caption: liveEdit.caption })}>
              {liveEditMutation.isPending && <Loader2 className="mr-2 size-4 animate-spin" />}
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(ytEdit)} onOpenChange={(o) => !o && setYtEdit(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit YouTube video</DialogTitle>
            <DialogDescription>Title, description and tags update on YouTube right away.</DialogDescription>
          </DialogHeader>
          {ytEdit && (
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="yt-edit-title">Title</Label>
                <Input id="yt-edit-title" maxLength={100} value={ytEdit.title} onChange={(e) => setYtEdit({ ...ytEdit, title: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="yt-edit-desc">Description</Label>
                <Textarea id="yt-edit-desc" rows={5} maxLength={5000} value={ytEdit.description} onChange={(e) => setYtEdit({ ...ytEdit, description: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="yt-edit-tags">Tags (comma separated)</Label>
                <Input id="yt-edit-tags" value={ytEdit.tags} onChange={(e) => setYtEdit({ ...ytEdit, tags: e.target.value })} />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button
              disabled={ytEditMutation.isPending || !ytEdit?.title.trim()}
              onClick={() => ytEdit && ytEditMutation.mutate({
                id: ytEdit.post.id,
                title: ytEdit.title,
                description: ytEdit.description,
                tags: ytEdit.tags.split(",").map((t) => t.trim()).filter(Boolean).slice(0, 15),
              })}
            >
              {ytEditMutation.isPending && <Loader2 className="mr-2 size-4 animate-spin" />}
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {orgId && (
        <PostComposer
          open={open}
          onOpenChange={setOpen}
          organizationId={orgId}
          accounts={accounts}
          draft={draft}
        />
      )}
    </AppShell>
  );
}
