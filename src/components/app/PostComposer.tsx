import { useEffect, useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { CheckCircle2, Circle, Loader2, Upload, X, XCircle } from "lucide-react";
import { toast } from "sonner";

import { PlatformBadge } from "@/components/app/primitives";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { savePost, publishNow, type Post } from "@/lib/publishing.functions";
import { fitImageToRatio, imageSize, previewUrl, uploadPostMedia } from "@/lib/media-upload";
import { combinedRule, describeRatio, fitTarget, ratioFits } from "@/lib/aspect-ratio";
import type { SocialAccountRow } from "@/lib/social";

export type ComposerDraft = {
  post?: Post;
  scheduledAt?: string | null;
  /** Open as a new copy of `post` instead of editing it. */
  duplicate?: boolean;
};

type Progress = { id: string; label: string; state: "waiting" | "running" | "done" | "failed"; detail?: string };

type PostFormat = "feed" | "reel" | "story" | "carousel" | "trial_reel";

const formats: { value: PostFormat; label: string; hint: string }[] = [
  { value: "feed", label: "Feed post", hint: "One photo or video in the main feed" },
  { value: "carousel", label: "Carousel", hint: "2–10 photos swiped side to side" },
  { value: "reel", label: "Reel", hint: "Vertical video, also shared to the feed" },
  { value: "story", label: "Story", hint: "Story that disappears in 24h (no caption shown)" },
  { value: "trial_reel", label: "Trial reel (Instagram)", hint: "Shown to non-followers first, not on your profile grid. Share it to followers later from the Instagram app if it performs well." },
];

/** Convert an ISO string to the value a datetime-local input expects (local time). */
function toLocalInput(iso: string | null | undefined) {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function MediaThumb({ refValue, isVideo, onRemove }: { refValue: string; isVideo: boolean; onRemove: () => void }) {
  const [url, setUrl] = useState("");
  useEffect(() => {
    let active = true;
    void previewUrl(refValue).then((value) => {
      if (active) setUrl(value);
    });
    return () => {
      active = false;
    };
  }, [refValue]);

  return (
    <div className="relative size-20 overflow-hidden rounded-lg border bg-surface-secondary">
      {url ? (
        isVideo ? (
          <video src={url} className="size-full object-cover" muted />
        ) : (
          <img src={url} alt="" className="size-full object-cover" />
        )
      ) : (
        <div className="flex size-full items-center justify-center">
          <Loader2 className="size-4 animate-spin text-muted-foreground" />
        </div>
      )}
      <button
        type="button"
        onClick={onRemove}
        aria-label="Remove media"
        className="absolute right-1 top-1 rounded-full bg-background/90 p-0.5"
      >
        <X className="size-3" />
      </button>
    </div>
  );
}

/**
 * The composer fields themselves, usable both inside the dialog and as a
 * standalone full page. `onDone` fires after a save/publish completes.
 */
export function PostComposerForm({
  organizationId,
  accounts,
  draft,
  onDone,
}: {
  organizationId: string;
  accounts: SocialAccountRow[];
  draft: ComposerDraft | null;
  onDone: () => void;
}) {
  const queryClient = useQueryClient();
  const save = useServerFn(savePost);
  const publish = useServerFn(publishNow);
  const fileInput = useRef<HTMLInputElement>(null);

  const [selected, setSelected] = useState<string[]>([]);
  const [caption, setCaption] = useState("");
  const [media, setMedia] = useState<string[]>([]);
  const [mediaType, setMediaType] = useState<"image" | "video">("image");
  const [format, setFormat] = useState<PostFormat>("feed");
  const [link, setLink] = useState("");
  const [when, setWhen] = useState("");
  const [uploading, setUploading] = useState(false);
  const [alsoStory, setAlsoStory] = useState(false);
  const [title, setTitle] = useState("");
  const [ytTitle, setYtTitle] = useState("");
  const [ytDescription, setYtDescription] = useState("");
  const [ytTags, setYtTags] = useState("");
  const [alsoTrialReel, setAlsoTrialReel] = useState(false);
  const [progress, setProgress] = useState<Progress[] | null>(null);

  // Instagram, Facebook and YouTube (video only) can publish.
  const publishable = accounts.filter(
    (a) => a.platform === "instagram" || a.platform === "facebook" || a.platform === "youtube",
  );

  const editing = Boolean(draft?.post) && !draft?.duplicate;
  const storyEligible = !editing && (format === "feed" || format === "reel" || format === "trial_reel");

  // Load content from the draft (runs when the draft changes, e.g. dialog opens).
  useEffect(() => {
    const post = draft?.post;
    setCaption(post?.caption ?? "");
    setMedia(post?.media_urls?.length ? post.media_urls : post?.media_url ? [post.media_url] : []);
    setMediaType(post?.media_type === "video" ? "video" : "image");
    setFormat(((post?.post_format as PostFormat) ?? "feed") || "feed");
    setWhen(toLocalInput(post?.scheduled_at ?? draft?.scheduledAt ?? null));
    setLink("");
    setAlsoStory(false);
    setTitle("");
    setYtTitle("");
    setYtDescription("");
    setYtTags("");
    setAlsoTrialReel(false);
    setProgress(null);
    setSelected(
      post?.social_account_id ? [post.social_account_id] : [],
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft]);

  // Default to the only connected account once the list is available.
  useEffect(() => {
    if (draft?.post) return;
    setSelected((current) =>
      current.length === 0 && publishable.length === 1 ? [publishable[0]!.id] : current,
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accounts, draft]);

  function toggleAccount(id: string) {
    setSelected((current) =>
      editing
        ? [id]
        : current.includes(id)
          ? current.filter((value) => value !== id)
          : [...current, id],
    );
  }

  const [sizes, setSizes] = useState<Record<string, { width: number; height: number }>>({});
  useEffect(() => {
    if (mediaType !== "image") return;
    for (const ref of media) {
      if (sizes[ref]) continue;
      void imageSize(ref)
        .then((size) => setSizes((current) => ({ ...current, [ref]: size })))
        .catch(() => undefined);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [media, mediaType]);
  const selectedPlatforms = publishable.filter((a) => selected.includes(a.id)).map((a) => a.platform);
  const ratioRuleNow = combinedRule(selectedPlatforms, format);
  const hasYouTube = selectedPlatforms.includes("youtube");
  const hasMeta = selectedPlatforms.includes("instagram") || selectedPlatforms.includes("facebook");
  const trialEligible = !editing && selectedPlatforms.includes("instagram") && mediaType === "video" && (format === "feed" || format === "reel");
  const badMedia = mediaType === "image"
    ? media.filter((ref) => sizes[ref] && !ratioFits(sizes[ref]!.width / sizes[ref]!.height, ratioRuleNow))
    : [];

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    setUploading(true);
    try {
      const uploaded: string[] = [];
      for (const file of Array.from(files).slice(0, 10)) {
        uploaded.push(await uploadPostMedia(organizationId, file));
        if (file.type.startsWith("video")) setMediaType("video");
      }
      setMedia((current) => [...current, ...uploaded].slice(0, 10));
      toast.success(uploaded.length === 1 ? "Media uploaded" : `${uploaded.length} files uploaded`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Upload failed");
    } finally {
      setUploading(false);
      if (fileInput.current) fileInput.current.value = "";
    }
  }

  const mutation = useMutation({
    mutationFn: async (mode: "draft" | "scheduled" | "now") => {
      const status = mode === "draft" ? "draft" : "scheduled";
      // Wrong-ratio photos are padded (never stretched) to fit the platform.
      let finalMedia = media;
      if (mode !== "draft" && mediaType === "image" && ratioRuleNow && badMedia.length > 0) {
        finalMedia = await Promise.all(
          media.map(async (ref) => {
            const size = sizes[ref];
            if (!size || ratioFits(size.width / size.height, ratioRuleNow)) return ref;
            try {
              return await fitImageToRatio(organizationId, ref, fitTarget(size.width / size.height, ratioRuleNow));
            } catch {
              return ref;
            }
          }),
        );
        setMedia(finalMedia);
        toast.message("Photos were fitted to the platform size without stretching");
      }
      const result = await save({
        data: {
          ...(editing && draft?.post ? { id: draft.post.id } : {}),
          organizationId,
          socialAccountIds: selected,
          caption,
          media: finalMedia,
          mediaType,
          postFormat: format,
          scheduledAt:
            mode === "now"
              ? new Date().toISOString()
              : when
                ? new Date(when).toISOString()
                : null,
          status,
          alsoStory: storyEligible && alsoStory,
          title,
          youtubeTitle: ytTitle,
          youtubeDescription: ytDescription,
          youtubeTags: ytTags.split(",").map((t) => t.trim()).filter(Boolean).slice(0, 15),
          alsoTrialReel: trialEligible && alsoTrialReel,
        },
      });
      const storyIds: string[] = "storyIds" in result ? (result.storyIds as string[]) : [];
      const trialIds: string[] = "trialIds" in result ? (result.trialIds as string[]) : [];
      const all = [...result.ids, ...storyIds, ...trialIds];
      if (mode === "now") {
        const nameOf = (index: number) => {
          if (index >= result.ids.length + storyIds.length) return "Instagram — Trial reel";
          const isStory = index >= result.ids.length;
          const account = selectedAccounts[(isStory ? index - result.ids.length : index)];
          return `${account?.name ?? "Account"} — ${isStory ? "Story" : formats.find((f) => f.value === format)?.label ?? "Post"}`;
        };
        const steps: Progress[] = all.map((id, index) => ({ id, label: nameOf(index), state: "waiting" }));
        setProgress(steps);
        const update = (id: string, patch: Partial<Progress>) =>
          setProgress((current) => current?.map((step) => (step.id === id ? { ...step, ...patch } : step)) ?? null);
        // Publish everywhere at the same time; one failure never blocks the others.
        let failed = 0;
        await Promise.all(
          all.map(async (id) => {
            update(id, { state: "running" });
            try {
              await publish({ data: { id } });
              update(id, { state: "done" });
            } catch (error) {
              failed += 1;
              update(id, { state: "failed", detail: error instanceof Error ? error.message : "Failed" });
            }
          }),
        );
        void queryClient.invalidateQueries({ queryKey: ["posts", organizationId] });
        if (failed > 0) {
          toast.error(`${failed} of ${all.length} posts failed — check the Posts list for details`);
          if (failed === all.length) throw new Error("Publishing failed on all accounts");
        }
        return { ids: all, failed };
      }
      return { ids: all, failed: 0 };
    },
    onSuccess: (result, status) => {
      const count = result.ids.length - result.failed;
      toast.success(
        status === "now"
          ? count > 1
            ? `Published on ${count} accounts`
            : "Post published"
          : status === "scheduled"
          ? count > 1
            ? `Scheduled on ${count} accounts`
            : "Post scheduled"
          : "Draft saved",
      );
      void queryClient.invalidateQueries({ queryKey: ["posts", organizationId] });
      // Let the user see the finished progress briefly, then close automatically.
      setTimeout(() => {
        setProgress(null);
        onDone();
      }, status === "now" ? 900 : 0);
    },
    onError: (error: Error) =>
      toast.error(
        error.message === "not_allowed"
          ? "You do not have permission to publish for this workspace"
          : error.message,
      ),
  });

  // Keep the same order the server used when creating rows.
  const selectedAccounts = publishable.filter((a) => selected.includes(a.id));
  const igSelected = publishable.some(
    (a) => selected.includes(a.id) && a.platform === "instagram",
  );
  const disabled = mutation.isPending || uploading || selected.length === 0;

  return (
    <>
      <div className="space-y-4">
        <div className="space-y-2">
          <Label>Publish to</Label>
          {publishable.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Connect an Instagram or Facebook account first.
            </p>
          ) : (
            <div className="space-y-1.5 rounded-xl border p-2">
              {publishable.map((account) => (
                <label
                  key={account.id}
                  className="flex cursor-pointer items-center gap-3 rounded-lg px-2 py-1.5 hover:bg-surface-secondary"
                >
                  <Checkbox
                    checked={selected.includes(account.id)}
                    onCheckedChange={() => toggleAccount(account.id)}
                  />
                  <PlatformBadge platform={account.platform} size="sm" />
                  <span className="min-w-0 flex-1 truncate text-sm">{account.name}</span>
                </label>
              ))}
              {!editing && publishable.length > 1 && (
                <button
                  type="button"
                  className="px-2 text-xs text-primary"
                  onClick={() =>
                    setSelected(
                      selected.length === publishable.length
                        ? []
                        : publishable.map((a) => a.id),
                    )
                  }
                >
                  {selected.length === publishable.length ? "Clear all" : "Select all"}
                </button>
              )}
            </div>
          )}
        </div>

        <div className="space-y-1.5">
          <Label>Post type</Label>
          <Select value={format} onValueChange={(value) => setFormat(value as PostFormat)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {formats.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-subtle-foreground">
            {formats.find((f) => f.value === format)?.hint}
          </p>
        </div>

        {hasMeta && (
          <div className="space-y-1.5">
            <Label htmlFor="post-title">Title (optional)</Label>
            <Input id="post-title" value={title} maxLength={150} onChange={(e) => setTitle(e.target.value)} placeholder="Shown as the first line of the Instagram / Facebook caption" />
          </div>
        )}

        <div className="space-y-1.5">
          <Label htmlFor="caption">Caption</Label>
          <Textarea
            id="caption"
            rows={5}
            value={caption}
            onChange={(event) => setCaption(event.target.value)}
            placeholder="Write your caption…"
          />
          <p className="num text-xs text-subtle-foreground">{caption.length} / 2200</p>
        </div>

        <div className="space-y-2">
          <Label>Media</Label>
          <div className="flex flex-wrap gap-2">
            {media.map((ref, index) => (
              <MediaThumb
                key={`${ref}-${index}`}
                refValue={ref}
                isVideo={mediaType === "video"}
                onRemove={() => setMedia((current) => current.filter((_, i) => i !== index))}
              />
            ))}
            <button
              type="button"
              onClick={() => fileInput.current?.click()}
              disabled={uploading}
              className="flex size-20 flex-col items-center justify-center gap-1 rounded-lg border border-dashed text-xs text-muted-foreground hover:bg-surface-secondary"
            >
              {uploading ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <>
                  <Upload className="size-4" />
                  Upload
                </>
              )}
            </button>
          </div>
          <input
            ref={fileInput}
            type="file"
            accept="image/*,video/*"
            multiple
            className="hidden"
            onChange={(event) => void handleFiles(event.target.files)}
          />
          <div className="flex gap-2">
            <Input
              value={link}
              onChange={(event) => setLink(event.target.value)}
              placeholder="…or paste a public media link"
            />
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                if (!/^https?:\/\//.test(link.trim())) {
                  toast.error("Paste a link that starts with https://");
                  return;
                }
                setMedia((current) => [...current, link.trim()].slice(0, 10));
                setLink("");
              }}
            >
              Add
            </Button>
          </div>
          <div className="flex items-center gap-2">
            <Label className="text-xs text-muted-foreground">Media is</Label>
            <Select
              value={mediaType}
              onValueChange={(value) => setMediaType(value as "image" | "video")}
            >
              <SelectTrigger className="h-8 w-28">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="image">Photos</SelectItem>
                <SelectItem value="video">Video</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {storyEligible && (
          <label className="flex cursor-pointer items-start gap-3 rounded-xl border p-3">
            <Checkbox checked={alsoStory} onCheckedChange={(v) => setAlsoStory(v === true)} />
            <span className="space-y-0.5">
              <span className="block text-sm font-medium">Also publish to Story</span>
              <span className="block text-xs text-muted-foreground">
                Instagram and Facebook only. Uses the first photo or video, without the caption. Best in 9:16, videos up to 60 seconds. Facebook stories take photos only.
              </span>
            </span>
          </label>
        )}

        {hasYouTube && (
          <div className="space-y-3 rounded-xl border p-3">
            <p className="text-sm font-medium">YouTube details</p>
            <div className="space-y-1.5">
              <Label htmlFor="yt-title">Video title</Label>
              <Input id="yt-title" value={ytTitle} maxLength={100} onChange={(e) => setYtTitle(e.target.value)} placeholder="Leave empty to use the title or first caption line" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="yt-desc">Description</Label>
              <Textarea id="yt-desc" rows={4} value={ytDescription} maxLength={5000} onChange={(e) => setYtDescription(e.target.value)} placeholder="Leave empty to use the caption" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="yt-tags">Tags</Label>
              <Input id="yt-tags" value={ytTags} onChange={(e) => setYtTags(e.target.value)} placeholder="cooking, recipe, quick meals" />
              <p className="text-xs text-muted-foreground">Separate with commas. Up to 15 tags.</p>
            </div>
          </div>
        )}

        {trialEligible && (
          <label className="flex cursor-pointer items-start gap-3 rounded-xl border p-3">
            <Checkbox checked={alsoTrialReel} onCheckedChange={(v) => setAlsoTrialReel(v === true)} />
            <span className="space-y-0.5">
              <span className="block text-sm font-medium">Also post a copy as Trial reel</span>
              <span className="block text-xs text-muted-foreground">
                Instagram only. A duplicate is posted as a trial reel, shown to non-followers first. Facebook has no trial reels.
              </span>
            </span>
          </label>
        )}

        {format === "trial_reel" && mediaType !== "video" && (
          <p className="text-xs text-warning">A trial reel needs a video.</p>
        )}

        {badMedia.length > 0 && ratioRuleNow && (
          <div role="alert" className="rounded-xl border border-destructive/40 bg-destructive/10 p-3 text-xs text-destructive">
            <p className="font-medium">Wrong photo size for this post</p>
            <p className="mt-1">
              {badMedia.length === 1 ? "1 photo is" : `${badMedia.length} photos are`}{" "}
              {describeRatio(sizes[badMedia[0]!]!.width, sizes[badMedia[0]!]!.height)} — this post needs {ratioRuleNow.label}.
              If you publish anyway, we'll fit it to the right size without stretching (the empty sides get a soft blurred fill).
            </p>
          </div>
        )}

        {igSelected && media.length === 0 && (
          <p className="text-xs text-warning">
            Instagram needs at least one photo or video — a text-only post will fail there.
          </p>
        )}

        <div className="space-y-1.5">
          <Label htmlFor="when">Schedule for</Label>
          <Input
            id="when"
            type="datetime-local"
            value={when}
            onChange={(event) => setWhen(event.target.value)}
          />
        </div>
      </div>

      {progress && (
        <div className="mt-4 space-y-2 rounded-xl border p-3">
          <p className="text-sm font-medium">Publishing progress</p>
          <ul className="space-y-1.5">
            {progress.map((step) => (
              <li key={step.id} className="flex items-start gap-2 text-sm">
                {step.state === "running" ? (
                  <Loader2 className="mt-0.5 size-4 shrink-0 animate-spin text-primary" />
                ) : step.state === "done" ? (
                  <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-success" />
                ) : step.state === "failed" ? (
                  <XCircle className="mt-0.5 size-4 shrink-0 text-destructive" />
                ) : (
                  <Circle className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                )}
                <span className="min-w-0">
                  <span className="block truncate">{step.label}</span>
                  {step.detail && <span className="block text-xs text-destructive">{step.detail}</span>}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="mt-5 flex flex-wrap justify-end gap-2">
        <Button variant="outline" disabled={disabled} onClick={() => mutation.mutate("draft")}>
          {mutation.isPending && mutation.variables === "draft" && <Loader2 className="mr-2 size-4 animate-spin" />}
          Save draft
        </Button>
        <Button disabled={disabled || !when} onClick={() => mutation.mutate("scheduled")}>
          {mutation.isPending && mutation.variables === "scheduled" && <Loader2 className="mr-2 size-4 animate-spin" />}
          Schedule
        </Button>
        <Button disabled={disabled} variant="secondary" onClick={() => mutation.mutate("now")}>
          {mutation.isPending && mutation.variables === "now" && <Loader2 className="mr-2 size-4 animate-spin" />}
          Publish now
        </Button>
      </div>
    </>
  );
}

export function PostComposer({
  open,
  onOpenChange,
  organizationId,
  accounts,
  draft,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  organizationId: string;
  accounts: SocialAccountRow[];
  draft: ComposerDraft | null;
}) {
  const editing = Boolean(draft?.post) && !draft?.duplicate;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{editing ? "Edit post" : draft?.duplicate ? "Duplicate post" : "New post"}</DialogTitle>
        </DialogHeader>
        <PostComposerForm
          organizationId={organizationId}
          accounts={accounts}
          draft={draft}
          onDone={() => onOpenChange(false)}
        />
      </DialogContent>
    </Dialog>
  );
}
