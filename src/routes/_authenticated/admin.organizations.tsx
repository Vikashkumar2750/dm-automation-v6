import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Building2, RefreshCw, Search } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { AdminTable } from "@/components/app/AdminTable";
import { EmptyState, PageHeader, Panel, StatusBadge } from "@/components/app/primitives";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { filterAdminWorkspaces } from "@/lib/admin-directory";
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
  const [plan, setPlan] = useState("all");
  const [status, setStatus] = useState("all");
  const [sort, setSort] = useState("newest");
  const [drafts, setDrafts] = useState<Record<string, { plan: string; months: string }>>({});

  const overview = useQuery({
    queryKey: ["platform-overview"],
    queryFn: () => fetchOverview(),
    retry: false,
  });
  const { data, isLoading } = overview;

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

  const rows = filterAdminWorkspaces(data?.organizations ?? [], search, plan, status, sort);
  const filtered = Boolean(search.trim() || plan !== "all" || status !== "all");

  return (
    <div className="space-y-6">
      <PageHeader
        title="Workspaces"
        description="Workspace plans, account totals and automation status."
        actions={<Button variant="outline" size="icon" aria-label="Refresh workspaces" title="Refresh workspaces" disabled={overview.isFetching} onClick={() => void overview.refetch()}><RefreshCw className={overview.isFetching ? "size-4 animate-spin" : "size-4"} /></Button>}
      />
      {overview.isError && <div role="alert" className="flex flex-wrap items-center justify-between gap-3 border-l-2 border-warning bg-warning-soft px-4 py-3 text-sm"><span>Workspace list could not be refreshed.</span><Button variant="outline" size="sm" onClick={() => void overview.refetch()}>Try again</Button></div>}

      <Panel
        title={data ? `${rows.length} of ${data.organizations.length} workspaces` : "Workspaces"}
        action={
          <div className="flex w-full min-w-0 flex-wrap items-center gap-2">
          <div className="relative w-full sm:w-56"><Search className="pointer-events-none absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Name or slug"
            aria-label="Search workspace name or slug"
            className="h-9 w-full pl-8"
          />
          </div>
          <Select value={plan} onValueChange={setPlan}><SelectTrigger aria-label="Filter workspace plan" className="h-9 w-36"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">All plans</SelectItem>{PLANS.map((value) => <SelectItem key={value} value={value}>{value}</SelectItem>)}</SelectContent></Select>
          <Select value={status} onValueChange={setStatus}><SelectTrigger aria-label="Filter automation status" className="h-9 w-40"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">Any status</SelectItem><SelectItem value="active">Automation active</SelectItem><SelectItem value="paused">Automation paused</SelectItem></SelectContent></Select>
          <Select value={sort} onValueChange={setSort}><SelectTrigger aria-label="Sort workspaces" className="h-9 w-36"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="newest">Newest first</SelectItem><SelectItem value="name">Name A–Z</SelectItem><SelectItem value="accounts">Most accounts</SelectItem></SelectContent></Select>
          {filtered && <Button variant="ghost" size="sm" onClick={() => { setSearch(""); setPlan("all"); setStatus("all"); }}>Clear filters</Button>}
          </div>
        }
      >
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : !data ? <p className="text-sm text-muted-foreground">Workspace data unavailable.</p> : rows.length === 0 ? (
          <EmptyState
            icon={Building2}
            title={filtered ? "No matching workspaces" : "No workspaces"}
            description={filtered ? "Try another name, plan or automation status." : "Workspaces appear here as soon as people sign up."}
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
                    <span className="block text-xs text-muted-foreground">{o.slug}</span>
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
                      disabled={pauseMutation.isPending}
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
