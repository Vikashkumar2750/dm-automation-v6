import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { CreditCard } from "lucide-react";

import { AdminTable } from "@/components/app/AdminTable";
import { PageHeader, Panel, StatCard, StatusBadge } from "@/components/app/primitives";
import { getPlatformOverview } from "@/lib/admin.functions";

export const Route = createFileRoute("/_authenticated/admin/plans")({
  head: () => ({
    meta: [
      { title: "Plans & Billing — Techaasvik Operations" },
      { name: "description", content: "Plan mix, entitlements and revenue-relevant workspace data." },
      { property: "og:title", content: "Plans & Billing — Techaasvik Operations" },
      { property: "og:description", content: "Plan management across the platform." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: PlansPage,
});

const PRICING: Record<string, { price: string; entitlements: string }> = {
  starter: { price: "₹0", entitlements: "2 accounts · 1,000 automated replies · 3 seats" },
  pro: { price: "₹2,499/mo", entitlements: "10 accounts · 25,000 replies · 10 seats · AI" },
  agency: { price: "₹7,999/mo", entitlements: "Unlimited accounts · client workspaces · branding" },
};

function PlansPage() {
  const fetchOverview = useServerFn(getPlatformOverview);
  const { data } = useQuery({
    queryKey: ["platform-overview"],
    queryFn: () => fetchOverview(),
    retry: false,
  });

  const orgs = data?.organizations ?? [];
  const mrr = orgs.reduce(
    (sum, o) => sum + (o.plan === "pro" ? 2499 : o.plan === "agency" ? 7999 : 0),
    0,
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Plans & Billing"
        description="Plan mix and entitlements. Plan changes are made per workspace."
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          icon={CreditCard}
          label="Monthly recurring"
          value={`₹${mrr.toLocaleString("en-IN")}`}
          sub="From current plan assignments"
        />
        {data?.byPlan.map((p) => (
          <StatCard
            key={p.plan}
            icon={CreditCard}
            label={`${p.plan} workspaces`}
            value={String(p.count)}
            sub={PRICING[p.plan]?.price ?? ""}
          />
        ))}
      </div>

      <Panel title="Plan entitlements">
        <div className="space-y-3">
          {Object.entries(PRICING).map(([plan, info]) => (
            <div key={plan} className="rounded-lg border px-3 py-2 text-sm">
              <div className="flex items-center justify-between">
                <span className="font-medium capitalize">{plan}</span>
                <span className="num">{info.price}</span>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">{info.entitlements}</p>
            </div>
          ))}
        </div>
      </Panel>

      <Panel
        title="Workspaces by plan"
        action={
          <Link to="/admin/organizations" className="text-sm font-medium text-primary">
            Change plans
          </Link>
        }
      >
        <AdminTable
          rows={orgs}
          minWidth={720}
          columns={[
            { header: "Workspace", cell: (o) => <span className="font-medium">{o.name}</span> },
            { header: "Plan", cell: (o) => <StatusBadge tone="info">{o.plan}</StatusBadge> },
            { header: "Accounts", cell: (o) => <span className="num">{o.accounts}</span> },
            { header: "Members", cell: (o) => <span className="num">{o.members}</span> },
            {
              header: "Value",
              cell: (o) => (
                <span className="num">{PRICING[o.plan]?.price ?? "—"}</span>
              ),
            },
          ]}
        />
      </Panel>
    </div>
  );
}
