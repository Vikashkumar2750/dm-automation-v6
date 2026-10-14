import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ChevronLeft, ChevronRight, FileText, Image as ImageIcon, Mic, Phone, Video, Camera, Heart, Send } from "lucide-react";

import { cn } from "@/lib/utils";
import { listRecentRemotePosts, listTargetablePosts } from "@/lib/automations.functions";

export type PreviewDraft = {
  trigger: string;
  action: string;
  platform: string;
  keywords: string;
  responseText: string;
  commentReplyText: string;
  dmLinkUrl: string;
  dmButtonLabel: string;
  dmAttachmentUrl: string;
  dmAttachmentType: "none" | "image" | "video" | "file";
  requireFollow: boolean;
  followPromptText: string;
};

type PreviewPost = { externalPostId: string; platform: string; caption: string; mediaUrl: string | null; accountName?: string };

/** Live phone mockup that mirrors the automation form while it is being edited. Display only. */
export function AutomationPreview({
  draft,
  orgId,
  selectedPostIds = [],
}: {
  draft: PreviewDraft;
  orgId?: string | undefined;
  selectedPostIds?: string[];
}) {
  const isComment = draft.trigger === "comment_received";
  const sendsDm = ["reply_dm", "comment_private_reply"].includes(draft.action);
  const [view, setView] = useState<"dm" | "comment">("dm");
  const [pick, setPick] = useState<"instagram" | "facebook">("instagram");
  const [slide, setSlide] = useState(0);
  const lockedPlatform = draft.platform === "instagram" || draft.platform === "facebook" ? draft.platform : null;
  const plat = lockedPlatform ?? pick;
  const isFb = plat === "facebook";
  const tab = !isComment ? "dm" : !sendsDm ? "comment" : view;
  const keyword = draft.keywords.split(",")[0]?.trim() || "price";
  const message = draft.responseText.trim() || "Your DM message will appear here as you type…";
  const label = draft.dmButtonLabel.trim() || "Open link";

  // Same query keys as PostPicker, so this reuses its cached results.
  const fetchPosts = useServerFn(listTargetablePosts);
  const fetchRemote = useServerFn(listRecentRemotePosts);
  const enabled = Boolean(orgId) && selectedPostIds.length > 0;
  const local = useQuery({ queryKey: ["targetable-posts", orgId], enabled, queryFn: () => fetchPosts({ data: { organizationId: orgId! } }) });
  const remote = useQuery({ queryKey: ["remote-posts", orgId], enabled, staleTime: 60_000, queryFn: () => fetchRemote({ data: { organizationId: orgId! } }) });
  const posts = useMemo(() => {
    const map = new Map<string, PreviewPost>();
    for (const p of (remote.data?.posts ?? []) as PreviewPost[]) map.set(p.externalPostId, p);
    const failed = new Set(remote.data?.failedPlatforms ?? []);
    for (const p of (local.data ?? []) as PreviewPost[]) {
      if (map.has(p.externalPostId)) continue;
      if (remote.isSuccess && p.platform !== "youtube" && !failed.has(p.platform)) continue; // deleted on platform
      map.set(p.externalPostId, p);
    }
    return selectedPostIds.map((id) => map.get(id)).filter(Boolean) as PreviewPost[];
  }, [remote.data, remote.isSuccess, local.data, selectedPostIds]);
  const current = posts.length ? posts[Math.min(slide, posts.length - 1)] : null;
  const handle = current?.accountName || "yourbrand";

  return (
    <aside className="lg:sticky lg:top-20">
      <p className="mb-2 text-center text-xs font-semibold uppercase tracking-wide text-muted-foreground">Live preview</p>
      <div className="mb-3 flex flex-wrap justify-center gap-1">
        {!lockedPlatform && (["instagram", "facebook"] as const).map((p) => (
          <Chip key={p} active={plat === p} onClick={() => setPick(p)}>{p === "instagram" ? "Instagram" : "Facebook"}</Chip>
        ))}
        {isComment && sendsDm && (["dm", "comment"] as const).map((v) => (
          <Chip key={v} active={tab === v} onClick={() => setView(v)}>{v === "dm" ? "DM" : "Comment"}</Chip>
        ))}
      </div>
      <div className="mx-auto w-full max-w-[360px] rounded-[2.75rem] border-[7px] border-foreground/90 bg-foreground p-1 shadow-xl">
        <div className="flex h-[680px] flex-col overflow-hidden rounded-[2.2rem] bg-background text-foreground">
          <div className="flex items-center justify-between px-6 pt-3 text-[11px] font-semibold"><span>9:41</span><span className="h-5 w-20 rounded-full bg-foreground" /><span>100%</span></div>
          <div className="flex items-center gap-2 border-b px-3 py-2">
            <ChevronLeft className="size-4" />
            <span className={cn("grid size-8 place-items-center rounded-full text-[10px] font-bold", isFb ? "bg-info text-info-foreground" : "bg-primary text-primary-foreground")}>{handle.slice(0, 2).toUpperCase()}</span>
            <span className="flex-1 truncate text-sm font-semibold">{handle}<span className="block text-[10px] font-normal text-muted-foreground">{isFb ? "Messenger" : "Instagram"}</span></span>
            {tab === "dm" && <><Phone className="size-4" /><Video className="size-4" /></>}
          </div>

          {tab === "dm" ? (
            <div className="flex-1 space-y-2 overflow-y-auto p-3 text-[13px]">
              {isComment && (
                <Bubble fb={isFb}>
                  <p>Hey! Thanks for commenting "{keyword}". Tap below and I'll send it right away 👇</p>
                  <Btn>Send me the link</Btn>
                </Bubble>
              )}
              {draft.requireFollow && (
                <Bubble fb={isFb}>
                  <p>{draft.followPromptText.trim() || "Please follow us first, then tap the button below."}</p>
                  <Btn>Visit profile</Btn><Btn>I followed ✅</Btn>
                </Bubble>
              )}
              <Bubble fb={isFb}>
                <p className="whitespace-pre-wrap break-words">{message}</p>
                {draft.dmLinkUrl.trim() && <Btn>{label}</Btn>}
              </Bubble>
              {draft.dmAttachmentType !== "none" && (
                <div className="ml-8 flex h-28 w-44 items-center justify-center gap-2 overflow-hidden rounded-2xl bg-muted text-xs text-muted-foreground">
                  {draft.dmAttachmentType === "image" && draft.dmAttachmentUrl.startsWith("http") ? (
                    <img src={draft.dmAttachmentUrl} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <>{draft.dmAttachmentType === "file" ? <FileText className="size-5" /> : <ImageIcon className="size-5" />}{draft.dmAttachmentType}</>
                  )}
                </div>
              )}
            </div>
          ) : (
            <div className="flex-1 overflow-y-auto">
              <div className="relative aspect-square bg-muted">
                {current?.mediaUrl ? (
                  /\.(mp4|mov|webm|m4v)(?:[?#]|$)|#video$/i.test(current.mediaUrl)
                    ? <video key={current.mediaUrl} src={`${current.mediaUrl.replace(/#video$/i, "")}#t=0.1`} muted playsInline preload="metadata" className="h-full w-full object-cover" />
                    : <PreviewImage key={current.mediaUrl} src={current.mediaUrl} caption={current.caption} />
                ) : (
                  <div className="grid h-full place-items-center px-6 text-center text-xs text-muted-foreground">
                    {current
                      ? <span className="flex flex-col items-center gap-2"><ImageIcon className="size-8" />{current.caption || "Post image not available"}</span>
                      : !selectedPostIds.length
                        ? "All posts — select a post to preview it here"
                        : local.isLoading || remote.isLoading ? "Loading selected post…" : "Preview not available for this post"}
                  </div>
                )}
                {posts.length > 1 && (
                  <>
                    <SlideBtn side="left" onClick={() => setSlide((s) => (s - 1 + posts.length) % posts.length)} />
                    <SlideBtn side="right" onClick={() => setSlide((s) => (s + 1) % posts.length)} />
                    <span className="absolute right-2 top-2 rounded-full bg-background/80 px-2 py-0.5 text-[10px] font-semibold">{Math.min(slide, posts.length - 1) + 1}/{posts.length}</span>
                  </>
                )}
              </div>
              <div className="flex gap-3 px-3 py-2"><Heart className="size-4" /><Send className="size-4" /></div>
              {current?.caption && <p className="line-clamp-2 px-3 text-[12px]"><b>{handle}</b> {current.caption}</p>}
              <div className="mt-2 space-y-3 px-3 text-[12px]">
                <p><b>user_123</b> {keyword} 🙏</p>
                {draft.commentReplyText.trim() || draft.action === "comment_public_reply" ? (
                  <p className="ml-6"><b>{handle}</b> {draft.action === "comment_public_reply" ? (draft.responseText.trim() || "Your reply…") : draft.commentReplyText}</p>
                ) : <p className="ml-6 italic text-muted-foreground">No public reply set</p>}
              </div>
            </div>
          )}

          <div className="flex items-center gap-2 p-2">
            <span className={cn("grid size-8 place-items-center rounded-full", isFb ? "bg-info text-info-foreground" : "bg-primary text-primary-foreground")}><Camera className="size-4" /></span>
            <div className="flex flex-1 items-center justify-between rounded-full bg-muted px-3 py-2 text-xs text-muted-foreground">Message… <Mic className="size-3.5" /></div>
          </div>
        </div>
      </div>
    </aside>
  );
}

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" onClick={onClick}
      className={cn("rounded-full border px-3 py-1 text-xs font-medium transition-colors", active ? "border-primary bg-primary text-primary-foreground" : "hover:bg-muted")}>
      {children}
    </button>
  );
}

function SlideBtn({ side, onClick }: { side: "left" | "right"; onClick: () => void }) {
  const Icon = side === "left" ? ChevronLeft : ChevronRight;
  return (
    <button type="button" onClick={onClick} aria-label={side === "left" ? "Previous post" : "Next post"}
      className={cn("absolute top-1/2 grid size-7 -translate-y-1/2 place-items-center rounded-full bg-background/80", side === "left" ? "left-2" : "right-2")}>
      <Icon className="size-4" />
    </button>
  );
}

function Bubble({ children, fb }: { children: React.ReactNode; fb?: boolean }) {
  return (
    <div className="flex items-end gap-2">
      <span className={cn("size-6 shrink-0 rounded-full", fb ? "bg-info/70" : "bg-primary/70")} />
      <div className="max-w-[80%] space-y-1.5 rounded-2xl bg-muted px-3 py-2">{children}</div>
    </div>
  );
}

function Btn({ children }: { children: React.ReactNode }) {
  return <div className="rounded-lg bg-background py-1.5 text-center text-xs font-semibold text-primary">{children}</div>;
}

function PreviewImage({ src, caption }: { src: string; caption: string }) {
  const [broken, setBroken] = useState(false);
  if (broken)
    return (
      <div className="grid h-full place-items-center px-6 text-center text-xs text-muted-foreground">
        <span className="flex flex-col items-center gap-2"><ImageIcon className="size-8" />{caption || "Post image expired"}</span>
      </div>
    );
  return <img src={src} alt="" className="h-full w-full object-cover" onError={() => setBroken(true)} />;
}
