/** Poster URLs win; videos without a poster return the video URL (tagged #video) so the UI can show its first frame. */
export function postThumbnail(item: Record<string, string | undefined>): string | null {
  const poster = item['thumbnail_url'] || item['full_picture'];
  if (poster) return poster;
  const media = item['media_url'];
  if (!media) return null;
  const looksVideo = /\.(mp4|mov|webm|m4v)(?:[?#]|$)/i.test(media);
  if (item['media_type'] === 'VIDEO' && !looksVideo) return `${media}#video`;
  return media;
}

/** YouTube poster image for a video id. */
export function youtubeThumbnail(videoId: string): string {
  return `https://i.ytimg.com/vi/${encodeURIComponent(videoId)}/hqdefault.jpg`;
}
