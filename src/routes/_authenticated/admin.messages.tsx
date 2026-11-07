import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { MessageSquare, RefreshCw } from "lucide-react";

import { AdminTable } from "@/components/app/AdminTable";
import { EmptyState, PageHeader, Panel, StatusBadge } from "@/components/app/primitives";
import { listAdminMessages } from "@/lib/admin.functions";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/admin/messages")({
  head: () => ({
    meta: [
      { title: "Messages — Techaasvik Operations" },
      { name: "description", content: "Latest inbound and outbound messages across the platform." },
      { property: "og:title", content: "Messages — Techaasvik Operations" },
      { property: "og:description", content: "Message traffic monitoring for support and abuse." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AdminMessagesPage,
});

function AdminMessagesPage() {
  const fetchMessages = useServerFn(listAdminMessages);
  const messages = useQuery({
    queryKey: ["admin-messages"],
    queryFn: () => fetchMessages(),
    retry: false,
    refetchInterval: 60_000,
  });
  const { data, isLoading } = messages;
  const rows = data ?? [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Messages"
        description="Latest 100 messages platform-wide, for support and abuse investigation."
        actions={<Button variant="outline" size="icon" aria-label="Refresh messages" title="Refresh messages" disabled={messages.isFetching} onClick={() => void messages.refetch()}><RefreshCw className={messages.isFetching ? "size-4 animate-spin" : "size-4"} /></Button>}
      />
      {messages.isError && <div role="alert" className="border-l-2 border-warning bg-warning-soft px-4 py-3 text-sm">Messages could not be refreshed{data ? "; previously loaded records are shown." : "."}</div>}
      <Panel title={data ? `${rows.length} recent messages (up to 100)` : "Recent traffic"}>
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : !data ? <p className="text-sm text-muted-foreground">Message data unavailable.</p> : rows.length === 0 ? (
          <EmptyState
            icon={MessageSquare}
            title="No messages yet"
            description="Messages appear as soon as conversations start."
          />
        ) : (
          <AdminTable
            rows={rows}
            minWidth={820}
            columns={[
              { header: "When", cell: (m) => new Date(m.sent_at).toLocaleString() },
              { header: "Workspace", cell: (m) => m.organizationName },
              { header: "Platform", cell: (m) => <span className="capitalize">{m.platform}</span> },
              {
                header: "Direction",
                cell: (m) => (
                  <StatusBadge tone={m.direction === "inbound" ? "info" : "success"}>
                    {m.direction}
                  </StatusBadge>
                ),
              },
              {
                header: "Message",
                cell: (m) => (
                  <span className="line-clamp-2 block max-w-md text-muted-foreground">
                    {m.body}
                  </span>
                ),
              },
            ]}
          />
        )}
      </Panel>
    </div>
  );
}
