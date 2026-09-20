import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogFooter,
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
import { savePost, type Post } from "@/lib/publishing.functions";
import type { SocialAccountRow } from "@/lib/social";

export type ComposerDraft = {
  post?: Post;
  scheduledAt?: string | null;
};

/** Convert an ISO string to the value a datetime-local input expects (local time). */
function toLocalInput(iso: string | null | undefined) {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
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
  const queryClient = useQueryClient();
  const save = useServerFn(savePost);

  const [platform, setPlatform] = useState<"instagram" | "facebook">("instagram");
  const [accountId, setAccountId] = useState<string>("");
  const [caption, setCaption] = useState("");
  const [mediaUrl, setMediaUrl] = useState("");
  const [mediaType, setMediaType] = useState<"image" | "video">("image");
  const [when, setWhen] = useState("");

  useEffect(() => {
    if (!open) return;
    const post = draft?.post;
    const nextPlatform =
      post?.platform === "facebook" ? "facebook" : ("instagram" as const);
    setPlatform(nextPlatform);
    setCaption(post?.caption ?? "");
    setMediaUrl(post?.media_url ?? "");
    setMediaType(post?.media_type === "video" ? "video" : "image");
    setWhen(toLocalInput(post?.scheduled_at ?? draft?.scheduledAt ?? null));
    const fallback = accounts.find((a) => a.platform === nextPlatform);
    setAccountId(post?.social_account_id ?? fallback?.id ?? "");
  }, [open, draft, accounts]);

  const options = accounts.filter((a) => a.platform === platform);

  const mutation = useMutation({
    mutationFn: async (status: "draft" | "scheduled") =>
      save({
        data: {
          ...(draft?.post ? { id: draft.post.id } : {}),
          organizationId,
          socialAccountId: accountId || null,
          platform,
          caption,
          mediaUrl: mediaUrl.trim() ? mediaUrl.trim() : null,
          mediaType,
          scheduledAt: when ? new Date(when).toISOString() : null,
          status,
        },
      }),
    onSuccess: (_result, status) => {
      toast.success(status === "scheduled" ? "Post scheduled" : "Draft saved");
      void queryClient.invalidateQueries({ queryKey: ["posts", organizationId] });
      onOpenChange(false);
    },
    onError: (error: Error) =>
      toast.error(
        error.message === "not_allowed"
          ? "You do not have permission to publish for this workspace"
          : error.message,
      ),
  });

  const charCount = caption.length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{draft?.post ? "Edit post" : "New post"}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Platform</Label>
              <Select
                value={platform}
                onValueChange={(value) => {
                  const next = value as "instagram" | "facebook";
                  setPlatform(next);
                  setAccountId(accounts.find((a) => a.platform === next)?.id ?? "");
                }}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="instagram">Instagram</SelectItem>
                  <SelectItem value="facebook">Facebook Page</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Account</Label>
              <Select
                value={accountId}
                onValueChange={setAccountId}
                disabled={options.length === 0}
              >
                <SelectTrigger>
                  <SelectValue
                    placeholder={options.length ? "Choose" : "No account connected"}
                  />
                </SelectTrigger>
                <SelectContent>
                  {options.map((account) => (
                    <SelectItem key={account.id} value={account.id}>
                      {account.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="caption">Caption</Label>
            <Textarea
              id="caption"
              rows={5}
              value={caption}
              onChange={(event) => setCaption(event.target.value)}
              placeholder="Write your caption…"
            />
            <p className="num text-xs text-subtle-foreground">{charCount} / 2200</p>
          </div>

          <div className="grid grid-cols-[1fr_auto] gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="media">Media link</Label>
              <Input
                id="media"
                value={mediaUrl}
                onChange={(event) => setMediaUrl(event.target.value)}
                placeholder="https://…/photo.jpg"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Type</Label>
              <Select
                value={mediaType}
                onValueChange={(value) => setMediaType(value as "image" | "video")}
              >
                <SelectTrigger className="w-28">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="image">Image</SelectItem>
                  <SelectItem value="video">Video</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          {platform === "instagram" && (
            <p className="text-xs text-subtle-foreground">
              Instagram needs a public image or video link — text-only posts are not
              allowed by Instagram.
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

          {mediaUrl.trim() && mediaType === "image" && (
            <div className="overflow-hidden rounded-xl border">
              <img
                src={mediaUrl}
                alt="Post preview"
                className="max-h-56 w-full object-cover"
              />
            </div>
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button
            variant="outline"
            disabled={mutation.isPending}
            onClick={() => mutation.mutate("draft")}
          >
            Save draft
          </Button>
          <Button
            disabled={mutation.isPending || !when}
            onClick={() => mutation.mutate("scheduled")}
          >
            {mutation.isPending && <Loader2 className="mr-2 size-4 animate-spin" />}
            Schedule
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
