import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Webhook } from "lucide-react";
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

const FILTERS = ["all", "failed", "bad signature"] as const;

function WebhooksPage() {
  const fetchHooks = useServerFn(listAdminWebhooks);
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>("all");

  const { data, isLoading } = useQuery({
    queryKey: ["admin-webhooks"],
    queryFn: () => fetchHooks(),
    retry: false,
    refetchInterval: 30_000,
  });

  const rows = (data ?? []).filter((h) =>
    filter === "all"
      ? true
      : filter === "failed"
        ? h.status === "failed"
        : !h.signature_valid,
  );

  return (
    <div className="space-y-6">
      <PageHeader title="Webhooks" description="Incoming events from Instagram and Facebook." />
      <Panel
        title={`${rows.length} events`}
        action={
          <div className="flex gap-1">
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
        ) : rows.length === 0 ? (
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
