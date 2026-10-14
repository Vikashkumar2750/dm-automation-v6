import { useState } from "react";
import { ChevronLeft, FileText, Image as ImageIcon, Mic, Phone, Video, Camera, Heart } from "lucide-react";

import { cn } from "@/lib/utils";

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

/** Live phone mockup that mirrors the automation form while it is being edited. Display only. */
export function AutomationPreview({ draft, handle = "yourbrand" }: { draft: PreviewDraft; handle?: string }) {
  const isComment = draft.trigger === "comment_received";
  const sendsDm = ["reply_dm", "comment_private_reply"].includes(draft.action);
  const [view, setView] = useState<"dm" | "comment">("dm");
  const tab = !isComment ? "dm" : !sendsDm ? "comment" : view;
  const keyword = draft.keywords.split(",")[0]?.trim() || "price";
  const message = draft.responseText.trim() || "Your DM message will appear here as you type…";
  const label = draft.dmButtonLabel.trim() || "Open link";

  return (
    <aside className="lg:sticky lg:top-20">
      <p className="mb-2 text-center text-xs font-semibold uppercase tracking-wide text-muted-foreground">Live preview</p>
      {isComment && sendsDm && (
        <div className="mb-3 flex justify-center gap-1">
          {(["dm", "comment"] as const).map((v) => (
            <button key={v} type="button" onClick={() => setView(v)}
              className={cn("rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                tab === v ? "border-primary bg-primary text-primary-foreground" : "hover:bg-muted")}>
              {v === "dm" ? "DM preview" : "Comment preview"}
            </button>
          ))}
        </div>
      )}
      <div className="mx-auto w-[300px] rounded-[2.5rem] border-[6px] border-foreground/90 bg-foreground p-1 shadow-xl">
        <div className="flex h-[560px] flex-col overflow-hidden rounded-[2rem] bg-background text-foreground">
          <div className="flex items-center justify-between px-5 pt-3 text-[11px] font-semibold"><span>9:41</span><span className="h-4 w-16 rounded-full bg-foreground" /><span>100%</span></div>
          <div className="flex items-center gap-2 border-b px-3 py-2">
            <ChevronLeft className="size-4" />
            <span className="grid size-7 place-items-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground">{handle.slice(0, 2).toUpperCase()}</span>
            <span className="flex-1 truncate text-sm font-semibold">{handle}</span>
            {tab === "dm" && <><Phone className="size-4" /><Video className="size-4" /></>}
          </div>

          {tab === "dm" ? (
            <div className="flex-1 space-y-2 overflow-y-auto p-3 text-[13px]">
              {isComment && (draft.requireFollow || draft.dmAttachmentType !== "none") && (
                <Bubble>
                  <p>Tap below and I'll send it right away 👇</p>
                  <Btn>Send me the link</Btn>
                </Bubble>
              )}
              {draft.requireFollow && (
                <Bubble>
                  <p>{draft.followPromptText.trim() || "Please follow us first, then tap the button below."}</p>
                  <Btn>Visit profile</Btn><Btn>I followed ✅</Btn>
                </Bubble>
              )}
              <Bubble>
                <p className="whitespace-pre-wrap break-words">{message}</p>
                {draft.dmLinkUrl.trim() && <Btn>{label}</Btn>}
              </Bubble>
              {draft.dmAttachmentType !== "none" && (
                <div className="ml-8 flex h-24 w-40 items-center justify-center gap-2 rounded-2xl bg-muted text-xs text-muted-foreground">
                  {draft.dmAttachmentType === "file" ? <FileText className="size-5" /> : <ImageIcon className="size-5" />}
                  {draft.dmAttachmentType}
                </div>
              )}
            </div>
          ) : (
            <div className="flex-1 overflow-y-auto">
              <div className="aspect-square bg-muted" />
              <div className="flex gap-3 px-3 py-2"><Heart className="size-4" /></div>
              <div className="space-y-3 px-3 text-[12px]">
                <p><b>user_123</b> {keyword} 🙏</p>
                {draft.commentReplyText.trim() || draft.action === "comment_public_reply" ? (
                  <p className="ml-6"><b>{handle}</b> {draft.action === "comment_public_reply" ? (draft.responseText.trim() || "Your reply…") : draft.commentReplyText}</p>
                ) : <p className="ml-6 italic text-muted-foreground">No public reply set</p>}
              </div>
            </div>
          )}

          <div className="flex items-center gap-2 p-2">
            <span className="grid size-8 place-items-center rounded-full bg-primary text-primary-foreground"><Camera className="size-4" /></span>
            <div className="flex flex-1 items-center justify-between rounded-full bg-muted px-3 py-2 text-xs text-muted-foreground">Message… <Mic className="size-3.5" /></div>
          </div>
        </div>
      </div>
    </aside>
  );
}

function Bubble({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-end gap-2">
      <span className="size-6 shrink-0 rounded-full bg-primary/70" />
      <div className="max-w-[80%] space-y-1.5 rounded-2xl bg-muted px-3 py-2">{children}</div>
    </div>
  );
}

function Btn({ children }: { children: React.ReactNode }) {
  return <div className="rounded-lg bg-background py-1.5 text-center text-xs font-semibold text-primary">{children}</div>;
}
