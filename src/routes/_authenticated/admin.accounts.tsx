import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { RefreshCw, Share2 } from "lucide-react";

import { AdminTable } from "@/components/app/AdminTable";
import { EmptyState, PageHeader, Panel, StatusBadge } from "@/components/app/primitives";
import { listAdminAccounts } from "@/lib/admin.functions";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/admin/accounts")({
  head: () => ({
    meta: [
      { title: "Social Accounts — Techaasvik Operations" },
      { name: "description", content: "All connected Instagram, Facebook and YouTube accounts." },
      { property: "og:title", content: "Social Accounts — Techaasvik Operations" },
      { property: "og:description", content: "Connected account health across every workspace." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AccountsPage,
});

function AccountsPage() {
  const fetchAccounts = useServerFn(listAdminAccounts);
  const accounts = useQuery({
    queryKey: ["admin-accounts"],
    queryFn: () => fetchAccounts(),
    retry: false,
  });
  const { data, isLoading } = accounts;

  const rows = data ?? [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Social Accounts"
        description="Connection status and token expiry for every workspace."
        actions={<Button variant="outline" size="icon" aria-label="Refresh social accounts" title="Refresh social accounts" disabled={accounts.isFetching} onClick={() => void accounts.refetch()}><RefreshCw className={accounts.isFetching ? "size-4 animate-spin" : "size-4"} /></Button>}
      />
      {accounts.isError && <div role="alert" className="border-l-2 border-warning bg-warning-soft px-4 py-3 text-sm">Social accounts could not be refreshed{data ? "; previously loaded records are shown." : "."}</div>}
      <Panel title={data ? `${rows.length} loaded accounts` : "Social accounts"}>
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : !data ? <p className="text-sm text-muted-foreground">Account data unavailable.</p> : rows.length === 0 ? (
          <EmptyState
            icon={Share2}
            title="No accounts connected"
            description="Accounts appear here once a workspace connects a page or profile."
          />
        ) : (
          <AdminTable
            rows={rows}
            minWidth={820}
            columns={[
              {
                header: "Account",
                cell: (a) => (
                  <div>
                    <p className="font-medium">{a.name}</p>
                    <p className="text-xs text-muted-foreground">{a.handle ?? "—"}</p>
                  </div>
                ),
              },
              { header: "Workspace", cell: (a) => a.organizationName },
              { header: "Platform", cell: (a) => <span className="capitalize">{a.platform}</span> },
              {
                header: "Status",
                cell: (a) => (
                  <StatusBadge
                    tone={
                      a.status === "connected"
                        ? "success"
                        : a.status === "attention"
                          ? "warning"
                          : "danger"
                    }
                  >
                    {a.status}
                  </StatusBadge>
                ),
              },
              {
                header: "Token expires",
                cell: (a) =>
                  a.token_expires_at ? new Date(a.token_expires_at).toLocaleString() : "—",
              },
              {
                header: "Last synced",
                cell: (a) =>
                  a.last_synced_at ? new Date(a.last_synced_at).toLocaleString() : "—",
              },
            ]}
          />
        )}
      </Panel>
    </div>
  );
}
