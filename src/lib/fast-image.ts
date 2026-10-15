/**
 * Small, cached copy of a remote post image (Meta/YouTube CDNs serve full-size originals).
 * Uses the public wsrv.nl image cache to resize + convert to WebP; callers fall back to the original on error.
 */
export function fastImage(url: string | null | undefined, width: number): string | null {
  if (!url) return null;
  if (!/^https:\/\//i.test(url) || /#video$/i.test(url) || /\.(mp4|mov|webm|m4v)(?:[?#]|$)/i.test(url)) return url;
  if (/^https:\/\/i\.ytimg\.com\//i.test(url) && width <= 160) return url.replace(/\/(hq|sd|maxres)default\.jpg/i, "/mqdefault.jpg");
  return `https://wsrv.nl/?url=${encodeURIComponent(url)}&w=${width * 2}&fit=cover&output=webp&q=70`;
}
