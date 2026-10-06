import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Building2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { AdminTable } from "@/components/app/AdminTable";
import { EmptyState, PageHeader, Panel, StatusBadge } from "@/components/app/primitives";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  getPlatformOverview,
  setOrganizationAutomationPause,
  setOrganizationPlan,
} from "@/lib/admin.functions";

export const Route = createFileRoute("/_authenticated/admin/organizations")({
  head: () => ({
    meta: [
      { title: "Organizations — Techaasvik Operations" },
      { name: "description", content: "Every workspace on the platform with plan and usage." },
      { property: "og:title", content: "Organizations — Techaasvik Operations" },
      { property: "og:description", content: "Tenant management for the platform." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: OrganizationsPage,
});

const PLANS = ["starter", "pro", "agency"] as const;
const DURATIONS = [
  { value: "1", label: "1 month" },
  { value: "3", label: "3 months" },
  { value: "6", label: "6 months" },
  { value: "12", label: "1 year" },
  { value: "0", label: "No end date" },
];


function OrganizationsPage() {
  const fetchOverview = useServerFn(getPlatformOverview);
  const changePlan = useServerFn(setOrganizationPlan);
  const setPause = useServerFn(setOrganizationAutomationPause);
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [drafts, setDrafts] = useState<Record<string, { plan: string; months: string }>>({});

  const { data, isLoading } = useQuery({
    queryKey: ["platform-overview"],
    queryFn: () => fetchOverview(),
    retry: false,
  });

  const invalidate = () =>
    void queryClient.invalidateQueries({ queryKey: ["platform-overview"] });

  const planMutation = useMutation({
    mutationFn: (vars: { organizationId: string; plan: (typeof PLANS)[number]; months: number }) =>
      changePlan({ data: vars }),
    onSuccess: (_r, vars) => {
      setDrafts((d) => {
        const n = { ...d };
        delete n[vars.organizationId];
        return n;
      });
      toast.success("Plan updated");
      invalidate();
    },
    onError: () => toast.error("Could not update the plan"),
  });

  const pauseMutation = useMutation({
    mutationFn: (vars: { organizationId: string; paused: boolean }) => setPause({ data: vars }),
    onSuccess: () => {
      toast.success("Automation state updated");
      invalidate();
    },
    onError: () => toast.error("Could not update the workspace"),
  });

  const rows = (data?.organizations ?? []).filter((o) =>
    o.name.toLowerCase().includes(search.trim().toLowerCase()),
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Organizations"
        description="Tenant management: plans, usage and automation kill switch."
      />

      <Panel
        title={`${rows.length} workspaces`}
        action={
          <div className="flex items-center gap-2">
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search workspaces"
            className="h-9 w-56"
          />
          </div>
        }
      >
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : rows.length === 0 ? (
          <EmptyState
            icon={Building2}
            title="No workspaces"
            description="Workspaces appear here as soon as people sign up."
          />
        ) : (
          <AdminTable
            rows={rows}
            minWidth={1080}
            columns={[
              {
                header: "Workspace",
                cell: (o) => (
                  <Link
                    to="/admin/org/$orgId"
                    params={{ orgId: o.id }}
                    className="font-medium hover:underline"
                  >
                    {o.name}
                    <span className="block text-xs text-muted-foreground">
                      {new Date(o.created_at).toLocaleDateString()}
                    </span>
                  </Link>
                ),
              },
              { header: "Members", cell: (o) => <span className="num">{o.members}</span> },
              { header: "Accounts", cell: (o) => <span className="num">{o.accounts}</span> },
              { header: "Threads", cell: (o) => <span className="num">{o.conversations}</span> },
              { header: "Posts", cell: (o) => <span className="num">{o.posts}</span> },
              {
                header: "Plan & duration",
                cell: (o) => {
                  const d = drafts[o.id] ?? { plan: o.plan, months: "12" };
                  const set = (patch: Partial<typeof d>) =>
                    setDrafts((all) => ({ ...all, [o.id]: { ...d, ...patch } }));
                  return (
                    <div className="flex items-center gap-2">
                      <Select value={d.plan} onValueChange={(plan) => set({ plan })}>
                        <SelectTrigger className="h-8 w-[110px] capitalize" aria-label="Plan">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {PLANS.map((p) => (
                            <SelectItem key={p} value={p} className="capitalize">
                              {p}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Select value={d.months} onValueChange={(months) => set({ months })}>
                        <SelectTrigger className="h-8 w-[120px]" aria-label="Duration">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {DURATIONS.map((x) => (
                            <SelectItem key={x.value} value={x.value}>
                              {x.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Button
                        size="sm"
                        disabled={planMutation.isPending}
                        onClick={() =>
                          planMutation.mutate({
                            organizationId: o.id,
                            plan: d.plan as (typeof PLANS)[number],
                            months: Number(d.months),
                          })
                        }
                      >
                        Save
                      </Button>
                    </div>
                  );
                },
              },
              {
                header: "Automations",
                cell: (o) => (
                  <div className="flex items-center gap-2">
                    <StatusBadge tone={o.automationsPaused ? "warning" : "success"}>
                      {o.automationsPaused ? "Paused" : "Active"}
                    </StatusBadge>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() =>
                        pauseMutation.mutate({
                          organizationId: o.id,
                          paused: !o.automationsPaused,
                        })
                      }
                    >
                      {o.automationsPaused ? "Resume" : "Pause"}
                    </Button>
                  </div>
                ),
              },
            ]}
          />
        )}
      </Panel>
    </div>
  );
}
