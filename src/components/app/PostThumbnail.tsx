import { useState } from "react";
import { ImageOff, Image as ImageIcon, Film } from "lucide-react";

/** Post preview: images show directly, videos show their first frame; anything broken falls back to a clean icon. */
export function PostThumbnail({ src }: { src: string | null }) {
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const isVideo = /\.(mp4|mov|webm|m4v)(?:[?#]|$)/i.test(src ?? "");
  const failed = !src || src === failedSrc;
  const Icon = isVideo ? Film : src === failedSrc ? ImageOff : ImageIcon;
  return (
    <span className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded bg-muted text-muted-foreground">
      {failed ? (
        <Icon className="size-5" aria-label={isVideo ? "Video preview" : "Post preview unavailable"} />
      ) : isVideo ? (
        <video
          src={`${src}#t=0.1`}
          preload="metadata"
          muted
          playsInline
          aria-label="Video preview"
          className="pointer-events-none h-full w-full object-cover"
          onError={() => setFailedSrc(src)}
        />
      ) : (
        <img src={src} alt="" className="h-full w-full object-cover" onError={() => setFailedSrc(src)} />
      )}
    </span>
  );
}
