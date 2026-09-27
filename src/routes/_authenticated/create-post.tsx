import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { Loader2, PenSquare, Plus, Send, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { AppShell } from "@/components/app/AppShell";
import {
  EmptyState,
  PageHeader,
  Panel,
  PlatformBadge,
  StatusBadge,
} from "@/components/app/primitives";
import { PostComposer, type ComposerDraft } from "@/components/app/PostComposer";
import { Button } from "@/components/ui/button";
import { useTenant } from "@/hooks/useTenant";
import { listSocialAccounts } from "@/lib/social-accounts.functions";
import {
  deletePost,
  listPosts,
  publishNow,
  type Post,
} from "@/lib/publishing.functions";

export const Route = createFileRoute("/_authenticated/create-post")({
  head: () => ({
    meta: [
      { title: "Create Post — AutoDM by Techaasvik" },
      {
        name: "description",
        content: "Compose once, schedule and publish to Instagram and Facebook.",
      },
      { property: "og:title", content: "Create Post — AutoDM by Techaasvik" },
      {
        property: "og:description",
        content: "Compose once, schedule and publish to Instagram and Facebook.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: CreatePostPage,
});

export const statusTone = {
  draft: "neutral",
  scheduled: "info",
  publishing: "warning",
  published: "success",
  failed: "danger",
} as const;

export function formatWhen(iso: string | null) {
  if (!iso) return "No date";
  return new Date(iso).toLocaleString("en-IN", {
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
  });
}

function CreatePostPage() {
  const { activeOrg } = useTenant();
  const queryClient = useQueryClient();
  const orgId = activeOrg?.id ?? "";

  const fetchPosts = useServerFn(listPosts);
  const fetchAccounts = useServerFn(listSocialAccounts);
  const publish = useServerFn(publishNow);
  const remove = useServerFn(deletePost);

  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<ComposerDraft | null>(null);

  const postsQuery = useQuery({
    queryKey: ["posts", orgId],
    queryFn: () => fetchPosts({ data: { organizationId: orgId } }),
    enabled: Boolean(orgId),
  });

  const accountsQuery = useQuery({
    queryKey: ["social-accounts", orgId],
    queryFn: () => fetchAccounts({ data: { organizationId: orgId } }),
    enabled: Boolean(orgId),
  });

  const invalidate = () =>
    void queryClient.invalidateQueries({ queryKey: ["posts", orgId] });

  const publishMutation = useMutation({
    mutationFn: (id: string) => publish({ data: { id } }),
    onSuccess: () => {
      toast.success("Published");
      invalidate();
    },
    onError: (error: Error) => {
      toast.error(error.message);
      invalidate();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => remove({ data: { id } }),
    onSuccess: () => {
      toast.success("Post deleted");
      invalidate();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const posts = postsQuery.data ?? [];
  const accounts = accountsQuery.data ?? [];

  const openNew = () => {
    setDraft(null);
    setOpen(true);
  };
  const openEdit = (post: Post) => {
    setDraft({ post });
    setOpen(true);
  };

  return (
    <AppShell>
      <PageHeader
        title="Create Post"
        description="Compose once, schedule it, and let the queue publish for you."
        actions={
          <Button onClick={openNew}>
            <Plus className="mr-2 size-4" /> New post
          </Button>
        }
      />

      <Panel title="Your posts" bodyClassName="p-0">
        {postsQuery.isLoading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="size-5 animate-spin text-muted-foreground" />
          </div>
        ) : posts.length === 0 ? (
          <div className="p-5">
            <EmptyState
              icon={PenSquare}
              title="No posts yet"
              description="Write your first caption, pick a time, and it will go out automatically."
              action={
                <Button onClick={openNew}>
                  <Plus className="mr-2 size-4" /> New post
                </Button>
              }
            />
          </div>
        ) : (
          <ul className="divide-y">
            {posts.map((post) => (
              <li
                key={post.id}
                className="flex flex-wrap items-start gap-3 px-5 py-4"
              >
                <PlatformBadge platform={post.platform} size="sm" />
                <button
                  type="button"
                  onClick={() => openEdit(post)}
                  className="min-w-0 flex-1 text-left"
                >
                  <p className="truncate text-sm font-medium">
                    {post.caption.trim() || "(no caption)"}
                  </p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {post.status === "published"
                      ? `Published ${formatWhen(post.published_at)}`
                      : formatWhen(post.scheduled_at)}
                    {post.error ? ` · ${post.error}` : ""}
                  </p>
                </button>
                <div className="flex items-center gap-2">
                  <StatusBadge tone={statusTone[post.status]}>
                    {post.status}
                  </StatusBadge>
                  {post.status !== "published" && (
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={publishMutation.isPending}
                      onClick={() => publishMutation.mutate(post.id)}
                    >
                      <Send className="mr-1.5 size-3.5" /> Publish now
                    </Button>
                  )}
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => deleteMutation.mutate(post.id)}
                    aria-label="Delete post"
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Panel>

      {orgId && (
        <PostComposer
          open={open}
          onOpenChange={setOpen}
          organizationId={orgId}
          accounts={accounts}
          draft={draft}
        />
      )}
    </AppShell>
  );
}
