import { useState } from "react";
import { ImageOff, Image as ImageIcon, Film } from "lucide-react";

export function PostThumbnail({ src }: { src: string | null }) {
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const isVideo = /\.(mp4|mov|webm)(?:[?#]|$)/i.test(src ?? "");
  const unavailable = !src || src === failedSrc || isVideo;
  const Icon = isVideo ? Film : src === failedSrc ? ImageOff : ImageIcon;
  return (
    <span className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded bg-muted text-muted-foreground">
      {unavailable ? <Icon className="size-5" aria-label={isVideo ? "Video preview" : "Post preview unavailable"} /> :
        <img src={src} alt="" className="h-full w-full object-cover" onError={() => setFailedSrc(src)} />}
    </span>
  );
}