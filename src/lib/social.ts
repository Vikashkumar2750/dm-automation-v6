// Client-safe social platform metadata shared by UI and server code.

export type SocialPlatform = "instagram" | "facebook" | "youtube";

export type SocialAccountStatus = "connected" | "attention" | "disconnected";

export type SocialAccountRow = {
  id: string;
  platform: SocialPlatform;
  external_id: string;
  name: string;
  handle: string | null;
  avatar_url: string | null;
  status: SocialAccountStatus;
  scopes: string[];
  token_expires_at: string | null;
  last_synced_at: string | null;
  created_at: string;
};

export const platformMeta: Record<
  SocialPlatform,
  { label: string; blurb: string; capabilities: string[]; provider: "meta" | "google" }
> = {
  instagram: {
    label: "Instagram",
    blurb: "Business or Creator account linked to a Facebook Page.",
    capabilities: ["Comments", "Private replies", "Messaging", "Publishing", "Insights"],
    provider: "meta",
  },
  facebook: {
    label: "Facebook",
    blurb: "Facebook Page you manage.",
    capabilities: ["Comments", "Private replies", "Messaging", "Publishing", "Insights"],
    provider: "meta",
  },
  youtube: {
    label: "YouTube",
    blurb: "YouTube channel. Comments and analytics only — no direct messages.",
    capabilities: ["Comments", "Replies", "Publishing", "Analytics"],
    provider: "google",
  },
};

export const metaScopes = [
  "pages_show_list",
  "pages_manage_metadata",
  "pages_read_engagement",
  "pages_read_user_content",
  "pages_manage_engagement",
  "pages_messaging",
  "pages_manage_posts",
  "instagram_basic",
  "instagram_manage_comments",
  "instagram_manage_messages",
  "instagram_content_publish",
  "business_management",
];

export const googleScopes = [
  "https://www.googleapis.com/auth/youtube.readonly",
  "https://www.googleapis.com/auth/youtube.force-ssl",
  "https://www.googleapis.com/auth/yt-analytics.readonly",
];
