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

function OrganizationsPage() {
  const fetchOverview = useServerFn(getPlatformOverview);
  const changePlan = useServerFn(setOrganizationPlan);
  const setPause = useServerFn(setOrganizationAutomationPause);
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["platform-overview"],
    queryFn: () => fetchOverview(),
    retry: false,
  });

  const invalidate = () =>
    void queryClient.invalidateQueries({ queryKey: ["platform-overview"] });

  const planMutation = useMutation({
    mutationFn: (vars: { organizationId: string; plan: (typeof PLANS)[number] }) =>
      changePlan({ data: vars }),
    onSuccess: () => {
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
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search workspaces"
            className="h-9 w-56"
          />
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
            minWidth={880}
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
                header: "Plan",
                cell: (o) => (
                  <Select
                    value={o.plan}
                    onValueChange={(plan) =>
                      planMutation.mutate({
                        organizationId: o.id,
                        plan: plan as (typeof PLANS)[number],
                      })
                    }
                  >
                    <SelectTrigger className="h-8 w-[130px] capitalize">
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
                ),
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
