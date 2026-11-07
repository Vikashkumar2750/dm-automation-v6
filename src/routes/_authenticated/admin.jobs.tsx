import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Gauge, RefreshCw } from "lucide-react";
import { toast } from "sonner";

import { AdminTable } from "@/components/app/AdminTable";
import { EmptyState, PageHeader, Panel, StatusBadge } from "@/components/app/primitives";
import { Button } from "@/components/ui/button";
import { listAdminJobs, requeueAdminJob } from "@/lib/admin.functions";

export const Route = createFileRoute("/_authenticated/admin/jobs")({
  head: () => ({
    meta: [
      { title: "Jobs & Queue — Techaasvik Operations" },
      { name: "description", content: "Scheduled, publishing and failed jobs with requeue control." },
      { property: "og:title", content: "Jobs & Queue — Techaasvik Operations" },
      { property: "og:description", content: "Queue health and job recovery." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: JobsPage,
});

function JobsPage() {
  const fetchJobs = useServerFn(listAdminJobs);
  const requeue = useServerFn(requeueAdminJob);
  const queryClient = useQueryClient();

  const jobs = useQuery({
    queryKey: ["admin-jobs"],
    queryFn: () => fetchJobs(),
    retry: false,
    refetchInterval: 30_000,
  });
  const { data, isLoading } = jobs;

  const requeueMutation = useMutation({
    mutationFn: (postId: string) => requeue({ data: { postId } }),
    onSuccess: () => {
      toast.success("Job requeued");
      void queryClient.invalidateQueries({ queryKey: ["admin-jobs"] });
    },
    onError: () => toast.error("Could not requeue this job"),
  });

  const rows = data ?? [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Jobs & Queue"
        description="Scheduled publishing work, stuck jobs and failures."
        actions={<Button variant="outline" size="icon" aria-label="Refresh publishing jobs" title="Refresh publishing jobs" disabled={jobs.isFetching} onClick={() => void jobs.refetch()}><RefreshCw className={jobs.isFetching ? "size-4 animate-spin" : "size-4"} /></Button>}
      />
      {jobs.isError && <div role="alert" className="border-l-2 border-warning bg-warning-soft px-4 py-3 text-sm">Publishing jobs could not be refreshed{data ? "; previously loaded results are shown." : "."}</div>}
      <Panel title={data ? `${rows.length} loaded publishing jobs (up to 100)` : "Publishing jobs"} description="Scheduled, publishing and failed posts; this limited list is not the total queue depth.">
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : !data ? <p className="text-sm text-muted-foreground">Publishing job data unavailable.</p> : rows.length === 0 ? (
          <EmptyState
            icon={Gauge}
            title="No jobs in the loaded results"
            description="Scheduled, publishing and failed posts appear here."
          />
        ) : (
          <AdminTable
            rows={rows}
            minWidth={880}
            columns={[
              {
                header: "Scheduled",
                cell: (j) => (j.scheduled_at ? new Date(j.scheduled_at).toLocaleString() : "—"),
              },
              { header: "Workspace", cell: (j) => j.organizationName },
              { header: "Platform", cell: (j) => <span className="capitalize">{j.platform}</span> },
              {
                header: "Status",
                cell: (j) => (
                  <StatusBadge
                    tone={
                      j.status === "failed"
                        ? "danger"
                        : j.status === "publishing"
                          ? "warning"
                          : "info"
                    }
                  >
                    {j.status}
                  </StatusBadge>
                ),
              },
              {
                header: "Detail",
                cell: (j) => (
                  <div className="max-w-sm">
                    <p className="line-clamp-2 text-muted-foreground">{j.caption}</p>
                    {j.error ? <p className="text-xs text-destructive">{j.error}</p> : null}
                  </div>
                ),
              },
              {
                header: "Action",
                cell: (j) =>
                  j.status === "scheduled" ? (
                    <span className="text-xs text-muted-foreground">Waiting</span>
                  ) : (
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={requeueMutation.isPending}
                      onClick={() => requeueMutation.mutate(j.id)}
                    >
                      Requeue
                    </Button>
                  ),
              },
            ]}
          />
        )}
      </Panel>
    </div>
  );
}
