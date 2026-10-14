import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, MessageSquare } from "lucide-react";
import { PostThumbnail } from "@/components/app/PostThumbnail";
import { PlatformBadge } from "@/components/app/primitives";
import { Pager, pageSlice } from "@/components/app/Pager";
import { listRecentRemotePosts, type RemotePostItem } from "@/lib/automations.functions";
import { listPostCommentCounts } from "@/lib/post-journey.functions";

export type SidebarPost = RemotePostItem;
type Platform = "all" | "instagram" | "facebook" | "youtube";

export function usePosts(orgId: string | null) {
  const fetchRemote = useServerFn(listRecentRemotePosts);
  const fetchCounts = useServerFn(listPostCommentCounts);
  const posts = useQuery({ queryKey: ["remote-posts", orgId], enabled: !!orgId, staleTime: 60_000, queryFn: () => fetchRemote({ data: { organizationId: orgId! } }) });
  const counts = useQuery({ queryKey: ["post-comment-counts", orgId], enabled: !!orgId, refetchInterval: 30_000, queryFn: () => fetchCounts({ data: { organizationId: orgId! } }) });
  return { posts: posts.data?.posts ?? [], counts: counts.data ?? {}, loading: posts.isLoading };
}

/** Left column: posts with thumbnails, platform filter, 10 per page. */
export function PostSidebar({ orgId, selectedId, onSelect, countLabel = "comments" }: {
  orgId: string | null;
  selectedId: string | null;
  onSelect: (p: SidebarPost) => void;
  countLabel?: string;
}) {
  const { posts, counts, loading } = usePosts(orgId);
  const [platform, setPlatform] = useState<Platform>("all");
  const [page, setPage] = useState(1);
  const filtered = useMemo(() => {
    const list = platform === "all" ? posts : posts.filter((p) => p.platform === platform);
    // Posts with activity first, then newest.
    return [...list].sort((a, b) => (counts[b.externalPostId]?.comments ?? 0) - (counts[a.externalPostId]?.comments ?? 0) || (b.publishedAt ?? "").localeCompare(a.publishedAt ?? ""));
  }, [posts, platform, counts]);
  const rows = pageSlice(filtered, page, 10);

  return (
    <div className="min-w-0 space-y-2">
      <div className="flex flex-wrap gap-1">
        {(["all", "instagram", "facebook", "youtube"] as const).map((p) => (
          <button key={p} type="button" onClick={() => { setPlatform(p); setPage(1); }}
            className={`rounded-full border px-3 py-1 text-xs font-medium capitalize transition-colors ${platform === p ? "border-primary bg-primary text-primary-foreground" : "hover:bg-muted"}`}>
            {p === "all" ? "All" : p === "youtube" ? "YouTube" : p}
          </button>
        ))}
      </div>
      {loading ? <Loader2 className="mx-auto my-8 size-5 animate-spin text-muted-foreground" /> : rows.length === 0 ? (
        <p className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">No posts found.</p>
      ) : rows.map((p) => {
        const c = (counts[p.externalPostId] ?? counts[p.externalPostId.slice(p.externalPostId.lastIndexOf("_") + 1)])?.comments ?? 0;
        return (
          <button key={p.externalPostId} type="button" onClick={() => onSelect(p)}
            className={`grid w-full grid-cols-[auto_minmax(0,1fr)] items-center gap-3 rounded-xl border p-2 text-left transition-colors hover:bg-muted ${selectedId === p.externalPostId ? "border-primary bg-primary/5" : ""}`}>
            <PostThumbnail src={p.mediaUrl} />
            <span className="min-w-0">
              <span className="flex items-center gap-1.5"><PlatformBadge platform={p.platform} size="sm" /><span className="truncate text-xs text-muted-foreground">{p.accountName}</span></span>
              <span className="mt-0.5 line-clamp-2 text-xs font-medium">{p.caption || "Untitled post"}</span>
              <span className="mt-0.5 flex items-center gap-1 text-[11px] text-muted-foreground"><MessageSquare className="size-3" />{c} {countLabel}{p.publishedAt ? ` · ${new Date(p.publishedAt).toLocaleDateString()}` : ""}</span>
            </span>
          </button>
        );
      })}
      <Pager page={page} total={filtered.length} perPage={10} onPage={setPage} />
    </div>
  );
}
