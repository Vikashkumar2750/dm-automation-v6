import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { StatusBadge } from "@/components/app/primitives";
import { listRecentRemotePosts, listTargetablePosts } from "@/lib/automations.functions";

/** Shared post/reel selector used by keyword rules and Flow Builder. Empty selection = all posts. */
function parsePostId(raw: string): string | null {
  const value = raw.trim();
  if (!value) return null;
  if (/^[A-Za-z0-9_\-]+$/.test(value)) return value;
  try {
    const url = new URL(value);
    const fromQuery =
      url.searchParams.get("story_fbid") ??
      url.searchParams.get("post_id") ??
      url.searchParams.get("v");
    if (fromQuery) return fromQuery;
    const parts = url.pathname.split("/").filter(Boolean);
    const last = parts[parts.length - 1];
    return last && /^[A-Za-z0-9_\-]+$/.test(last) ? last : null;
  } catch {
    return null;
  }
}

export function PostPicker({
  orgId,
  trigger,
  platform,
  selected,
  onChange,
}: {
  orgId: string | undefined;
  trigger: string;
  platform: "all" | "instagram" | "facebook" | "youtube";
  selected: string[];
  onChange: (ids: string[]) => void;
}) {
  const fetchPosts = useServerFn(listTargetablePosts);
  const fetchRemote = useServerFn(listRecentRemotePosts);
  const [manual, setManual] = useState("");
  const [showManual, setShowManual] = useState(false);
  const postsQuery = useQuery({
    queryKey: ["targetable-posts", orgId],
    enabled: Boolean(orgId),
    queryFn: () => fetchPosts({ data: { organizationId: orgId! } }),
  });
  const remoteQuery = useQuery({
    queryKey: ["remote-posts", orgId],
    enabled: Boolean(orgId),
    staleTime: 60_000,
    queryFn: () => fetchRemote({ data: { organizationId: orgId! } }),
  });

  const posts = useMemo(() => {
    const merged = new Map<
      string,
      {
        id: string;
        externalPostId: string;
        platform: string;
        caption: string;
        mediaUrl: string | null;
        publishedAt: string | null;
      }
    >();
    for (const post of remoteQuery.data?.posts ?? []) {
      merged.set(post.externalPostId, post);
    }
    for (const post of postsQuery.data ?? []) {
      if (!merged.has(post.externalPostId)) merged.set(post.externalPostId, post);
    }
    return [...merged.values()]
      .filter((post) =>
        platform === "youtube"
          ? post.platform === "youtube"
          : platform === "all"
            ? post.platform !== "youtube"
            : post.platform === platform,
      )
      .sort((a, b) => (b.publishedAt ?? "").localeCompare(a.publishedAt ?? ""));
  }, [remoteQuery.data, postsQuery.data, platform]);
  const warnings = remoteQuery.data?.warnings ?? [];

  const toggle = (externalId: string) => {
    onChange(
      selected.includes(externalId)
        ? selected.filter((id) => id !== externalId)
        : [...selected, externalId],
    );
  };

  const addManual = () => {
    const id = parsePostId(manual);
    if (!id) {
      toast.error("Paste a post link or post ID.");
      return;
    }
    if (!selected.includes(id)) onChange([...selected, id]);
    setManual("");
  };

  const extraIds = selected.filter(
    (id) => !posts.some((post) => post.externalPostId === id),
  );

  return (
    <div className="grid gap-3 rounded-lg border p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-medium">Which posts?</p>
          <p className="text-xs text-muted-foreground">
            {selected.length === 0
              ? "All posts — runs on every post."
              : `${selected.length} post${selected.length > 1 ? "s" : ""} selected.`}
          </p>
        </div>
        <div className="flex items-center gap-1">
          {selected.length > 0 && (
            <Button type="button" variant="ghost" size="sm" onClick={() => onChange([])}>
              Use all posts
            </Button>
          )}
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={remoteQuery.isFetching}
            onClick={() => void remoteQuery.refetch()}
          >
            {remoteQuery.isFetching ? "Refreshing…" : "Refresh"}
          </Button>
        </div>
      </div>

      {trigger === "dm_received" && (
        <p className="rounded-md bg-muted/50 p-2 text-xs text-muted-foreground">
          Direct messages don’t come from a single post, so this only applies when the
          rule is triggered by a comment. Switch “When” to <b>New comment</b> to limit a
          rule to one post.
        </p>
      )}

      {warnings.length > 0 && (
        <p className="rounded-md bg-muted/50 p-2 text-xs text-muted-foreground">
          {warnings.join(" · ")}
        </p>
      )}

      {postsQuery.isLoading || remoteQuery.isLoading ? (
        <p className="text-sm text-muted-foreground">Loading your latest posts…</p>
      ) : posts.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          {platform === "youtube"
            ? "No YouTube videos found yet. Publish a video from Create Post, or paste a video link below."
            : "No posts found. Connect an Instagram or Facebook account, or add a post link manually below."}
        </p>
      ) : (
        <div className="grid max-h-64 gap-2 overflow-y-auto pr-1">
          {posts.map((post) => {
            const isOn = selected.includes(post.externalPostId);
            return (
              <button
                key={post.id}
                type="button"
                onClick={() => toggle(post.externalPostId)}
                className={`flex items-center gap-3 rounded-md border p-2 text-left transition ${
                  isOn ? "border-primary bg-primary/5" : "hover:bg-muted/50"
                }`}
              >
                {post.mediaUrl ? (
                  <img
                    src={post.mediaUrl}
                    alt=""
                    className="h-10 w-10 shrink-0 rounded object-cover"
                  />
                ) : (
                  <div className="h-10 w-10 shrink-0 rounded bg-muted" />
                )}
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm">
                    {post.caption || "Untitled post"}
                  </span>
                  <span className="block text-xs capitalize text-muted-foreground">
                    {post.platform}
                    {post.publishedAt
                      ? ` · ${new Date(post.publishedAt).toLocaleDateString()}`
                      : ""}
                  </span>
                </span>
                {isOn && <StatusBadge tone="success">Selected</StatusBadge>}
              </button>
            );
          })}
        </div>
      )}

      {extraIds.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {extraIds.map((id) => (
            <button
              key={id}
              type="button"
              onClick={() => toggle(id)}
              className="rounded-full border px-3 py-1 text-xs hover:bg-muted"
              title="Remove"
            >
              {id} ✕
            </button>
          ))}
        </div>
      )}

      {showManual ? (
        <div className="flex gap-2">
          <Input
            value={manual}
            placeholder="Paste post link or post ID"
            onChange={(e) => setManual(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                addManual();
              }
            }}
          />
          <Button type="button" variant="outline" onClick={addManual}>
            Add
          </Button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setShowManual(true)}
          className="justify-self-start text-xs text-muted-foreground underline"
        >
          Can’t find a post? Add it by link or ID
        </button>
      )}
    </div>
  );
}
