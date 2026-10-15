import type { Post } from "./publishing.functions";
import type { RemotePostItem } from "./automations.functions";

/** Match remote copies by connected account as well as provider ID. */
export function calendarPosts(stored: Post[], remote: RemotePostItem[], organizationId: string): Post[] {
  const seen = new Set(stored.filter((p) => p.external_post_id).map((p) => `${p.social_account_id}:${p.external_post_id}`));
  return [...stored, ...remote.filter((p) => !seen.has(`${p.socialAccountId}:${p.externalPostId}`)).map((p): Post => ({
    id: `remote:${p.id}`, organization_id: organizationId, social_account_id: p.socialAccountId,
    platform: p.platform, caption: p.caption, media_url: p.mediaUrl, media_urls: p.mediaUrl ? [p.mediaUrl] : [],
    post_format: p.platform === "youtube" || p.mediaType === "REELS" ? "reel" : p.mediaType === "CAROUSEL_ALBUM" ? "carousel" : p.mediaType === "STORY" ? "story" : "feed",
    media_type: p.mediaType === "VIDEO" || p.mediaType === "REELS" ? "video" : "image",
    group_id: null, scheduled_at: null, status: "published", external_post_id: p.externalPostId,
    permalink: p.permalink, error: null, published_at: p.publishedAt, created_at: p.publishedAt ?? "",
  }))];
}