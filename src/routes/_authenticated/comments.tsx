import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Bot, EyeOff, Pencil, RefreshCw, Trash2, ExternalLink, Eye, Heart, Loader2, MessageCircle, MessageSquare, Send, Share2, UserRound } from "lucide-react";
import { toast } from "sonner";
import { useState } from "react";
import { AppShell } from "@/components/app/AppShell";
import { EmptyState, PageHeader, PlatformBadge } from "@/components/app/primitives";
import { PostThumbnail } from "@/components/app/PostThumbnail";
import { PostSidebar, type SidebarPost } from "@/components/app/PostSidebar";
import { GuideButton } from "@/components/app/GuideButton";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useTenant } from "@/hooks/useTenant";
import { moderateComment, replyToComment, setCommentHidden } from "@/lib/inbox.functions";
import { canEditComment } from "@/lib/comment-moderation";
import { messagesForPost } from "@/lib/post-comments";
import { getLivePostComments, getPostJourney, getSinglePostStats, type JourneyMessage } from "@/lib/post-journey.functions";

export const Route = createFileRoute("/_authenticated/comments")({
  head: () => ({
    meta: [
      { title: "Comments — AutoDM by Techaasvik" },
      { name: "description", content: "Every post with its comments and replies, Instagram, Facebook and YouTube style." },
      { property: "og:title", content: "Comments" },
      { property: "og:description", content: "Pick a post, read all its comments and reply right here." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: CommentsPage,
});

function CommentsPage() {
  const { activeOrg } = useTenant();
  const orgId = activeOrg?.id ?? null;
  const [post, setPost] = useState<SidebarPost | null>(null);
  return (
    <AppShell>
      <PageHeader
        title="Comments"
        description="Pick a post on the left to see it like on Instagram, Facebook or YouTube, with all comments and replies."
        actions={<><RefreshButton /><GuideButton guide="meta-review" /><Button asChild variant="outline"><Link to="/inbox">Open inbox</Link></Button></>}
      />
      <div className="grid gap-4 lg:h-[calc(100vh-14rem)] lg:min-h-[480px] lg:grid-cols-[320px_minmax(0,1fr)] [&>*]:lg:min-h-0 [&>*:first-child]:lg:overflow-y-auto">
        <PostSidebar orgId={orgId} selectedId={post?.externalPostId ?? null} onSelect={setPost} onPlatformChange={() => setPost(null)} />
        {post && orgId ? <PostView key={post.externalPostId} orgId={orgId} post={post} /> : (
          <div className="hidden min-h-[420px] items-center justify-center rounded-xl border border-dashed text-sm text-muted-foreground lg:flex">Select a post to see its comments.</div>
        )}
      </div>
    </AppShell>
  );
}

function RefreshButton() {
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);
  return (
    <Button variant="outline" disabled={busy} onClick={async () => {
      setBusy(true);
      await Promise.all(["post-journey", "post-comment-counts", "post-stats"].map((k) => qc.invalidateQueries({ queryKey: [k] })));
      setBusy(false);
      toast.success("Comments refreshed");
    }}>{busy ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" />}Sync comments</Button>
  );
}

function CommentActions({ m, convId, platform, onDone }: { m: JourneyMessage; convId: string; platform: string; onDone: () => void }) {
  const hide = useServerFn(setCommentHidden);
  const moderate = useServerFn(moderateComment);
  const [hidden, setHidden] = useState(!!m.is_hidden);
  const [busy, setBusy] = useState<string | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  if (platform === "youtube" || !m.external_id || m.body === "[deleted comment]") return null;
  const isComment = m.direction === "inbound" || m.body.startsWith("[public reply] ");
  if (!isComment) return null;
  const run = async (key: string, fn: () => Promise<unknown>, ok: string) => {
    setBusy(key);
    try { await fn(); toast.success(ok); onDone(); } catch (e) { toast.error(e instanceof Error ? e.message : "Action failed"); } finally { setBusy(null); }
  };
  const spin = (k: string, Icon: typeof Trash2) => busy === k ? <Loader2 className="size-3 animate-spin" /> : <Icon className="size-3" />;
  const edit = canEditComment(platform, m.direction, m.body, m.external_id);
  return (
    <>
      <div className="contents">
        {edit && (
          <button type="button" className="text-muted-foreground hover:text-foreground disabled:opacity-50" disabled={!!busy} onClick={() => setEditing(m.body.replace(/^\[public reply\] /, ""))}>Edit</button>
        )}
        {m.direction === "inbound" && (
          <button type="button" className="inline-flex items-center gap-1 text-muted-foreground hover:text-foreground disabled:opacity-50" disabled={!!busy}
            onClick={() => run("hide", async () => { const r = await hide({ data: { conversationId: convId, messageId: m.id, hidden: !hidden } }); if (!r.ok) throw new Error(r.error ?? "Could not change visibility"); setHidden(!hidden); }, hidden ? "Comment visible again" : "Comment hidden — the public can't see it. The commenter, their friends and Page admins still can.")}>
            {busy === "hide" && <Loader2 className="size-3 animate-spin" />}{hidden ? "Unhide" : "Hide"}
          </button>
        )}
        <button type="button" className="inline-flex items-center gap-1 text-destructive/80 hover:text-destructive disabled:opacity-50" disabled={!!busy}
          onClick={() => { if (confirm("Delete this comment on the platform?")) void run("delete", () => moderate({ data: { conversationId: convId, messageId: m.id, action: "delete" } }), "Comment deleted"); }}>
          {busy === "delete" && <Loader2 className="size-3 animate-spin" />}Delete
        </button>
      </div>
      {editing !== null && (
        <div className="flex w-full items-end gap-2">
          <Textarea rows={2} value={editing} onChange={(e) => setEditing(e.target.value)} />
          <Button size="sm" disabled={!editing.trim() || !!busy} onClick={() => run("edit", async () => { await moderate({ data: { conversationId: convId, messageId: m.id, action: "edit", body: editing } }); setEditing(null); }, "Reply updated")}>{spin("edit", Pencil)}Save</Button>
          <Button size="sm" variant="ghost" onClick={() => setEditing(null)}>Cancel</Button>
        </div>
      )}
    </>
  );
}

function PostCard({ orgId, post }: { orgId: string; post: SidebarPost }) {
  const fetchStats = useServerFn(getSinglePostStats);
  const stats = useQuery({
    queryKey: ["post-stats", post.externalPostId],
    staleTime: 60_000,
    queryFn: () => fetchStats({ data: { organizationId: orgId, socialAccountId: post.socialAccountId ?? null, platform: post.platform, externalPostId: post.externalPostId } }),
  });
  const s = stats.data;
  const isVideo = /video|reel/i.test(post.mediaType ?? "") || /\.mp4/i.test(post.mediaUrl ?? "");
  const videoSrc = post.videoUrl ?? (/\.mp4|#video/i.test(post.mediaUrl ?? "") ? post.mediaUrl!.replace(/#video$/, "") : null);
  const ytId = post.platform === "youtube" ? post.externalPostId : null;
  return (
    <div className="overflow-hidden rounded-xl border bg-card">
      <div className="flex items-center gap-2 px-3 py-2">
        <PlatformBadge platform={post.platform} size="sm" />
        <p className="min-w-0 flex-1 truncate text-sm font-semibold">{post.accountName}</p>
        {post.permalink && <a href={post.permalink} target="_blank" rel="noreferrer" className="text-muted-foreground hover:text-foreground" aria-label="Open on platform"><ExternalLink className="size-4" /></a>}
      </div>
      <div className={`mx-auto flex justify-center bg-muted ${post.platform === "youtube" ? "aspect-video w-full" : isVideo ? "aspect-[9/16] h-[min(70vh,640px)] max-w-full" : "aspect-square max-h-[420px] w-full"}`}>
        {ytId ? <iframe src={`https://www.youtube.com/embed/${ytId}`} title="YouTube video" allow="accelerometer; autoplay; encrypted-media; picture-in-picture" allowFullScreen className="h-full w-full" /> : post.mediaUrl || videoSrc ? (isVideo && videoSrc
          ? <video src={videoSrc} poster={post.mediaUrl && post.mediaUrl !== videoSrc ? post.mediaUrl : undefined} controls playsInline preload="metadata" className="h-full w-full object-contain" />
          : <img src={post.mediaUrl ?? ""} alt="" className="h-full w-full object-contain" onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }} />)
          : <div className="grid place-items-center"><PostThumbnail src={null} /></div>}
      </div>
      <div className="space-y-1 px-3 py-2">
        <div className="flex flex-wrap items-center gap-4 text-sm">
          <span className="flex items-center gap-1"><Heart className="size-4" />{s?.likes ?? "—"}</span>
          <span className="flex items-center gap-1"><MessageCircle className="size-4" />{s?.comments ?? "—"}</span>
          {s?.shares != null && <span className="flex items-center gap-1"><Share2 className="size-4" />{s.shares}</span>}
          {s?.views != null && <span className="flex items-center gap-1"><Eye className="size-4" />{s.views}</span>}
        </div>
        <p className="whitespace-pre-wrap break-words text-sm"><span className="font-semibold">{post.accountName}</span> {post.caption || ""}</p>
        {post.publishedAt && <p className="text-[11px] uppercase text-muted-foreground">{new Date(post.publishedAt).toLocaleString()}</p>}
      </div>
    </div>
  );
}

function SenderTag({ m }: { m: JourneyMessage }) {
  if (m.direction === "inbound") return null;
  return m.manual
    ? <span className="inline-flex items-center gap-0.5 rounded bg-info/15 px-1 text-[10px] font-medium text-info"><UserRound className="size-3" />Manual</span>
    : <span className="inline-flex items-center gap-0.5 rounded bg-primary/15 px-1 text-[10px] font-medium text-primary"><Bot className="size-3" />Bot</span>;
}

function PostView({ orgId, post }: { orgId: string; post: SidebarPost }) {
  const qc = useQueryClient();
  const fetchJourney = useServerFn(getPostJourney);
  const reply = useServerFn(replyToComment);
  const journey = useQuery({ queryKey: ["post-journey", orgId, post.externalPostId], refetchInterval: 20_000, queryFn: () => fetchJourney({ data: { organizationId: orgId, postExternalId: post.externalPostId } }) });
  const [target, setTarget] = useState<string | null>(null);
  const [body, setBody] = useState("");
  const [mode, setMode] = useState<"public" | "private">("public");
  const fetchLive = useServerFn(getLivePostComments);
  const live = useQuery({
    queryKey: ["post-journey", "live", post.externalPostId],
    enabled: post.platform !== "youtube",
    staleTime: 30_000,
    queryFn: () => fetchLive({ data: { organizationId: orgId, socialAccountId: post.socialAccountId ?? null, platform: post.platform, externalPostId: post.externalPostId } }),
  });
  const allConvs = (journey.data?.conversations ?? []).filter((c) => c.channel === "comment");
  // Drop deleted comments and the replies under them (older rows saved as "[deleted comment]").
  const msgs = (() => {
    let skip = false;
    return messagesForPost(journey.data?.messages ?? [], post.externalPostId).filter((m) => {
      if (m.direction === "inbound") skip = m.body === "[deleted comment]";
      return !skip && m.body !== "[deleted comment]";
    });
  })();
  const convs = allConvs.filter((c) => msgs.some((m) => m.conversation_id === c.id));
  const commentCount = msgs.filter((m) => m.direction === "inbound").length;
  const known = new Set(msgs.map((m) => m.external_id).filter(Boolean));
  const liveList = live.data?.comments ?? [];
  const extra = liveList.filter((c) => !known.has(c.id));
  // Replies made on the platform (or not saved by us) under comments we do have.
  const liveReplies = new Map(liveList.filter((c) => known.has(c.id)).map((c) => [c.id, c.replies.filter((r) => !known.has(r.id))]));
  const targetMsg = msgs.find((m) => m.id === target) ?? null;
  const targetConv = targetMsg ? convs.find((c) => c.id === targetMsg.conversation_id) ?? null : null;
  const send = useMutation({
    mutationFn: () => reply({ data: { conversationId: targetMsg!.conversation_id, commentMessageId: targetMsg!.id, body, mode: post.platform === "youtube" ? "public" : mode } }),
    onSuccess: () => { setBody(""); toast.success(mode === "public" || post.platform === "youtube" ? "Public reply posted" : "Private reply sent"); void qc.invalidateQueries({ queryKey: ["post-journey", orgId, post.externalPostId] }); },
    onError: (e: Error) => toast.error(e.message.includes("window_expired") ? "Meta allows replies only within 7 days of the comment." : e.message),
  });

  return (
    <div className="grid min-w-0 gap-4 lg:h-full lg:min-h-0 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <div className="min-w-0 lg:min-h-0 lg:overflow-y-auto"><PostCard orgId={orgId} post={post} /></div>
      <div className="flex min-h-[420px] min-w-0 flex-col rounded-xl border lg:min-h-0">
        <p className="border-b px-4 py-3 text-sm font-semibold">Comments ({commentCount + extra.length})</p>
        <div className="min-h-0 flex-1 divide-y overflow-y-auto">
          {extra.flatMap((c) => [{ ...c, reply: false }, ...c.replies.map((r) => ({ ...r, replies: [], reply: true }))]).map((c) => (
            <div key={c.id} className={`px-4 py-2.5 text-sm ${c.reply ? "pl-9" : ""}`}>
              <p className="flex flex-wrap items-center gap-1.5 text-xs"><span className="font-semibold">{c.author ?? "Commenter"}</span>{c.createdAt && <span className="text-muted-foreground">{new Date(c.createdAt).toLocaleDateString()} · {new Date(c.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>}</p>
              <p className="mt-0.5 whitespace-pre-wrap break-words">{c.text}</p>
            </div>
          ))}
          {live.data?.error && <p className="bg-warning/10 px-4 py-2 text-xs text-warning">Older comments could not be loaded: {live.data.error}</p>}
          {journey.isLoading ? <Loader2 className="mx-auto my-4 size-5 animate-spin text-muted-foreground" /> : convs.length === 0 && extra.length === 0 ? (
            <EmptyState icon={MessageSquare} title="No comments linked yet" description="New comments on this post will show up here." />
          ) : convs.flatMap((c) => msgs
            .filter((m) => m.conversation_id === c.id)
            .flatMap((m) => [(
              <div key={m.id} className={`px-4 py-2.5 text-sm ${m.direction === "inbound" ? "" : "pl-9"} ${target === m.id ? "bg-primary/5" : ""}`}>
                <p className="flex flex-wrap items-center gap-1.5 text-xs"><span className="font-semibold">{m.direction === "inbound" ? m.sender_name ?? c.name ?? "Commenter" : post.accountName}</span><SenderTag m={m} /><span className="text-muted-foreground">{new Date(m.sent_at).toLocaleDateString()} · {new Date(m.sent_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span></p>
                <p className="mt-0.5 whitespace-pre-wrap break-words">{m.body.replace(/^\[public reply\] /, "")}</p>
                <div className="mt-1 flex flex-wrap items-center gap-3 text-[11px]">
                  {m.direction === "inbound" && <button type="button" onClick={() => setTarget(m.id)} className="font-medium text-primary hover:underline">Reply</button>}
                  <CommentActions m={m} convId={c.id} platform={post.platform} onDone={() => void qc.invalidateQueries({ queryKey: ["post-journey", orgId, post.externalPostId] })} />
                </div>
              </div>
            ), ...((m.external_id && liveReplies.get(m.external_id)) || []).map((r) => (
              <div key={r.id} className="px-4 py-2.5 pl-9 text-sm">
                <p className="flex flex-wrap items-center gap-1.5 text-xs"><span className="font-semibold">{r.author ?? "Reply"}</span>{r.createdAt && <span className="text-muted-foreground">{new Date(r.createdAt).toLocaleDateString()} · {new Date(r.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>}</p>
                <p className="mt-0.5 whitespace-pre-wrap break-words">{r.text}</p>
              </div>
            ))]))}
        </div>
        <div className="space-y-2 border-t p-3">
          {targetConv ? (
            <>
              <p className="text-xs text-muted-foreground">Replying to <span className="font-medium text-foreground">{targetConv.name ?? "commenter"}</span> <button type="button" className="ml-1 underline" onClick={() => setTarget(null)}>cancel</button></p>
              {post.platform !== "youtube" && (
                <div className="flex gap-1">
                  {(["public", "private"] as const).map((m) => <Button key={m} size="sm" variant={mode === m ? "default" : "outline"} onClick={() => setMode(m)}>{m === "public" ? "Public reply" : "Private DM"}</Button>)}
                </div>
              )}
              <div className="flex items-end gap-2">
                <Textarea rows={2} value={body} placeholder="Write a reply…" onChange={(e) => setBody(e.target.value)} />
                <Button onClick={() => send.mutate()} disabled={!body.trim() || send.isPending} aria-label="Send reply">
                  {send.isPending ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
                </Button>
              </div>
            </>
          ) : <p className="text-xs text-muted-foreground">Tap "Reply" under a comment to answer it here.</p>}
        </div>
      </div>
    </div>
  );
}
