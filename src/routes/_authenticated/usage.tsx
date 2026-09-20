import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Gauge, PauseCircle, Send, ShieldAlert, SkipForward } from "lucide-react";
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

export const Route = createFileRoute("/_authenticated/usage")({
  head: () => ({
    meta: [
      { title: "Usage & Limits — DM FB-IG-YT by Techaasvik" },
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
        description="How many automated replies went out, and how close you are to your safety limits."
      />

      {!orgId ? (
        <Panel title="Usage">
          <EmptyState icon={Gauge} title="No workspace" description="Join a workspace to see usage." />
        </Panel>
      ) : (
        <div className="space-y-6">
          {(autoPaused || s?.is_paused) && (
            <Panel title="Automations paused">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-sm text-muted-foreground">
                  {s?.is_paused
                    ? "The workspace kill switch is on — no automated replies are being sent."
                    : `Paused automatically: ${u?.autoPauseReason ?? "traffic spike"}.`}
                </p>
                {autoPaused && (
                  <Button onClick={() => resumeMutation.mutate()} disabled={resumeMutation.isPending}>
                    <PauseCircle className="size-4" />
                    Resume now
                  </Button>
                )}
              </div>
            </Panel>
          )}

          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard icon={Send} label="Sent this hour" value={String(u?.sentLastHour ?? 0)} sub={`Limit ${u?.hourlyLimit ?? 0}`} />
            <StatCard icon={Send} label="Sent today" value={String(u?.sentLastDay ?? 0)} sub={`Limit ${u?.dailyLimit ?? 0}`} />
            <StatCard icon={SkipForward} label="Skipped today" value={String(u?.skippedLastDay ?? 0)} sub="Safety rules or caps" />
            <StatCard icon={ShieldAlert} label="Failed today" value={String(u?.failedLastDay ?? 0)} sub={`${u?.inboundLastHour ?? 0} events this hour`} />
          </div>

          <Panel title="Against your limits">
            <div className="grid gap-5 sm:grid-cols-2">
              <UsageMeter label="Hourly sends" used={u?.sentLastHour ?? 0} limit={u?.hourlyLimit || 1} unit="replies" />
              <UsageMeter label="Daily sends" used={u?.sentLastDay ?? 0} limit={u?.dailyLimit || 1} unit="replies" />
            </div>
          </Panel>

          <Panel title="Safety settings">
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
                <dd className="font-medium">{s?.opt_out_keywords.join(", ") || "—"}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Plan</dt>
                <dd className="font-medium">{activeOrg?.plan ?? "—"}</dd>
              </div>
            </dl>
          </Panel>
        </div>
      )}
    </AppShell>
  );
}
