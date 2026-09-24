import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { CreditCard } from "lucide-react";
import { toast } from "sonner";

import { AdminTable } from "@/components/app/AdminTable";
import { PageHeader, Panel, StatCard, StatusBadge } from "@/components/app/primitives";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { getPlatformOverview, grantOrganizationPlan, listPlanOrders } from "@/lib/admin.functions";
import { formatPaise } from "@/lib/plans";
import { PlanEditorPanel } from "@/components/app/PlatformConfigPanels";

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
  starter: { price: "₹9 for 3 days trial", entitlements: "1 account each · automation · AI analysis" },
  pro: { price: "₹59/mo · ₹299/6mo · ₹599/yr", entitlements: "5 accounts each · multi-publish · priority support" },
  agency: { price: "Custom", entitlements: "Unlimited accounts · client workspaces · branding" },
};

function PlansPage() {
  const fetchOverview = useServerFn(getPlatformOverview);
  const fetchOrders = useServerFn(listPlanOrders);
  const grantPlan = useServerFn(grantOrganizationPlan);
  const queryClient = useQueryClient();

  const [orgId, setOrgId] = useState("");
  const [plan, setPlan] = useState<"starter" | "pro" | "agency">("pro");
  const [months, setMonths] = useState("12");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);

  const { data } = useQuery({
    queryKey: ["platform-overview"],
    queryFn: () => fetchOverview(),
    retry: false,
  });
  const orders = useQuery({
    queryKey: ["plan-orders"],
    queryFn: () => fetchOrders(),
    retry: false,
  });

  const orgs = data?.organizations ?? [];
  const mrr = orgs.reduce((sum, o) => sum + (o.plan === "pro" ? 59 : 0), 0);

  async function onGrant() {
    if (!orgId) return;
    setSaving(true);
    try {
      await grantPlan({
        data: { organizationId: orgId, plan, months: Number(months) || 0, note: note || undefined },
      });
      toast.success("Plan given to the workspace — no payment needed.");
      setNote("");
      await queryClient.invalidateQueries({ queryKey: ["platform-overview"] });
      await queryClient.invalidateQueries({ queryKey: ["plan-orders"] });
    } catch {
      toast.error("Could not update the plan.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Plans & Billing"
        description="Plan mix, entitlements, payments and free plan grants."
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

      <PlanEditorPanel />

      <Panel title="Give a plan without payment">
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <p className="mb-1 text-xs text-muted-foreground">Workspace</p>
            <Select value={orgId} onValueChange={setOrgId}>
              <SelectTrigger>
                <SelectValue placeholder="Choose a workspace" />
              </SelectTrigger>
              <SelectContent>
                {orgs.map((o) => (
                  <SelectItem key={o.id} value={o.id}>
                    {o.name} · {o.plan}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <p className="mb-1 text-xs text-muted-foreground">Plan</p>
            <Select value={plan} onValueChange={(v) => setPlan(v as typeof plan)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="starter">Free</SelectItem>
                <SelectItem value="pro">Pro</SelectItem>
                <SelectItem value="agency">Agency</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <p className="mb-1 text-xs text-muted-foreground">Months (0 = no end date)</p>
            <Input value={months} onChange={(e) => setMonths(e.target.value)} inputMode="numeric" />
          </div>
          <div>
            <p className="mb-1 text-xs text-muted-foreground">Reason (optional)</p>
            <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Partner deal" />
          </div>
        </div>
        <Button className="mt-4" disabled={!orgId || saving} onClick={onGrant}>
          {saving ? "Saving…" : "Give this plan"}
        </Button>
      </Panel>

      <Panel title="Recent payments and grants">
        <AdminTable
          rows={orders.data ?? []}
          minWidth={720}
          columns={[
            { header: "Plan", cell: (o) => <span className="capitalize">{o.plan}</span> },
            {
              header: "Cycle",
              cell: (o) => <span>{String(o.billing_cycle).replace(/_/g, " ")}</span>,
            },
            { header: "Amount", cell: (o) => <span className="num">{formatPaise(o.amount_paise)}</span> },
            {
              header: "Source",
              cell: (o) => <StatusBadge tone="info">{o.mode}</StatusBadge>,
            },
            {
              header: "Status",
              cell: (o) => (
                <StatusBadge tone={o.status === "paid" ? "success" : "warning"}>{o.status}</StatusBadge>
              ),
            },
            {
              header: "When",
              cell: (o) => (
                <span className="num text-xs">
                  {new Date(o.created_at).toLocaleString("en-IN")}
                </span>
              ),
            },
          ]}
        />
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
