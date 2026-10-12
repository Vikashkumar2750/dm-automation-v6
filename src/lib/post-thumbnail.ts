/** Poster URLs must win over video media URLs in image-only post previews. */
export function postThumbnail(item: Record<string, string | undefined>): string | null {
  const poster = item['thumbnail_url'] || item['full_picture'];
  if (poster) return poster;
  const media = item['media_url'];
  if (item['media_type'] === 'VIDEO' || /\.(mp4|mov|webm)(?:[?#]|$)/i.test(media ?? '')) return null;
  return media || null;
}