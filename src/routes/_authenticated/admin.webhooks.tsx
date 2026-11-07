import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { RefreshCw, Webhook } from "lucide-react";
import { useState } from "react";

import { AdminTable } from "@/components/app/AdminTable";
import { EmptyState, PageHeader, Panel, StatusBadge } from "@/components/app/primitives";
import { Button } from "@/components/ui/button";
import { listAdminWebhooks } from "@/lib/admin.functions";

export const Route = createFileRoute("/_authenticated/admin/webhooks")({
  head: () => ({
    meta: [
      { title: "Webhooks — Techaasvik Operations" },
      { name: "description", content: "Incoming platform events, signature checks and failures." },
      { property: "og:title", content: "Webhooks — Techaasvik Operations" },
      { property: "og:description", content: "Webhook delivery health." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: WebhooksPage,
});

const FILTERS = ["all", "verified failures", "bad signature"] as const;

function WebhooksPage() {
  const fetchHooks = useServerFn(listAdminWebhooks);
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>("all");

  const query = useQuery({
    queryKey: ["admin-webhooks"],
    queryFn: () => fetchHooks(),
    retry: false,
    refetchInterval: 30_000,
  });
  const { data, isLoading } = query;

  const rows = (data ?? []).filter((h) =>
    filter === "all"
      ? true
      : filter === "verified failures"
        ? h.signature_valid && h.status === "failed"
        : !h.signature_valid,
  );

  return (
    <div className="space-y-6">
      <PageHeader title="Webhooks" description="Latest incoming event sample; unsigned probes remain audited separately." actions={<Button variant="outline" size="icon" aria-label="Refresh webhooks" title="Refresh webhooks" disabled={query.isFetching} onClick={() => void query.refetch()}><RefreshCw className={query.isFetching ? "size-4 animate-spin" : "size-4"} /></Button>} />
      {query.isError && <div role="alert" className="border-l-2 border-warning bg-warning-soft px-4 py-3 text-sm">Events could not be refreshed{data ? "; previously loaded results are shown." : "."}</div>}
      <Panel
        title={data ? `${rows.length} of ${data.length} sampled events (up to 100)` : "Incoming events"}
        action={
          <div className="flex flex-wrap gap-1">
            {FILTERS.map((f) => (
              <Button
                key={f}
                size="sm"
                variant={filter === f ? "default" : "outline"}
                className="capitalize"
                onClick={() => setFilter(f)}
              >
                {f}
              </Button>
            ))}
          </div>
        }
      >
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : !data ? <p className="text-sm text-muted-foreground">Event data unavailable.</p> : rows.length === 0 ? (
          <EmptyState
            icon={Webhook}
            title="No events"
            description="Nothing matches this filter yet."
          />
        ) : (
          <AdminTable
            rows={rows}
            minWidth={820}
            columns={[
              { header: "Received", cell: (h) => new Date(h.received_at).toLocaleString() },
              {
                header: "Platform",
                cell: (h) => <span className="capitalize">{h.platform ?? "unknown"}</span>,
              },
              { header: "Event", cell: (h) => h.event_type },
              {
                header: "Signature",
                cell: (h) => (
                  <StatusBadge tone={h.signature_valid ? "success" : "danger"}>
                    {h.signature_valid ? "Valid" : "Invalid"}
                  </StatusBadge>
                ),
              },
              {
                header: "Status",
                cell: (h) => (
                  <StatusBadge
                    tone={
                      h.status === "failed"
                        ? "danger"
                        : h.status === "processed"
                          ? "success"
                          : "neutral"
                    }
                  >
                    {h.status}
                  </StatusBadge>
                ),
              },
              {
                header: "Error",
                cell: (h) => (
                  <span className="text-xs text-destructive">{h.error ?? ""}</span>
                ),
              },
            ]}
          />
        )}
      </Panel>
    </div>
  );
}
