import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { MessageSquare } from "lucide-react";
import { useState } from "react";

import { AppShell } from "@/components/app/AppShell";
import {
  EmptyState,
  PageHeader,
  Panel,
  PlatformBadge,
  StatusBadge,
} from "@/components/app/primitives";
import { Button } from "@/components/ui/button";
import { GuideButton } from "@/components/app/GuideButton";
import { useTenant } from "@/hooks/useTenant";
import { Pager, pageSlice } from "@/components/app/Pager";
import { listConversations } from "@/lib/inbox.functions";
import { contactLabel } from "@/lib/contact-name";

export const Route = createFileRoute("/_authenticated/comments")({
  head: () => ({
    meta: [
      { title: "Comments — AutoDM by Techaasvik" },
      {
        name: "description",
        content: "All Instagram and Facebook comment threads, with unread and status filters.",
      },
      { property: "og:title", content: "Comments" },
      {
        property: "og:description",
        content: "Review and answer comments from your connected pages and profiles.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: CommentsPage,
});

const FILTERS = [
  { key: "all", label: "All" },
  { key: "open", label: "Open" },
  { key: "pending", label: "Pending" },
  { key: "resolved", label: "Resolved" },
] as const;

function CommentsPage() {
  const { activeOrg } = useTenant();
  const orgId = activeOrg?.id ?? null;
  const [filter, setFilter] = useState<(typeof FILTERS)[number]["key"]>("all");
  const [platform, setPlatform] = useState<"all" | "instagram" | "facebook" | "youtube">("all");

  const fetchConversations = useServerFn(listConversations);
  const threads = useQuery({
    queryKey: ["conversations", orgId, "comments", filter, platform],
    enabled: !!orgId,
    refetchInterval: 30_000,
    queryFn: () =>
      fetchConversations({
        data: {
          organizationId: orgId!,
          channel: "comment",
          ...(platform === "all" ? {} : { platform }),
          ...(filter === "all" ? {} : { status: filter }),
        },
      }),
  });

  const allRows = threads.data ?? [];
  const [page, setPage] = useState(1);
  const rows = pageSlice(allRows, page, 10);

  return (
    <AppShell>
      <PageHeader
        title="Comments"
        description="Comment threads from Instagram and Facebook. Reply publicly or privately from the inbox."
        actions={
          <><GuideButton guide="meta-review" />
          <Button asChild>
            <Link to="/inbox">Open inbox</Link>
          </Button></>
        }
      />

      <Panel
        title={`Comment threads (${allRows.length})`}
        action={
          <div className="flex flex-wrap gap-1">
            <select
              aria-label="Platform"
              className="h-8 rounded-md border border-input bg-background px-2 text-sm"
              value={platform}
              onChange={(e) => { setPlatform(e.target.value as typeof platform); setPage(1); }}
            >
              <option value="all">All platforms</option>
              <option value="instagram">Instagram</option>
              <option value="facebook">Facebook</option>
              <option value="youtube">YouTube</option>
            </select>
            {FILTERS.map((f) => (
              <Button
                key={f.key}
                size="sm"
                variant={filter === f.key ? "default" : "outline"}
                onClick={() => { setFilter(f.key); setPage(1); }}
              >
                {f.label}
              </Button>
            ))}
          </div>
        }
      >
        {rows.length === 0 ? (
          <EmptyState
            icon={MessageSquare}
            title="No comments yet"
            description="Comments on your posts appear here as soon as an account is connected."
          />
        ) : (
          <div className="space-y-2">
            {rows.map((c) => (
              <Link
                key={c.id}
                to="/inbox"
                className="grid min-w-0 grid-cols-[auto_minmax(0,1fr)] items-center gap-3 rounded-xl border px-4 py-3 transition-colors hover:bg-surface-secondary sm:flex"
              >
                <PlatformBadge platform={c.platform} size="sm" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">
                    {contactLabel(c)}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                    {c.last_message_preview ?? "No preview"}
                  </p>
                </div>
                <div className="col-span-2 flex flex-wrap items-center gap-2 sm:shrink-0">
                  {c.unread_count > 0 && <StatusBadge tone="info">{c.unread_count} new</StatusBadge>}
                  <StatusBadge
                    tone={
                      c.status === "open" ? "warning" : c.status === "pending" ? "info" : "success"
                    }
                  >
                    {c.status}
                  </StatusBadge>
                  <span className="text-xs text-muted-foreground">
                    {new Date(c.last_message_at).toLocaleString()}
                  </span>
                </div>
              </Link>
            ))}
            <Pager page={page} total={allRows.length} perPage={10} onPage={setPage} />
          </div>
        )}
      </Panel>
    </AppShell>
  );
}
