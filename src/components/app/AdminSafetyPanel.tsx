import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Panel } from "@/components/app/primitives";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { getOrgSafety, saveOrgSafety } from "@/lib/admin-safety.functions";

type Form = {
  locked: boolean;
  isPaused: boolean;
  perContactDailyLimit: number;
  hourlySendLimit: number;
  dailySendLimit: number;
  quietHoursEnabled: boolean;
  viralGuardEnabled: boolean;
  viralThresholdPerMinute: number;
  viralCooldownMinutes: number;
};

export function AdminSafetyPanel({ orgId }: { orgId: string }) {
  const fetchSafety = useServerFn(getOrgSafety);
  const save = useServerFn(saveOrgSafety);
  const qc = useQueryClient();
  const { data } = useQuery({
    queryKey: ["admin-org-safety", orgId],
    queryFn: () => fetchSafety({ data: { organizationId: orgId } }),
    retry: false,
  });
  const [form, setForm] = useState<Form | null>(null);
  useEffect(() => {
    if (!data) return;
    const s = data.settings as unknown as {
      is_paused: boolean; per_contact_daily_limit: number; hourly_send_limit: number; daily_send_limit: number;
      quiet_hours_enabled: boolean; viral_guard_enabled: boolean; viral_threshold_per_minute: number; viral_cooldown_minutes: number;
    };
    setForm({
      locked: data.locked,
      isPaused: Boolean(s.is_paused),
      perContactDailyLimit: s.per_contact_daily_limit,
      hourlySendLimit: s.hourly_send_limit,
      dailySendLimit: s.daily_send_limit,
      quietHoursEnabled: Boolean(s.quiet_hours_enabled),
      viralGuardEnabled: Boolean(s.viral_guard_enabled),
      viralThresholdPerMinute: s.viral_threshold_per_minute,
      viralCooldownMinutes: s.viral_cooldown_minutes,
    });
  }, [data]);

  const mutation = useMutation({
    mutationFn: (f: Form) => save({ data: { organizationId: orgId, ...f } }),
    onSuccess: () => {
      toast.success("Safety controls saved");
      void qc.invalidateQueries({ queryKey: ["admin-org-safety", orgId] });
      void qc.invalidateQueries({ queryKey: ["admin-org", orgId] });
    },
    onError: (e: Error) => toast.error(e.message || "Could not save"),
  });

  if (!form) return <Panel title="Automation safety controls"><p className="text-sm text-muted-foreground">Loading…</p></Panel>;

  const num = (key: keyof Form, label: string) => (
    <label className="text-sm">
      <span className="font-medium">{label}</span>
      <Input
        type="number"
        className="mt-1"
        value={form[key] as number}
        onChange={(e) => setForm({ ...form, [key]: Number(e.target.value) })}
      />
    </label>
  );
  const toggle = (key: keyof Form, label: string, hint: string) => (
    <div className="flex items-center justify-between gap-3 rounded-lg border px-3 py-2">
      <div>
        <p className="text-sm font-medium">{label}</p>
        <p className="text-xs text-muted-foreground">{hint}</p>
      </div>
      <Switch checked={form[key] as boolean} onCheckedChange={(v) => setForm({ ...form, [key]: v })} />
    </div>
  );

  return (
    <Panel title="Automation safety controls">
      <div className="space-y-3">
        {toggle("locked", "Lock this section for the workspace", "When on, the workspace can see but not change its safety settings.")}
        {toggle("isPaused", "Pause all automations", "Nothing auto-replies while this is on.")}
        {toggle("quietHoursEnabled", "Quiet hours", "No auto-replies during the workspace's quiet hours.")}
        {toggle("viralGuardEnabled", "Viral protection", "Auto-pause when a post suddenly gets flooded.")}
        <div className="grid gap-3 sm:grid-cols-2">
          {num("hourlySendLimit", "Max auto-replies / hour")}
          {num("dailySendLimit", "Max auto-replies / day")}
          {num("perContactDailyLimit", "Max auto-replies per person / day")}
          {num("viralThresholdPerMinute", "Spike threshold (events / minute)")}
          {num("viralCooldownMinutes", "Pause for (minutes)")}
        </div>
        <Button onClick={() => mutation.mutate(form)} disabled={mutation.isPending}>
          Save safety controls
        </Button>
      </div>
    </Panel>
  );
}
