import { useEffect, useState } from "react";
import { Heart, MessageCircle, Repeat2, Eye } from "lucide-react";

import { PostThumbnail } from "@/components/app/PostThumbnail";
import { previewUrl } from "@/lib/media-upload";

export const FORMAT_TABS = [
  { key: "all", label: "All" },
  { key: "feed", label: "Feed" },
  { key: "reel", label: "Reels" },
  { key: "story", label: "Stories" },
  { key: "carousel", label: "Carousels" },
] as const;

export type FormatTab = (typeof FORMAT_TABS)[number]["key"];

export function formatKey(postFormat: string | null | undefined): Exclude<FormatTab, "all"> {
  if (postFormat === "trial_reel" || postFormat === "reel") return "reel";
  if (postFormat === "story" || postFormat === "carousel") return postFormat;
  return "feed";
}

const LABEL: Record<Exclude<FormatTab, "all">, string> = {
  feed: "Feed",
  reel: "Reel",
  story: "Story",
  carousel: "Carousel",
};

export function FormatBadge({ postFormat }: { postFormat: string }) {
  return (
    <span className="rounded-full border px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
      {postFormat === "trial_reel" ? "Trial reel" : LABEL[formatKey(postFormat)]}
    </span>
  );
}

export function PostMediaThumb({ refs }: { refs: string[] }) {
  const first = refs[0] ?? null;
  const [src, setSrc] = useState<string | null>(null);
  useEffect(() => {
    let live = true;
    if (!first) return;
    void previewUrl(first).then((url) => live && setSrc(url ?? null)).catch(() => undefined);
    return () => {
      live = false;
    };
  }, [first]);
  return <PostThumbnail src={src} />;
}

export function StatsRow({ stats }: { stats?: undefined | { likes: number | null; comments: number | null; shares: number | null; views: number | null } }) {
  if (!stats) return null;
  const items = [
    { icon: Eye, value: stats.views, label: "views" },
    { icon: Heart, value: stats.likes, label: "likes" },
    { icon: MessageCircle, value: stats.comments, label: "comments" },
    { icon: Repeat2, value: stats.shares, label: "shares" },
  ].filter((i) => i.value !== null);
  return (
    <span className="mt-1 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
      {items.map(({ icon: Icon, value, label }) => (
        <span key={label} className="inline-flex items-center gap-1" title={label}>
          <Icon className="size-3.5" /> {value}
        </span>
      ))}
    </span>
  );
}
