import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { FileClock, ShieldAlert } from "lucide-react";

import { AdminTable } from "@/components/app/AdminTable";
import { EmptyState, PageHeader, Panel, StatusBadge } from "@/components/app/primitives";
import { listAuditLog, listAdminWebhooks } from "@/lib/admin.functions";

export const Route = createFileRoute("/_authenticated/admin/audit")({
  head: () => ({
    meta: [
      { title: "Security & Audit — Techaasvik Operations" },
      { name: "description", content: "Admin actions log and rejected webhook signatures." },
      { property: "og:title", content: "Security & Audit — Techaasvik Operations" },
      { property: "og:description", content: "Audit trail for platform administrators." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AuditPage,
});

function AuditPage() {
  const fetchAudit = useServerFn(listAuditLog);
  const fetchHooks = useServerFn(listAdminWebhooks);

  const auditQuery = useQuery({
    queryKey: ["admin-audit"],
    queryFn: () => fetchAudit(),
    retry: false,
  });
  const hooksQuery = useQuery({
    queryKey: ["admin-webhooks"],
    queryFn: () => fetchHooks(),
    retry: false,
  });

  const rows = auditQuery.data ?? [];
  const suspicious = (hooksQuery.data ?? []).filter((h) => !h.signature_valid);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Security & Audit"
        description="Every administrative action is recorded, plus rejected incoming events."
      />

      <Panel title="Security events">
        {suspicious.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No rejected signatures in the recent event history.
          </p>
        ) : (
          <div className="space-y-2">
            {suspicious.slice(0, 10).map((h) => (
              <div
                key={h.id}
                className="flex items-center justify-between gap-3 rounded-lg border px-3 py-2 text-sm"
              >
                <span className="flex items-center gap-2">
                  <ShieldAlert className="size-4 text-danger" />
                  Rejected signature · {h.platform ?? "unknown"} · {h.event_type}
                </span>
                <span className="text-xs text-muted-foreground">
                  {new Date(h.received_at).toLocaleString()}
                </span>
              </div>
            ))}
          </div>
        )}
      </Panel>

      <Panel title="Admin audit log">
        {auditQuery.isLoading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : rows.length === 0 ? (
          <EmptyState
            icon={FileClock}
            title="No admin actions yet"
            description="Plan changes, pauses and access grants are recorded here."
          />
        ) : (
          <AdminTable
            rows={rows}
            minWidth={820}
            columns={[
              { header: "When", cell: (r) => new Date(r.created_at).toLocaleString() },
              { header: "Admin", cell: (r) => r.actor_email ?? "—" },
              {
                header: "Action",
                cell: (r) => <StatusBadge tone="info">{r.action}</StatusBadge>,
              },
              {
                header: "Target",
                cell: (r) => (
                  <span className="text-xs text-muted-foreground">
                    {r.target_type ? `${r.target_type} ${r.target_id ?? ""}` : "—"}
                  </span>
                ),
              },
              {
                header: "Detail",
                cell: (r) => (
                  <span className="block max-w-sm truncate text-xs text-muted-foreground">
                    {r.detail}
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
