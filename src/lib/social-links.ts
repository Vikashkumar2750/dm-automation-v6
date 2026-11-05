export const SOCIAL_PLATFORMS = ["instagram", "facebook", "linkedin", "youtube", "x"] as const;
export type SocialPlatform = (typeof SOCIAL_PLATFORMS)[number];
export type SocialLink = { platform: SocialPlatform; url: string; label?: string | undefined };

export const SOCIAL_LABELS: Record<SocialPlatform, string> = { instagram: "Instagram", facebook: "Facebook", linkedin: "LinkedIn", youtube: "YouTube", x: "X (Twitter)" };

const HOSTS: Record<SocialPlatform, RegExp> = {
  instagram: /(^|\.)instagram\.com$/i,
  facebook: /(^|\.)(facebook\.com|fb\.com|fb\.me|m\.me)$/i,
  linkedin: /(^|\.)linkedin\.com$/i,
  youtube: /(^|\.)(youtube\.com|youtu\.be)$/i,
  x: /(^|\.)(x\.com|twitter\.com)$/i,
};

/** Only https links on the platform's own domain are shown — blocks javascript: and look-alike links. */
export function validSocialUrl(platform: SocialPlatform, url: string): boolean {
  try { const u = new URL(url.trim()); return u.protocol === "https:" && HOSTS[platform].test(u.hostname); } catch { return false; }
}

/** Accepts a full URL or a bare @handle and returns a full https URL (or "" when unusable). */
export function normalizeSocialUrl(platform: SocialPlatform, input: string): string {
  const v = input.trim();
  if (!v) return "";
  if (/^https?:\/\//i.test(v)) { const s = v.replace(/^http:/i, "https:"); return validSocialUrl(platform, s) ? s : ""; }
  const h = v.replace(/^@/, "").replace(/[^\w.\-]/g, "");
  if (!h) return "";
  const base = { instagram: "https://instagram.com/", facebook: "https://facebook.com/", linkedin: "https://linkedin.com/in/", youtube: "https://youtube.com/@", x: "https://x.com/" }[platform];
  return base + h;
}

/** Profile link for a connected account (Instagram/Facebook/YouTube); null when not derivable. */
export function connectedAccountUrl(a: { platform: string; handle?: string | null; external_id?: string | null }): string | null {
  const handle = (a.handle ?? "").replace(/^@/, "").trim();
  if (a.platform === "instagram") return handle ? `https://instagram.com/${handle}` : null;
  if (a.platform === "facebook") return a.external_id ? `https://facebook.com/${a.external_id}` : null;
  if (a.platform === "youtube") return handle ? `https://youtube.com/@${handle}` : a.external_id ? `https://youtube.com/channel/${a.external_id}` : null;
  return null;
}

export function cleanSocials(list: SocialLink[] | undefined): SocialLink[] {
  const seen = new Set<string>();
  return (list ?? []).filter((s) => SOCIAL_PLATFORMS.includes(s.platform) && validSocialUrl(s.platform, s.url) && !seen.has(s.url) && seen.add(s.url)).slice(0, 10);
}
