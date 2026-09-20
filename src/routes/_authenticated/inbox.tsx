import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import {
  CheckCheck,
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
import { useTenant } from "@/hooks/useTenant";
import {
  listConversations,
  listMessages,
  markConversationRead,
  replyToComment,
  sendReply,
  setCommentHidden,
  setConversationStatus,
  type ConversationRow,
} from "@/lib/inbox.functions";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/inbox")({
  head: () => ({
    meta: [
      { title: "Unified Inbox — DM FB-IG-YT by Techaasvik" },
      {
        name: "description",
        content: "Every conversation from Instagram, Facebook and YouTube in one place.",
      },
      { property: "og:title", content: "Unified Inbox — DM FB-IG-YT by Techaasvik" },
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

  const fetchConversations = useServerFn(listConversations);
  const fetchMessages = useServerFn(listMessages);
  const markReadFn = useServerFn(markConversationRead);
  const sendReplyFn = useServerFn(sendReply);
  const replyToCommentFn = useServerFn(replyToComment);
  const setCommentHiddenFn = useServerFn(setCommentHidden);
  const setStatusFn = useServerFn(setConversationStatus);

  const filters = {
    ...(platform !== "all" ? { platform } : {}),
    ...(channel !== "all" ? { channel } : {}),
    ...(status !== "all" ? { status } : {}),
    ...(unreadOnly ? { unreadOnly: true } : {}),
    ...(search.trim() ? { search: search.trim() } : {}),
  };

  const conversationsQuery = useQuery({
    queryKey: ["conversations", orgId, filters],
    enabled: Boolean(orgId),
    refetchInterval: 15_000,
    queryFn: () =>
      fetchConversations({ data: { organizationId: orgId!, ...filters } }),
  });

  const conversations = conversationsQuery.data ?? [];
  const selected: ConversationRow | undefined =
    conversations.find((c) => c.id === selectedId) ?? conversations[0];

  const messagesQuery = useQuery({
    queryKey: ["messages", selected?.id],
    enabled: Boolean(selected?.id),
    refetchInterval: 15_000,
    queryFn: () => fetchMessages({ data: { conversationId: selected!.id } }),
  });

  const send = useMutation({
    mutationFn: (body: string) =>
      sendReplyFn({ data: { conversationId: selected!.id, body } }),
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
        toast.error("Could not send the reply. Check the account connection.");
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
    } else {
      toast.error("Could not complete the action. Check the account connection.");
    }
  }

  const commentReply = useMutation({
    mutationFn: (body: string) =>
      replyToCommentFn({
        data: { conversationId: selected!.id, body, mode: commentMode },
      }),
    onSuccess: () => {
      setDraft("");
      toast.success(
        commentMode === "public" ? "Public reply posted." : "Private DM sent.",
      );
      queryClient.invalidateQueries({ queryKey: ["messages", selected?.id] });
      queryClient.invalidateQueries({ queryKey: ["conversations", orgId] });
    },
    onError: commentError,
  });

  const hideComment = useMutation({
    mutationFn: (hidden: boolean) =>
      setCommentHiddenFn({ data: { conversationId: selected!.id, hidden } }),
    onSuccess: () => toast.success("Comment hidden on the post."),
    onError: commentError,
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
        description="Messages and comments from your connected Instagram and Facebook accounts."
      />

      <div className="grid gap-4 lg:grid-cols-[340px_1fr]">
        {/* Conversation list */}
        <Panel bodyClassName="p-0" className="min-h-[480px]">
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
            <FilterChips
              value={channel}
              onChange={setChannel}
              options={[
                { value: "all", label: "All types" },
                { value: "dm", label: "DMs" },
                { value: "comment", label: "Comments" },
              ]}
            />
            <div className="flex flex-wrap items-center gap-1">
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
            <ul className="divide-y">
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
                          {c.external_user_name ?? `User ${c.external_user_id.slice(-6)}`}
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
        <Panel bodyClassName="flex min-h-[480px] flex-col p-0">
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
              <div className="flex items-center justify-between gap-3 border-b px-5 py-3">
                <div className="flex items-center gap-3">
                  <PlatformBadge platform={selected.platform} />
                  <div>
                    <p className="text-sm font-semibold">
                      {selected.external_user_name ??
                        `User ${selected.external_user_id.slice(-6)}`}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {selected.channel === "comment" ? "Comment thread" : "Direct message"}
                    </p>
                  </div>
                </div>
                <StatusBadge
                  tone={selected.status === "resolved" ? "neutral" : "success"}
                >
                  {selected.status}
                </StatusBadge>
              </div>

              <div className="flex-1 space-y-3 overflow-y-auto px-5 py-4">
                {messagesQuery.isLoading ? (
                  <div className="flex items-center justify-center py-10 text-sm text-muted-foreground">
                    <Loader2 className="mr-2 size-4 animate-spin" /> Loading messages…
                  </div>
                ) : (
                  (messagesQuery.data ?? []).map((m) => (
                    <div
                      key={m.id}
                      className={cn(
                        "max-w-[75%] rounded-lg px-3 py-2 text-sm",
                        m.direction === "outbound"
                          ? "ml-auto bg-primary text-primary-foreground"
                          : "bg-muted",
                      )}
                    >
                      <p className="whitespace-pre-wrap break-words">{m.body}</p>
                      <p
                        className={cn(
                          "mt-1 text-[10px]",
                          m.direction === "outbound"
                            ? "text-primary-foreground/70"
                            : "text-muted-foreground",
                        )}
                      >
                        {new Date(m.sent_at).toLocaleString()}
                      </p>
                    </div>
                  ))
                )}
              </div>

              {selected.channel === "comment" && selected.platform !== "youtube" ? (
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
                      commentMode === "public"
                        ? "Reply publicly under this comment…"
                        : "Send a private DM to this commenter…"
                    }
                    className="h-9 w-full rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
                    maxLength={1000}
                  />
                  <div className="flex flex-wrap items-center gap-2">
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
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={hideComment.isPending}
                      onClick={() => hideComment.mutate(true)}
                    >
                      <EyeOff className="size-4" />
                      Hide comment
                    </Button>
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
                    className="h-9 flex-1 rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
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
                  Replies from the inbox are only available for Instagram/Facebook DMs.
                </div>
              )}
            </>
          )}
        </Panel>
      </div>
    </AppShell>
  );
}
