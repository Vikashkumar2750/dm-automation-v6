import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Bot, ExternalLink, Eye, Heart, Loader2, MessageCircle, MessageSquare, Send, Share2, UserRound } from "lucide-react";
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
import { replyToComment } from "@/lib/inbox.functions";
import { getPostJourney, getSinglePostStats, type JourneyMessage } from "@/lib/post-journey.functions";

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
        actions={<><GuideButton guide="meta-review" /><Button asChild variant="outline"><Link to="/inbox">Open inbox</Link></Button></>}
      />
      <div className="grid gap-4 lg:grid-cols-[320px_minmax(0,1fr)]">
        <PostSidebar orgId={orgId} selectedId={post?.externalPostId ?? null} onSelect={setPost} />
        {post && orgId ? <PostView key={post.externalPostId} orgId={orgId} post={post} /> : (
          <div className="hidden min-h-[420px] items-center justify-center rounded-xl border border-dashed text-sm text-muted-foreground lg:flex">Select a post to see its comments.</div>
        )}
      </div>
    </AppShell>
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
  return (
    <div className="overflow-hidden rounded-xl border bg-card">
      <div className="flex items-center gap-2 px-3 py-2">
        <PlatformBadge platform={post.platform} size="sm" />
        <p className="min-w-0 flex-1 truncate text-sm font-semibold">{post.accountName}</p>
        {post.permalink && <a href={post.permalink} target="_blank" rel="noreferrer" className="text-muted-foreground hover:text-foreground" aria-label="Open on platform"><ExternalLink className="size-4" /></a>}
      </div>
      <div className={`flex justify-center bg-muted ${post.platform === "youtube" ? "aspect-video" : "aspect-square max-h-[420px]"}`}>
        {post.mediaUrl ? (isVideo
          ? <video src={`${post.mediaUrl}#t=0.1`} controls preload="metadata" className="h-full w-full object-contain" />
          : <img src={post.mediaUrl} alt="" className="h-full w-full object-contain" onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }} />)
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
  const convs = (journey.data?.conversations ?? []).filter((c) => c.channel === "comment");
  const msgs = journey.data?.messages ?? [];
  const targetConv = convs.find((c) => c.id === target) ?? null;
  const send = useMutation({
    mutationFn: () => reply({ data: { conversationId: target!, body, mode: post.platform === "youtube" ? "public" : mode } }),
    onSuccess: () => { setBody(""); toast.success(mode === "public" || post.platform === "youtube" ? "Public reply posted" : "Private reply sent"); void qc.invalidateQueries({ queryKey: ["post-journey", orgId, post.externalPostId] }); },
    onError: (e: Error) => toast.error(e.message.includes("window_expired") ? "Meta allows replies only within 7 days of the comment." : e.message),
  });

  return (
    <div className="grid min-w-0 gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <div className="min-w-0"><PostCard orgId={orgId} post={post} /></div>
      <div className="flex min-h-[420px] min-w-0 flex-col rounded-xl border xl:max-h-[calc(100vh-9rem)]">
        <p className="border-b px-4 py-3 text-sm font-semibold">Comments ({convs.length})</p>
        <div className="flex-1 space-y-3 overflow-y-auto p-3">
          {journey.isLoading ? <Loader2 className="mx-auto size-5 animate-spin text-muted-foreground" /> : convs.length === 0 ? (
            <EmptyState icon={MessageSquare} title="No comments linked yet" description="New comments on this post will show up here." />
          ) : convs.map((c) => (
            <div key={c.id} className={`rounded-xl border p-3 ${target === c.id ? "border-primary bg-primary/5" : ""}`}>
              {msgs.filter((m) => m.conversation_id === c.id).map((m) => (
                <div key={m.id} className={`py-1 text-sm ${m.direction === "inbound" ? "" : "ml-6 border-l-2 pl-3"}`}>
                  <p className="flex flex-wrap items-center gap-1.5 text-xs"><span className="font-semibold">{m.direction === "inbound" ? m.sender_name ?? c.name ?? "Commenter" : post.accountName}</span><SenderTag m={m} /><span className="text-muted-foreground">{new Date(m.sent_at).toLocaleString()}</span></p>
                  <p className="whitespace-pre-wrap break-words">{m.body}</p>
                </div>
              ))}
              <button type="button" onClick={() => setTarget(c.id)} className="mt-1 text-xs font-medium text-primary hover:underline">Reply</button>
            </div>
          ))}
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
