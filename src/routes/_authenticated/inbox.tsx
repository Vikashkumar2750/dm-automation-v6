import { contactLabel } from "@/lib/contact-name";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useRef, useState } from "react";
import {
  CheckCheck,
  ArrowLeft,
  Pencil,
  Trash2,
  Eye,
  EyeOff,
  Inbox as InboxIcon,
  Loader2,
  MessageSquareText,
  Send,
} from "lucide-react";
import { toast } from "sonner";

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
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { canEditComment } from "@/lib/comment-moderation";
import { useTenant } from "@/hooks/useTenant";
import {
  listConversations,
  listMessages,
  markConversationRead,
  replyToComment,
  sendReply,
  setCommentHidden,
  setConversationStatus,
  resumeBot,
  moderateComment,
  type MessageRow,
  type ConversationRow,
} from "@/lib/inbox.functions";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/inbox")({
  head: () => ({
    meta: [
      { title: "Unified Inbox — AutoDM by Techaasvik" },
      {
        name: "description",
        content: "Every conversation from Instagram, Facebook and YouTube in one place.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { property: "og:title", content: "Unified Inbox — AutoDM by Techaasvik" },
      {
        property: "og:description",
        content: "Every conversation from Instagram, Facebook and YouTube in one place.",
      },
    ],
  }),
  component: InboxPage,
});

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

type Platform = "instagram" | "facebook" | "youtube";
type Channel = "dm" | "comment";
type Status = "open" | "pending" | "resolved";

function FilterChips<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: Array<{ value: T; label: string }>;
  onChange: (next: T) => void;
}) {
  return (
    <div className="flex flex-wrap gap-1">
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          onClick={() => onChange(option.value)}
          className={cn(
            "rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors",
            value === option.value
              ? "border-primary bg-primary text-primary-foreground"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

const BUTTON_TITLES = ["Send me the link", "Visit profile", "I followed ✅"];

/** Split "[public reply] text" into a tag + the text the contact actually sees. */
function describeMessage(body: string, outbound: boolean) {
  const match = body.match(/^\[(public reply|private reply)\]\s*/i);
  const tag = match ? (match[1] ?? "").toLowerCase() : null;
  const text = match ? body.slice(match[0].length) : body;
  const buttons: string[] = [];
  if (outbound && /tap the button below/i.test(text)) buttons.push("Send me the link");
  if (outbound && /follow/i.test(text) && /tap/i.test(text)) buttons.push("Visit profile", "I followed ✅");
  return { tag, text, buttons: buttons.filter((b) => BUTTON_TITLES.includes(b)) };
}

function InboxPage() {
  const { activeOrg } = useTenant();
  const orgId = activeOrg?.id;
  const queryClient = useQueryClient();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [commentMode, setCommentMode] = useState<"public" | "private">("public");
  const [platform, setPlatform] = useState<Platform | "all">("all");
  const [channel, setChannel] = useState<Channel | "all">("all");
  const [status, setStatus] = useState<Status | "all">("all");
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [search, setSearch] = useState("");
  const [moderation, setModeration] = useState<{ message: MessageRow; conversationId: string; action: "edit" | "delete" } | null>(null);
  const [editText, setEditText] = useState("");

  const fetchConversations = useServerFn(listConversations);
  const fetchMessages = useServerFn(listMessages);
  const markReadFn = useServerFn(markConversationRead);
  const sendReplyFn = useServerFn(sendReply);
  const replyToCommentFn = useServerFn(replyToComment);
  const setCommentHiddenFn = useServerFn(setCommentHidden);
  const setStatusFn = useServerFn(setConversationStatus);
  const resumeBotFn = useServerFn(resumeBot);
  const moderateFn = useServerFn(moderateComment);
  const moderationMutation = useMutation({
    mutationFn: async () => {
      if (!moderation) throw new Error("No comment selected");
      return moderateFn({ data: { conversationId: moderation.conversationId, messageId: moderation.message.id, action: moderation.action, ...(moderation.action === "edit" ? { body: editText.trim() } : {}) } });
    },
    onSuccess: () => {
      toast.success(moderation?.action === "delete" ? "Comment deleted on Meta." : "Comment updated on Facebook.");
      setModeration(null);
      queryClient.invalidateQueries({ queryKey: ["messages"] });
      queryClient.invalidateQueries({ queryKey: ["conversations", orgId] });
    },
    onError: commentError,
  });
  const resume = useMutation({
    mutationFn: (conversationId: string) => resumeBotFn({ data: { conversationId } }),
    onSuccess: () => {
      toast.success("Bot resumed — it will answer the next new message.");
      queryClient.invalidateQueries({ queryKey: ["conversations", orgId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const filters = {
    ...(platform !== "all" ? { platform } : {}),
    channel: "dm" as const,
    ...(status !== "all" ? { status } : {}),
    ...(unreadOnly ? { unreadOnly: true } : {}),
    ...(search.trim() ? { search: search.trim() } : {}),
  };

  const conversationsQuery = useQuery({
    queryKey: ["conversations", orgId, filters],
    enabled: Boolean(orgId),
    refetchInterval: 15_000,
    queryFn: () =>
      {
      if (!orgId) throw new Error("No workspace selected");
      return fetchConversations({ data: { organizationId: orgId, ...filters } });
    },
  });

  const conversations = conversationsQuery.data ?? [];
  const selected: ConversationRow | undefined =
    conversations.find((c) => c.id === selectedId) ?? conversations[0];

  const messagesQuery = useQuery({
    queryKey: ["messages", selected?.id],
    enabled: Boolean(selected?.id),
    refetchInterval: 15_000,
    queryFn: () => {
      if (!selected) throw new Error("No conversation selected");
      return fetchMessages({ data: { conversationId: selected.id } });
    },
  });

  const threadRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = threadRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [selected?.id, messagesQuery.data?.length]);

  const send = useMutation({
    mutationFn: (body: string) => {
      if (!selected) throw new Error("No conversation selected");
      return sendReplyFn({ data: { conversationId: selected.id, body } });
    },
    onSuccess: () => {
      setDraft("");
      queryClient.invalidateQueries({ queryKey: ["messages", selected?.id] });
      queryClient.invalidateQueries({ queryKey: ["conversations", orgId] });
    },
    onError: (error) => {
      const message = error instanceof Error ? error.message : "";
      if (message.includes("window_expired")) {
        toast.error(
          "Meta allows replies only within 24 hours of the person's last message.",
        );
      } else if (message.includes("comment_unsupported")) {
        toast.error("Comment threads can't be replied to from the inbox yet.");
      } else if (message.includes("not_allowed")) {
        toast.error("You need agent access or higher to reply.");
      } else {
        toast.error(
          message ? `Meta rejected this: ${message.slice(0, 200)}` : "Could not send the reply. Check the account connection.",
        );
      }
    },
  });

  function commentError(error: unknown) {
    const message = error instanceof Error ? error.message : "";
    if (message.includes("window_expired")) {
      toast.error("This comment is older than Meta's reply window.");
    } else if (message.includes("not_allowed")) {
      toast.error("You need agent access or higher to reply.");
    } else if (message.includes("no_comment_id")) {
      toast.error("We don't have the original comment id for this thread yet.");
    } else if (message.includes("youtube_no_token")) {
      toast.error("YouTube authorization was revoked. Reconnect the channel.");
    } else if (message.includes("youtube_reply")) {
      toast.error(`YouTube rejected this reply: ${message.split("youtube_reply:")[1]?.trim()}`);
    } else {
      toast.error(
        message
          ? `${selected?.platform === "youtube" ? "YouTube" : "Meta"} rejected this: ${message.slice(0, 200)}`
          : "Could not complete the action. Check the account connection.",
      );
    }
  }

  const commentReply = useMutation({
    mutationFn: (body: string) => {
      if (!selected) throw new Error("No conversation selected");
      return replyToCommentFn({
        data: {
          conversationId: selected.id,
          body,
          mode: selected.platform === "youtube" ? "public" : commentMode,
        },
      });
    },
    onSuccess: () => {
      setDraft("");
      toast.success(
        selected?.platform === "youtube" || commentMode === "public"
          ? "Public reply posted."
          : "Private DM sent.",
      );
      queryClient.invalidateQueries({ queryKey: ["messages", selected?.id] });
      queryClient.invalidateQueries({ queryKey: ["conversations", orgId] });
    },
    onError: commentError,
  });

  const [hiddenIds, setHiddenIds] = useState<Record<string, boolean>>({});
  const hideComment = useMutation({
    mutationFn: (v: boolean | { hidden: boolean; messageId: string }) => {
      if (!selected) throw new Error("No conversation selected");
      const o = typeof v === "boolean" ? { hidden: v } : v;
      return setCommentHiddenFn({ data: { conversationId: selected.id, ...o } }).then((r) => { if (!r.ok) throw new Error(r.error ?? "Could not change visibility"); return r; });
    },
    onSuccess: (_r, v) => {
      if (typeof v !== "boolean") setHiddenIds((p) => ({ ...p, [v.messageId]: v.hidden }));
      toast.success((typeof v === "boolean" ? v : v.hidden) ? "Comment hidden — the public can't see it. The commenter, their friends and Page admins still can." : "Comment visible again on the post.");
    },
    onError: commentError,
  });

  const changeStatus = useMutation({
    mutationFn: (next: Status) => {
      if (!selected) throw new Error("No conversation selected");
      return setStatusFn({ data: { conversationId: selected.id, status: next } });
    },
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["conversations", orgId] }),
    onError: () => toast.error("Could not update the status."),
  });

  function openConversation(id: string) {
    setSelectedId(id);
    markReadFn({ data: { conversationId: id } }).then(() =>
      queryClient.invalidateQueries({ queryKey: ["conversations", orgId] }),
    );
  }

  return (
    <AppShell>
      <PageHeader
        title="Unified Inbox"
        description="Messages and comments from Instagram, Facebook and YouTube in one place."
        actions={<GuideButton guide="meta-review" />}
      />

      <div className="grid min-w-0 gap-4 lg:h-[calc(100dvh-12.5rem)] lg:min-h-[520px] lg:grid-cols-[340px_minmax(0,1fr)]">
        {/* Conversation list */}
        <Panel bodyClassName="flex min-h-0 flex-1 flex-col p-0" className={cn("min-h-[480px] lg:min-h-0", selectedId && "hidden lg:flex")}>
          <div className="space-y-2 border-b px-4 py-3">
            <div>
              <p className="text-sm font-semibold">Conversations</p>
              <p className="text-xs text-muted-foreground">
                Refreshes automatically every 15 seconds.
              </p>
            </div>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search name or message…"
              className="h-8 w-full rounded-md border bg-background px-2.5 text-xs outline-none focus:ring-2 focus:ring-ring"
            />
            <FilterChips
              value={platform}
              onChange={setPlatform}
              options={[
                { value: "all", label: "All platforms" },
                { value: "instagram", label: "Instagram" },
                { value: "facebook", label: "Facebook" },
                { value: "youtube", label: "YouTube" },
              ]}
            />
            <div className="flex flex-wrap items-center gap-1 [&>*:first-child]:contents">
              <FilterChips
                value={status}
                onChange={setStatus}
                options={[
                  { value: "all", label: "Any status" },
                  { value: "open", label: "Open" },
                  { value: "pending", label: "Pending" },
                  { value: "resolved", label: "Resolved" },
                ]}
              />
              <button
                type="button"
                onClick={() => setUnreadOnly((v) => !v)}
                className={cn(
                  "rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors",
                  unreadOnly
                    ? "border-primary bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                Unread only
              </button>
            </div>
          </div>
          {conversationsQuery.isLoading ? (
            <div className="flex items-center justify-center py-16 text-sm text-muted-foreground">
              <Loader2 className="mr-2 size-4 animate-spin" /> Loading…
            </div>
          ) : conversations.length === 0 ? (
            <EmptyState
              icon={InboxIcon}
              title="No conversations yet"
              description="Once your webhook is subscribed in the Meta app, incoming DMs and comments appear here in real time."
            />
          ) : (
            <ul className="max-h-[60vh] min-h-[240px] divide-y overflow-y-auto lg:max-h-none lg:min-h-0 lg:flex-1">
              {conversations.map((c) => (
                <li key={c.id}>
                  <button
                    type="button"
                    onClick={() => openConversation(c.id)}
                    className={cn(
                      "flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/60",
                      selected?.id === c.id && "bg-muted",
                    )}
                  >
                    <PlatformBadge platform={c.platform} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <p className="truncate text-sm font-medium">
                          {contactLabel(c)}
                        </p>
                        <span className="shrink-0 text-[11px] text-muted-foreground">
                          {timeAgo(c.last_message_at)}
                        </span>
                      </div>
                      <p className="truncate text-xs text-muted-foreground">
                        {c.last_message_preview ?? "—"}
                      </p>
                    </div>
                    {c.channel === "comment" ? (
                      <StatusBadge tone="info">comment</StatusBadge>
                    ) : null}
                    {c.unread_count > 0 ? (
                      <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-primary text-[11px] font-semibold text-primary-foreground">
                        {c.unread_count}
                      </span>
                    ) : null}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        {/* Thread */}
        <Panel className={cn("lg:min-h-0", !selectedId && "hidden lg:flex")} bodyClassName="flex min-h-[480px] flex-1 flex-col p-0 lg:min-h-0">
          {!selected ? (
            <div className="flex flex-1 items-center justify-center py-16">
              <EmptyState
                icon={MessageSquareText}
                title="Pick a conversation"
                description="Select a conversation on the left to read the thread and reply."
              />
            </div>
          ) : (
            <>
              <div className="grid min-w-0 gap-3 border-b px-3 py-3 sm:flex sm:flex-wrap sm:items-center sm:justify-between sm:px-5">
                <div className="flex min-w-0 items-center gap-3">
                  <Button variant="ghost" size="icon" className="shrink-0 lg:hidden" aria-label="Back to conversations" onClick={() => setSelectedId(null)}><ArrowLeft className="size-4" /></Button>
                  <PlatformBadge platform={selected.platform} />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold">
                      {contactLabel(selected)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {selected.channel === "comment" ? "Comment thread" : "Direct message"}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <FilterChips
                    value={selected.status}
                    onChange={(next) => changeStatus.mutate(next)}
                    options={[
                      { value: "open", label: "Open" },
                      { value: "pending", label: "Pending" },
                      { value: "resolved", label: "Resolved" },
                    ]}
                  />
                </div>
                <StatusBadge
                  tone={selected.status === "resolved" ? "neutral" : "success"}
                >
                  {selected.status}
                </StatusBadge>
              </div>
              {selected.bot_paused_until && new Date(selected.bot_paused_until) > new Date() ? (
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border bg-muted/50 px-5 py-2 text-sm">
                  <span className="text-muted-foreground">
                    Bot paused — a teammate is handling this chat until{" "}
                    {new Date(selected.bot_paused_until).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}.
                  </span>
                  <Button size="sm" variant="outline" disabled={resume.isPending} onClick={() => resume.mutate(selected.id)}>
                    Resume bot
                  </Button>
                </div>
              ) : null}

              <div className="flex min-h-0 justify-center bg-muted/30 px-3 py-3 lg:flex-1">
              <div className="flex h-[60vh] min-h-[320px] w-full max-w-[380px] flex-col overflow-hidden rounded-[2.25rem] border-[6px] border-neutral-800 bg-neutral-950 shadow-xl lg:h-full lg:min-h-0">
              <div className="mx-auto mt-1.5 h-4 w-24 shrink-0 rounded-full bg-neutral-800" />
              <div className="flex shrink-0 items-center gap-2 border-b border-neutral-800 px-4 py-2 text-xs font-semibold text-neutral-100">{contactLabel(selected)}</div>
              <div
                ref={threadRef}
                className="min-h-0 flex-1 space-y-3 overflow-y-auto overscroll-contain px-3 py-3 [scrollbar-color:theme(colors.neutral.700)_transparent] [scrollbar-width:thin]"
              >
                {messagesQuery.isLoading ? (
                  <div className="flex items-center justify-center py-10 text-sm text-muted-foreground">
                    <Loader2 className="mr-2 size-4 animate-spin" /> Loading messages…
                  </div>
                ) : (
                  (messagesQuery.data ?? []).map((m) => {
                    const view = describeMessage(m.body, m.direction === "outbound");
                    return (
                    <div
                      key={m.id}
                      className={cn(
                        "max-w-[80%] rounded-2xl px-3 py-2 text-sm",
                        m.direction === "outbound"
                          ? "ml-auto bg-primary text-primary-foreground"
                          : "bg-neutral-800 text-neutral-100",
                      )}
                    >
                      {view.tag ? (
                        <span className="mb-1 inline-block rounded bg-background/20 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide">
                          {view.tag}
                        </span>
                      ) : null}
                      <p className="whitespace-pre-wrap break-words">{view.text}</p>
                      {selected.channel === "comment" && selected.platform !== "youtube" && m.external_id && (m.direction === "inbound" || view.tag === "public reply") ? (
                        <div className="mt-2 flex items-center gap-1">
                          {canEditComment(selected.platform, m.direction, m.body, m.external_id) && <Button type="button" variant="ghost" size="icon" title="Edit Facebook reply" aria-label="Edit Facebook reply" onClick={() => { setEditText(view.text); setModeration({ message: m, conversationId: selected.id, action: "edit" }); }}><Pencil className="size-4" /></Button>}
                          {(() => { const isHidden = hiddenIds[m.id] ?? !!m.is_hidden; const label = isHidden ? "Unhide this comment" : "Hide this comment"; return <Button type="button" variant="ghost" size="icon" title={label} aria-label={label} aria-pressed={isHidden} disabled={hideComment.isPending} onClick={() => hideComment.mutate({ hidden: !isHidden, messageId: m.id })}>{hideComment.isPending && typeof hideComment.variables === "object" && hideComment.variables?.messageId === m.id ? <Loader2 className="size-4 animate-spin" /> : isHidden ? <EyeOff className="size-4" /> : <Eye className="size-4" />}</Button>; })()}
                          <Button type="button" variant="ghost" size="icon" title="Delete comment on Meta" aria-label="Delete comment on Meta" onClick={() => setModeration({ message: m, conversationId: selected.id, action: "delete" })}><Trash2 className="size-4" /></Button>
                        </div>
                      ) : null}
                      {view.buttons.length ? (
                        <div className="mt-2 space-y-1">
                          {view.buttons.map((b) => (
                            <div
                              key={b}
                              className="rounded-md bg-background px-3 py-1.5 text-center text-xs font-semibold text-foreground"
                            >
                              {b}
                            </div>
                          ))}
                        </div>
                      ) : null}
                      <p
                        className={cn(
                          "mt-1 text-[10px]",
                          m.direction === "outbound"
                            ? "text-primary-foreground/70"
                            : "text-neutral-400",
                        )}
                      >
                        {new Date(m.sent_at).toLocaleString()}
                      </p>
                    </div>
                    );
                  })
                )}
              </div>
              </div>
              </div>

              {selected.channel === "comment" ? (
                <form
                  className="space-y-2 border-t px-4 py-3"
                  onSubmit={(e) => {
                    e.preventDefault();
                    const body = draft.trim();
                    if (body && !commentReply.isPending) commentReply.mutate(body);
                  }}
                >
                  <input
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    placeholder={
                      selected.platform === "youtube" || commentMode === "public"
                        ? "Reply publicly under this comment…"
                        : "Send a private DM to this commenter…"
                    }
                    className="h-9 w-full rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
                    maxLength={1000}
                  />
                  <div className="flex flex-wrap items-center gap-2">
                    {selected.platform !== "youtube" ? (
                    <div className="flex rounded-md border p-0.5">
                      {(["public", "private"] as const).map((mode) => (
                        <button
                          key={mode}
                          type="button"
                          onClick={() => setCommentMode(mode)}
                          className={cn(
                            "rounded px-2.5 py-1 text-xs font-medium transition-colors",
                            commentMode === mode
                              ? "bg-primary text-primary-foreground"
                              : "text-muted-foreground hover:text-foreground",
                          )}
                        >
                          {mode === "public" ? "Public reply" : "Private DM"}
                        </button>
                      ))}
                    </div>
                    ) : null}
                    <Button
                      type="submit"
                      size="sm"
                      disabled={!draft.trim() || commentReply.isPending}
                    >
                      {commentReply.isPending ? (
                        <Loader2 className="size-4 animate-spin" />
                      ) : (
                        <Send className="size-4" />
                      )}
                      Send
                    </Button>
                    {selected.platform !== "youtube" ? <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={hideComment.isPending}
                      onClick={() => hideComment.mutate(true)}
                    >
                      {hideComment.isPending && hideComment.variables === true ? <Loader2 className="size-4 animate-spin" /> : <EyeOff className="size-4" />}
                      Hide comment
                    </Button> : null}
                    {selected.platform !== "youtube" ? <Button type="button" size="sm" variant="outline" disabled={hideComment.isPending} onClick={() => hideComment.mutate(false)}>{hideComment.isPending && hideComment.variables === false ? <Loader2 className="size-4 animate-spin" /> : <Eye className="size-4" />}Unhide comment</Button> : null}
                  </div>
                </form>
              ) : selected.channel === "dm" && selected.platform !== "youtube" ? (
                <form
                  className="flex items-center gap-2 border-t px-4 py-3"
                  onSubmit={(e) => {
                    e.preventDefault();
                    const body = draft.trim();
                    if (body && !send.isPending) send.mutate(body);
                  }}
                >
                  <input
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    placeholder="Type a reply… (24-hour Meta window applies)"
                    className="h-9 min-w-0 flex-1 rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
                    maxLength={1000}
                  />
                  <Button type="submit" size="sm" disabled={!draft.trim() || send.isPending}>
                    {send.isPending ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <Send className="size-4" />
                    )}
                    Send
                  </Button>
                </form>
              ) : (
                <div className="flex items-center gap-2 border-t px-4 py-3 text-xs text-muted-foreground">
                  <CheckCheck className="size-4" />
                  Direct messages are only available for Instagram and Facebook.
                </div>
              )}
            </>
          )}
        </Panel>
      </div>
      <Dialog open={Boolean(moderation)} onOpenChange={(open) => { if (!open && !moderationMutation.isPending) setModeration(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{moderation?.action === "delete" ? "Delete this comment?" : "Edit Facebook reply"}</DialogTitle>
            <DialogDescription>{moderation?.action === "delete" ? "This permanently deletes the comment on the connected Facebook or Instagram post. Replies beneath it may also be removed." : "Only your Page's public reply can be edited. The change is published on Facebook."}</DialogDescription>
          </DialogHeader>
          {moderation?.action === "edit" ? <textarea aria-label="Updated reply" className="min-h-28 w-full rounded-md border bg-background p-3 text-base" maxLength={1000} value={editText} onChange={(event) => setEditText(event.target.value)} /> : <p className="break-words text-sm text-muted-foreground">{moderation?.message.body}</p>}
          <DialogFooter className="gap-2">
            <Button variant="outline" disabled={moderationMutation.isPending} onClick={() => setModeration(null)}>Cancel</Button>
            <Button variant={moderation?.action === "delete" ? "destructive" : "default"} disabled={moderationMutation.isPending || (moderation?.action === "edit" && !editText.trim())} onClick={() => moderationMutation.mutate()}>{moderationMutation.isPending ? <><Loader2 className="mr-2 size-4 animate-spin" />{moderation?.action === "delete" ? "Deleting…" : "Saving…"}</> : moderation?.action === "delete" ? "Delete on Meta" : "Save reply"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
