import { useEffect, useState } from "react";
import { ImageOff, Image as ImageIcon, Film } from "lucide-react";

import { previewUrl } from "@/lib/media-upload";
import { fastImage } from "@/lib/fast-image";

const VIDEO_RE = /\.(mp4|mov|webm|m4v)(?:[?#]|$)|#video$/i;

/** Post preview: images show directly, videos show their first frame; anything broken falls back to a clean icon. */
export function PostThumbnail({ src: rawSrc }: { src: string | null }) {
  const [src, setSrc] = useState<string | null>(rawSrc && !rawSrc.startsWith("storage:") ? rawSrc : null);
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  useEffect(() => {
    let live = true;
    if (rawSrc?.startsWith("storage:")) {
      void previewUrl(rawSrc).then((u) => live && setSrc(u ? `${u}${VIDEO_RE.test(rawSrc) ? "" : ""}` : null)).catch(() => undefined);
    } else setSrc(rawSrc);
    return () => {
      live = false;
    };
  }, [rawSrc]);
  const isVideo = VIDEO_RE.test(rawSrc ?? "") || VIDEO_RE.test(src ?? "");
  const failed = !src || src === failedSrc;
  const Icon = isVideo ? Film : src === failedSrc ? ImageOff : ImageIcon;
  const videoSrc = src ? `${src.replace(/#video$/i, "")}#t=0.1` : "";
  return (
    <span className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded bg-muted text-muted-foreground">
      {failed ? (
        <Icon className="size-5" aria-label={isVideo ? "Video preview" : "Post preview unavailable"} />
      ) : isVideo ? (
        <video
          src={videoSrc}
          preload="metadata"
          muted
          playsInline
          aria-label="Video preview"
          className="pointer-events-none h-full w-full object-cover"
          onError={() => setFailedSrc(src)}
        />
      ) : (
        <img
          src={fastImage(src, 40) ?? src}
          alt=""
          loading="lazy"
          decoding="async"
          className="h-full w-full object-cover"
          onError={(e) => {
            const img = e.currentTarget;
            if (img.dataset.fallback !== "1" && img.src !== src) { img.dataset.fallback = "1"; img.src = src; }
            else setFailedSrc(src);
          }}
        />
      )}
    </span>
  );
}
