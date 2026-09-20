import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Workflow } from "lucide-react";

import { AdminTable } from "@/components/app/AdminTable";
import { EmptyState, PageHeader, Panel, StatusBadge } from "@/components/app/primitives";
import { listAdminAutomations } from "@/lib/admin.functions";

export const Route = createFileRoute("/_authenticated/admin/automations")({
  head: () => ({
    meta: [
      { title: "Automations — Techaasvik Operations" },
      { name: "description", content: "Every automation rule on the platform and its 24h volume." },
      { property: "og:title", content: "Automations — Techaasvik Operations" },
      { property: "og:description", content: "Automation oversight across all workspaces." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AdminAutomationsPage,
});

function AdminAutomationsPage() {
  const fetchRules = useServerFn(listAdminAutomations);
  const { data, isLoading } = useQuery({
    queryKey: ["admin-automations"],
    queryFn: () => fetchRules(),
    retry: false,
  });
  const rows = data ?? [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Automations"
        description="Rules across every workspace, with runs in the last 24 hours."
      />
      <Panel title={`${rows.length} rules`}>
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : rows.length === 0 ? (
          <EmptyState
            icon={Workflow}
            title="No automation rules"
            description="Rules created by workspaces appear here."
          />
        ) : (
          <AdminTable
            rows={rows}
            minWidth={820}
            columns={[
              { header: "Rule", cell: (r) => <span className="font-medium">{r.name}</span> },
              { header: "Workspace", cell: (r) => r.organizationName },
              { header: "Trigger", cell: (r) => r.trigger },
              { header: "Action", cell: (r) => r.action },
              {
                header: "Platform",
                cell: (r) => <span className="capitalize">{r.platform ?? "all"}</span>,
              },
              { header: "Runs (24h)", cell: (r) => <span className="num">{r.runs24h}</span> },
              {
                header: "State",
                cell: (r) => (
                  <StatusBadge tone={r.is_active ? "success" : "neutral"}>
                    {r.is_active ? "Active" : "Off"}
                  </StatusBadge>
                ),
              },
            ]}
          />
        )}
      </Panel>
    </div>
  );
}
