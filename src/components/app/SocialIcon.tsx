import { Facebook, Instagram, Linkedin, Twitter, Youtube } from "lucide-react";
import { SOCIAL_LABELS, cleanSocials, type SocialLink, type SocialPlatform } from "@/lib/social-links";
import { cn } from "@/lib/utils";

const ICONS = { instagram: Instagram, facebook: Facebook, linkedin: Linkedin, youtube: Youtube, x: Twitter } as const;

export function SocialIcon({ platform, className }: { platform: SocialPlatform; className?: string }) {
  const I = ICONS[platform] ?? Instagram;
  return <I className={className} aria-hidden />;
}

/** Row of linked social logos; `size` sm for header, lg for footer. */
export function SocialLinks({ links, size = "sm" }: { links: SocialLink[] | undefined; size?: "sm" | "lg" }) {
  const list = cleanSocials(links);
  if (!list.length) return null;
  return (
    <div className={cn("flex flex-wrap items-center", size === "sm" ? "gap-1" : "gap-2")}>
      {list.map((s) => (
        <a key={s.url} href={s.url} target="_blank" rel="noopener noreferrer nofollow" aria-label={`${SOCIAL_LABELS[s.platform]}${s.label ? ` — ${s.label}` : ""}`} title={s.label || SOCIAL_LABELS[s.platform]}
          className={cn("grid place-items-center rounded-full border border-border text-muted-foreground transition-colors hover:border-primary hover:text-primary", size === "sm" ? "size-7" : "size-10")}>
          <SocialIcon platform={s.platform} className={size === "sm" ? "size-3.5" : "size-5"} />
        </a>
      ))}
    </div>
  );
}
