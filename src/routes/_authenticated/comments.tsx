import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, MessageSquare, Send } from "lucide-react";
import { toast } from "sonner";
import { Textarea } from "@/components/ui/textarea";
import { useMemo, useState } from "react";
import { PostThumbnail } from "@/components/app/PostThumbnail";
import { listRecentRemotePosts, listTargetablePosts } from "@/lib/automations.functions";

import { AppShell } from "@/components/app/AppShell";
import {
  EmptyState,
  PageHeader,
  Panel,
  PlatformBadge,
  StatusBadge,
} from "@/components/app/primitives";
import { Button } from "@/components/ui/button";
import { GuideButton } from "@/components/app/GuideButton";
import { useTenant } from "@/hooks/useTenant";
import { Pager, pageSlice } from "@/components/app/Pager";
import { listCommentPostLinks, listConversations, listMessages, replyToComment, type ConversationRow } from "@/lib/inbox.functions";
import { contactLabel } from "@/lib/contact-name";

export const Route = createFileRoute("/_authenticated/comments")({
  head: () => ({
    meta: [
      { title: "Comments — AutoDM by Techaasvik" },
      {
        name: "description",
        content: "All Instagram and Facebook comment threads, with unread and status filters.",
      },
      { property: "og:title", content: "Comments" },
      {
        property: "og:description",
        content: "Review and answer comments from your connected pages and profiles.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: CommentsPage,
});

const FILTERS = [
  { key: "all", label: "All" },
  { key: "open", label: "Open" },
  { key: "pending", label: "Pending" },
  { key: "resolved", label: "Resolved" },
] as const;

function CommentsPage() {
  const { activeOrg } = useTenant();
  const orgId = activeOrg?.id ?? null;
  const [filter, setFilter] = useState<(typeof FILTERS)[number]["key"]>("all");
  const [platform, setPlatform] = useState<"all" | "instagram" | "facebook" | "youtube">("all");

  const fetchConversations = useServerFn(listConversations);
  const threads = useQuery({
    queryKey: ["conversations", orgId, "comments", filter, platform],
    enabled: !!orgId,
    refetchInterval: 30_000,
    queryFn: () =>
      fetchConversations({
        data: {
          organizationId: orgId!,
          channel: "comment",
          ...(platform === "all" ? {} : { platform }),
          ...(filter === "all" ? {} : { status: filter }),
        },
      }),
  });

  const convRows = threads.data ?? [];
  const fetchLinks = useServerFn(listCommentPostLinks);
  const links = useQuery({
    queryKey: ["comment-post-links", orgId, convRows.map((c) => c.id).join(",")],
    enabled: convRows.length > 0,
    queryFn: () => fetchLinks({ data: { conversationIds: convRows.slice(0, 500).map((c) => c.id) } }),
  });
  const fetchPosts = useServerFn(listTargetablePosts);
  const fetchRemote = useServerFn(listRecentRemotePosts);
  const localPosts = useQuery({ queryKey: ["targetable-posts", orgId], enabled: !!orgId, queryFn: () => fetchPosts({ data: { organizationId: orgId! } }) });
  const remotePosts = useQuery({ queryKey: ["remote-posts", orgId], enabled: !!orgId, staleTime: 60_000, queryFn: () => fetchRemote({ data: { organizationId: orgId! } }) });
  const postMap = useMemo(() => {
    const m = new Map<string, PostInfo>();
    for (const p of (remotePosts.data?.posts ?? []) as PostInfo[]) m.set(p.externalPostId, p);
    for (const p of (localPosts.data ?? []) as PostInfo[]) if (!m.has(p.externalPostId)) m.set(p.externalPostId, p);
    return m;
  }, [remotePosts.data, localPosts.data]);
  const linkMap = links.data ?? {};
  const groups = useMemo(() => {
    const g = new Map<string, number>();
    for (const c of convRows) { const k = linkMap[c.id] ?? "__other"; g.set(k, (g.get(k) ?? 0) + 1); }
    return [...g.entries()].sort((a, b) => (a[0] === "__other" ? 1 : b[0] === "__other" ? -1 : b[1] - a[1]));
  }, [convRows, linkMap]);
  const [postFilter, setPostFilter] = useState<string>("all");
  const allRows = postFilter === "all" ? convRows : convRows.filter((c) => (linkMap[c.id] ?? "__other") === postFilter);
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<ConversationRow | null>(null);
  const rows = pageSlice(allRows, page, 10);

  return (
    <AppShell>
      <PageHeader
        title="Comments"
        description="Comment threads from Instagram and Facebook. Click a comment to read the thread and reply right here."
        actions={
          <><GuideButton guide="meta-review" />
          <Button asChild>
            <Link to="/inbox">Open inbox</Link>
          </Button></>
        }
      />

      <Panel
        title={`Comment threads (${allRows.length})`}
        action={
          <div className="flex flex-wrap gap-1">
            <select
              aria-label="Platform"
              className="h-8 rounded-md border border-input bg-background px-2 text-sm"
              value={platform}
              onChange={(e) => { setPlatform(e.target.value as typeof platform); setPage(1); }}
            >
              <option value="all">All platforms</option>
              <option value="instagram">Instagram</option>
              <option value="facebook">Facebook</option>
              <option value="youtube">YouTube</option>
            </select>
            {FILTERS.map((f) => (
              <Button
                key={f.key}
                size="sm"
                variant={filter === f.key ? "default" : "outline"}
                onClick={() => { setFilter(f.key); setPage(1); }}
              >
                {f.label}
              </Button>
            ))}
          </div>
        }
      >
        {groups.length > 1 || (groups[0] && groups[0][0] !== "__other") ? (
          <div className="mb-4 flex gap-2 overflow-x-auto pb-1">
            <button type="button" onClick={() => { setPostFilter("all"); setPage(1); }}
              className={`shrink-0 rounded-xl border px-3 py-2 text-left text-xs font-medium ${postFilter === "all" ? "border-primary bg-primary/5" : "hover:bg-muted"}`}>
              All posts<span className="block text-muted-foreground">{convRows.length} threads</span>
            </button>
            {groups.map(([key, count]) => {
              const post = postMap.get(key);
              return (
                <button type="button" key={key} onClick={() => { setPostFilter(key); setPage(1); }}
                  className={`flex w-52 shrink-0 items-center gap-2 rounded-xl border px-2 py-2 text-left text-xs ${postFilter === key ? "border-primary bg-primary/5" : "hover:bg-muted"}`}>
                  {key === "__other" ? <span className="grid size-10 place-items-center rounded bg-muted"><MessageSquare className="size-4" /></span> : <PostThumbnail src={post?.mediaUrl ?? null} />}
                  <span className="min-w-0 flex-1">
                    <span className="line-clamp-2 font-medium">{key === "__other" ? "Older / unlinked comments" : post?.caption || "Post"}</span>
                    <span className="text-muted-foreground">{count} {count === 1 ? "comment" : "comments"}</span>
                  </span>
                </button>
              );
            })}
          </div>
        ) : null}
        {rows.length === 0 ? (
          <EmptyState
            icon={MessageSquare}
            title="No comments yet"
            description="Comments on your posts appear here as soon as an account is connected."
          />
        ) : (
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
          <div className="space-y-2">
            {rows.map((c) => (
              <button
                type="button"
                key={c.id}
                onClick={() => setSelected(c)}
                className={`grid w-full min-w-0 grid-cols-[auto_minmax(0,1fr)] items-center gap-3 rounded-xl border px-4 py-3 text-left transition-colors hover:bg-surface-secondary ${selected?.id === c.id ? "border-primary bg-primary/5" : ""}`}
              >
                <PlatformBadge platform={c.platform} size="sm" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{contactLabel(c)}</p>
                  <p className="truncate text-xs text-muted-foreground">{c.last_message_preview ?? "No preview"}</p>
                  <div className="mt-1 flex flex-wrap items-center gap-2">
                    {c.unread_count > 0 && <StatusBadge tone="info">{c.unread_count} new</StatusBadge>}
                    <StatusBadge tone={c.status === "open" ? "warning" : c.status === "pending" ? "info" : "success"}>{c.status}</StatusBadge>
                    <span className="text-xs text-muted-foreground">{new Date(c.last_message_at).toLocaleString()}</span>
                  </div>
                </div>
              </button>
            ))}
            <Pager page={page} total={allRows.length} perPage={10} onPage={setPage} />
          </div>
          {selected ? <CommentThread conv={selected} post={linkMap[selected.id] ? postMap.get(linkMap[selected.id]!) : undefined} onClose={() => setSelected(null)} /> : (
            <div className="hidden items-center justify-center rounded-xl border border-dashed p-10 text-sm text-muted-foreground lg:flex">Select a comment to see the thread and reply here.</div>
          )}
          </div>
        )}
      </Panel>
    </AppShell>
  );
}

type PostInfo = { externalPostId: string; caption: string; mediaUrl: string | null; publishedAt: string | null; accountName?: string };

function CommentThread({ conv, post, onClose }: { conv: ConversationRow; post?: PostInfo | undefined; onClose: () => void }) {
  const qc = useQueryClient();
  const fetchMessages = useServerFn(listMessages);
  const reply = useServerFn(replyToComment);
  const [body, setBody] = useState("");
  const [mode, setMode] = useState<"public" | "private">("public");
  const msgs = useQuery({ queryKey: ["messages", conv.id], refetchInterval: 15_000, queryFn: () => fetchMessages({ data: { conversationId: conv.id } }) });
  const send = useMutation({
    mutationFn: () => reply({ data: { conversationId: conv.id, body, mode: conv.platform === "youtube" ? "public" : mode } }),
    onSuccess: () => { setBody(""); toast.success(mode === "public" ? "Public reply posted" : "Private reply sent"); void qc.invalidateQueries({ queryKey: ["messages", conv.id] }); void qc.invalidateQueries({ queryKey: ["conversations"] }); },
    onError: (e: Error) => toast.error(e.message.includes("window_expired") ? "Meta allows replies only within 7 days of the comment." : e.message),
  });
  return (
    <div className="flex min-h-[420px] min-w-0 flex-col rounded-xl border lg:sticky lg:top-20 lg:max-h-[calc(100vh-7rem)]">
      <div className="flex items-center gap-2 border-b px-4 py-3">
        <PlatformBadge platform={conv.platform} size="sm" />
        <p className="min-w-0 flex-1 truncate text-sm font-semibold">{contactLabel(conv)}</p>
        <Button variant="ghost" size="sm" onClick={onClose}>Close</Button>
      </div>
      {post && (
        <div className="flex gap-3 border-b p-3">
          <PostThumbnail src={post.mediaUrl} />
          <div className="min-w-0 text-xs">
            <p className="font-semibold">{post.accountName ?? "Your post"}{post.publishedAt ? ` · ${new Date(post.publishedAt).toLocaleDateString()}` : ""}</p>
            <p className="line-clamp-3 text-muted-foreground">{post.caption || "No caption"}</p>
          </div>
        </div>
      )}
      <div className="flex-1 space-y-2 overflow-y-auto p-4">
        {msgs.isLoading ? <Loader2 className="mx-auto size-5 animate-spin text-muted-foreground" /> : (msgs.data ?? []).map((m) => (
          <div key={m.id} className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm ${m.direction === "inbound" ? "bg-muted" : "ml-auto bg-primary text-primary-foreground"}`}>
            <p className="whitespace-pre-wrap break-words">{m.body}</p>
            <p className="mt-1 text-[10px] opacity-70">{m.direction === "inbound" ? m.sender_name ?? "Commenter" : "You / bot"} · {new Date(m.sent_at).toLocaleString()}</p>
          </div>
        ))}
      </div>
      <div className="space-y-2 border-t p-3">
        {conv.platform !== "youtube" && (
          <div className="flex gap-1">
            {(["public", "private"] as const).map((m) => (
              <Button key={m} size="sm" variant={mode === m ? "default" : "outline"} onClick={() => setMode(m)}>{m === "public" ? "Public reply" : "Private DM"}</Button>
            ))}
          </div>
        )}
        <div className="flex items-end gap-2">
          <Textarea rows={2} value={body} placeholder="Write a reply…" onChange={(e) => setBody(e.target.value)} />
          <Button onClick={() => send.mutate()} disabled={!body.trim() || send.isPending} aria-label="Send reply">
            {send.isPending ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
          </Button>
        </div>
      </div>
    </div>
  );
}
