import { createFileRoute } from "@tanstack/react-router";
import { AccountSafetyPanel } from "@/components/app/AccountSafetyPanel";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Gauge, PauseCircle, Send, ShieldAlert, SkipForward, RefreshCw } from "lucide-react";
import { toast } from "sonner";

import { AppShell } from "@/components/app/AppShell";
import { EmptyState, PageHeader, Panel, StatCard, UsageMeter } from "@/components/app/primitives";
import { Button } from "@/components/ui/button";
import { useTenant } from "@/hooks/useTenant";
import {
  getAutomationSettings,
  getAutomationUsage,
  resumeAutomations,
} from "@/lib/automations.functions";
import { getPlanUsage } from "@/lib/plan-limits.functions";

export const Route = createFileRoute("/_authenticated/usage")({
  head: () => ({
    meta: [
      { title: "Usage & Limits — AutoDM by Techaasvik" },
      {
        name: "description",
        content: "Automated sends this hour and today, skips, failures and safety limits.",
      },
      { property: "og:title", content: "Usage & Limits" },
      {
        property: "og:description",
        content: "Track automated replies against your hourly and daily sending limits.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: UsagePage,
});

function UsagePage() {
  const { activeOrg } = useTenant();
  const orgId = activeOrg?.id ?? null;
  const queryClient = useQueryClient();

  const fetchUsage = useServerFn(getAutomationUsage);
  const fetchSettings = useServerFn(getAutomationSettings);
  const resume = useServerFn(resumeAutomations);
  const fetchPlanUsage = useServerFn(getPlanUsage);
  const planUsage = useQuery({
    queryKey: ["plan-usage", orgId],
    enabled: !!orgId,
    queryFn: () => fetchPlanUsage({ data: { organizationId: orgId! } }),
  });
  const pu = planUsage.data;

  const usage = useQuery({
    queryKey: ["automation-usage", orgId],
    enabled: !!orgId,
    refetchInterval: 20_000,
    queryFn: () => fetchUsage({ data: { organizationId: orgId! } }),
  });

  const settings = useQuery({
    queryKey: ["automation-settings", orgId],
    enabled: !!orgId,
    queryFn: () => fetchSettings({ data: { organizationId: orgId! } }),
  });

  const resumeMutation = useMutation({
    mutationFn: () => resume({ data: { organizationId: orgId! } }),
    onSuccess: () => {
      toast.success("Automations resumed");
      void queryClient.invalidateQueries();
    },
    onError: () => toast.error("Could not resume automations"),
  });

  const u = usage.data;
  const s = settings.data;
  const autoPaused = u?.autoPausedUntil && new Date(u.autoPausedUntil) > new Date();

  return (
    <AppShell>
      <PageHeader
        title="Usage & Limits"
        description="Workspace activity, monthly plan usage and per-account safety limits."
        actions={<Button size="sm" variant="outline" disabled={!orgId || usage.isFetching || settings.isFetching || planUsage.isFetching} onClick={() => { void usage.refetch(); void settings.refetch(); void planUsage.refetch(); void queryClient.invalidateQueries({ queryKey: ["account-safety", orgId] }); }}><RefreshCw className="size-4" />Refresh</Button>}
      />

      {!orgId ? (
        <Panel title="Usage">
          <EmptyState icon={Gauge} title="No workspace" description="Join a workspace to see usage." />
        </Panel>
      ) : (
        <div className="space-y-6">
          {(usage.isError || settings.isError || planUsage.isError) && <p role="alert" className="text-sm text-destructive">Some usage or settings could not be refreshed. Previously loaded values may be out of date; refresh to retry.</p>}
          <p className="text-xs text-muted-foreground">Activity below counts workspace-wide sent/skipped/failed steps over rolling 1-hour and 24-hour windows—not billable automation journeys. Monthly quota counts distinct runs across all connected accounts.</p>
          {(autoPaused || s?.is_paused) && (
            <Panel title="Automations paused">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-sm text-muted-foreground">
                  {s?.is_paused
                    ? "The workspace kill switch is on — no automated replies are being sent."
                    : `Paused automatically: ${u?.autoPauseReason ?? "traffic spike"}.`}
                </p>
                {autoPaused && (
                  <Button onClick={() => resumeMutation.mutate()} disabled={resumeMutation.isPending || usage.isError || settings.isError || !s}>
                    <PauseCircle className="size-4" />
                    Resume now
                  </Button>
                )}
              </div>
            </Panel>
          )}

          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard icon={Send} label="Sent · last hour" value={u ? String(u.sentLastHour) : "—"} sub={u ? "Workspace sent steps" : usage.isError ? "Unavailable" : "Loading…"} />
            <StatCard icon={Send} label="Sent · last 24 hours" value={u ? String(u.sentLastDay) : "—"} sub={u ? "Workspace sent steps" : usage.isError ? "Unavailable" : "Loading…"} />
            <StatCard icon={SkipForward} label="Skipped · last 24 hours" value={u ? String(u.skippedLastDay) : "—"} sub="Safety rules or caps" />
            <StatCard icon={ShieldAlert} label="Failed · last 24 hours" value={u ? String(u.failedLastDay) : "—"} sub={u ? `${u.inboundLastHour} events in last hour` : "Events unavailable"} />
          </div>

          <Panel title="Your plan this month">
            {!pu ? <p role="status" className="text-sm text-muted-foreground">{planUsage.isError ? "Monthly plan usage unavailable." : "Loading monthly plan usage…"}</p> : <>
            <div className="grid gap-5 sm:grid-cols-2">
              {pu?.monthlyDms == null ? (
                <p className="text-sm">Automation runs this month: <span className="num font-medium">{pu.dmsThisMonth}</span> (unlimited)</p>
              ) : (
                <UsageMeter label="Automation runs this month (1 run = 1, however many steps)" used={pu.dmsThisMonth} limit={pu.monthlyDms || 1} unit="runs" />
              )}
              {pu?.maxRules == null ? (
                <p className="text-sm">Active rules: <span className="num font-medium">{pu?.activeRules ?? 0}</span> (unlimited)</p>
              ) : (
                <UsageMeter label="Active rules" used={pu.activeRules} limit={pu.maxRules || 1} unit="rules" />
              )}
            </div>
            </>}
          </Panel>

          <Panel title="Workspace default safety limits">
            {!u ? <p role="status" className="text-sm text-muted-foreground">{usage.isError ? "Safety defaults unavailable." : "Loading safety defaults…"}</p> : <div className="grid gap-5 sm:grid-cols-2 text-sm">
              <p>Hourly default: <span className="num font-semibold">{u.hourlyLimit}</span></p>
              <p>Daily default: <span className="num font-semibold">{u.dailyLimit}</span></p>
            </div>
            }
            <p className="mt-3 text-xs text-muted-foreground">Defaults apply per connected account and may be overridden or capped. Effective account limits are shown below; workspace-wide activity is not compared to one account's cap.</p>
          </Panel>

          <Panel title="Safety settings">
            {!s ? <p role="status" className="text-sm text-muted-foreground">{settings.isError ? "Safety settings unavailable." : "Loading safety settings…"}</p> :
            <dl className="grid gap-4 text-sm sm:grid-cols-2 xl:grid-cols-3">
              <div>
                <dt className="text-muted-foreground">Per-contact daily cap</dt>
                <dd className="num font-medium">{s?.per_contact_daily_limit ?? "—"}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Quiet hours</dt>
                <dd className="font-medium">
                  {s?.quiet_hours_enabled ? `${s.quiet_hours_start}:00 – ${s.quiet_hours_end}:00` : "Off"}
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Spike protection</dt>
                <dd className="font-medium">
                  {s?.viral_guard_enabled
                    ? `${s.viral_threshold_per_minute}/min → pause ${s.viral_cooldown_minutes} min`
                    : "Off"}
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Blocked words</dt>
                <dd className="font-medium">{s?.blocked_keywords.length ?? 0}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Opt-out words</dt>
                <dd className="break-words font-medium">{s?.opt_out_keywords.join(", ") || "—"}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Plan</dt>
                <dd className="font-medium">{activeOrg?.plan ?? "—"}</dd>
              </div>
            </dl>
            }
          </Panel>
        </div>
      )}
      {orgId && <div className="mt-6"><AccountSafetyPanel orgId={orgId} planLimit={planUsage.data?.monthlyDms ?? null} /></div>}
    </AppShell>
  );
}
