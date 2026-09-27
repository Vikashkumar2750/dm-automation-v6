import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Panel } from "@/components/app/primitives";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { getPlatformConfig, savePlatformConfig } from "@/lib/platform-config.functions";
import type { BillingCycle, PlanDef } from "@/lib/plans";

type Config = Awaited<ReturnType<typeof getPlatformConfig>>;

function useConfig() {
  const fetchConfig = useServerFn(getPlatformConfig);
  const save = useServerFn(savePlatformConfig);
  const qc = useQueryClient();
  const query = useQuery({ queryKey: ["platform-config"], queryFn: () => fetchConfig(), retry: false });
  const mutation = useMutation({
    mutationFn: (c: Config) => save({ data: c as never }),
    onSuccess: () => {
      toast.success("Saved");
      void qc.invalidateQueries({ queryKey: ["platform-config"] });
      void qc.invalidateQueries({ queryKey: ["public-plans"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message.slice(0, 160) : "Could not save"),
  });
  return { config: query.data, mutation };
}

const CYCLES: { value: BillingCycle; label: string }[] = [
  { value: "lifetime", label: "Trial / one-time" },
  { value: "monthly", label: "Monthly" },
  { value: "half_yearly", label: "6 months" },
  { value: "yearly", label: "Yearly" },
];

export function PlanEditorPanel() {
  const { config, mutation } = useConfig();
  const [plans, setPlans] = useState<PlanDef[]>([]);
  useEffect(() => {
    if (config) setPlans(structuredClone(config.plans));
  }, [config]);
  if (!config) return <Panel title="Edit plans"><p className="text-sm text-muted-foreground">Loading…</p></Panel>;

  const update = (i: number, patch: Partial<PlanDef>) =>
    setPlans((ps) => ps.map((p, idx) => (idx === i ? { ...p, ...patch } : p)));

  return (
    <Panel title="Edit plans (prices, names, features)">
      <div className="space-y-6">
        {plans.map((p, i) => (
          <div key={p.key} className="space-y-3 rounded-lg border p-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="text-xs text-muted-foreground">
                Plan name ({p.key})
                <Input value={p.name} onChange={(e) => update(i, { name: e.target.value })} />
              </label>
              <label className="text-xs text-muted-foreground">
                Headline price text
                <Input value={p.headline} onChange={(e) => update(i, { headline: e.target.value })} />
              </label>
            </div>
            <label className="block text-xs text-muted-foreground">
              Features (one per line)
              <Textarea
                rows={3}
                value={p.perks.join("\n")}
                onChange={(e) => update(i, { perks: e.target.value.split("\n").filter((l) => l.trim()) })}
              />
            </label>
            <div className="flex items-center gap-2 text-sm">
              <Switch
                checked={Boolean(p.contactOnly)}
                onCheckedChange={(v) => update(i, { contactOnly: v })}
              />
              Contact-only (no online payment)
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              {(["monthlyDms", "maxRules"] as const).map((k) => {
                const lim = p.limits ?? DEFAULT_PLAN_LIMITS[p.key];
                return (
                  <label key={k} className="text-xs">
                    <span className="font-medium">
                      {k === "monthlyDms" ? "Automated DMs / month" : "Active automation rules"} (empty = unlimited)
                    </span>
                    <Input
                      className="mt-1"
                      inputMode="numeric"
                      value={lim[k] ?? ""}
                      onChange={(e) => {
                        const n = parseInt(e.target.value, 10);
                        update(i, { limits: { ...lim, [k]: e.target.value === "" || Number.isNaN(n) ? null : n } });
                      }}
                    />
                  </label>
                );
              })}
            </div>
            <div className="space-y-2">
              <p className="text-xs font-medium">Price options</p>
              {p.options.map((o, oi) => (
                <div key={oi} className="grid items-end gap-2 sm:grid-cols-[1fr_1.5fr_1fr_1fr_auto]">
                  <select
                    className="h-9 rounded-md border bg-background px-2 text-sm"
                    value={o.cycle}
                    onChange={(e) => {
                      const cycle = e.target.value as BillingCycle;
                      const options = [...p.options];
                      options[oi] = { ...o, cycle, months: cycle === "lifetime" ? null : cycle === "monthly" ? 1 : cycle === "half_yearly" ? 6 : 12 };
                      update(i, { options });
                    }}
                  >
                    {CYCLES.map((c) => (
                      <option key={c.value} value={c.value}>{c.label}</option>
                    ))}
                  </select>
                  <Input
                    placeholder="Label"
                    value={o.label}
                    onChange={(e) => {
                      const options = [...p.options];
                      options[oi] = { ...o, label: e.target.value };
                      update(i, { options });
                    }}
                  />
                  <Input
                    placeholder="Price ₹"
                    inputMode="decimal"
                    value={String(o.amountPaise / 100)}
                    onChange={(e) => {
                      const options = [...p.options];
                      options[oi] = { ...o, amountPaise: Math.round((Number(e.target.value) || 0) * 100) };
                      update(i, { options });
                    }}
                  />
                  <Input
                    placeholder="Months (blank = 3-day trial)"
                    inputMode="numeric"
                    value={o.months == null ? "" : String(o.months)}
                    onChange={(e) => {
                      const options = [...p.options];
                      const n = Number(e.target.value);
                      options[oi] = { ...o, months: e.target.value && n > 0 ? n : null };
                      update(i, { options });
                    }}
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label="Remove option"
                    onClick={() => update(i, { options: p.options.filter((_, x) => x !== oi) })}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              ))}
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  update(i, {
                    options: [...p.options, { cycle: "monthly", label: "New option", amountPaise: 0, months: 1 }],
                  })
                }
              >
                <Plus className="size-4" /> Add price option
              </Button>
            </div>
          </div>
        ))}
        <Button disabled={mutation.isPending} onClick={() => mutation.mutate({ ...config, plans })}>
          {mutation.isPending ? "Saving…" : "Save plans"}
        </Button>
        <p className="text-xs text-muted-foreground">
          Changes show on the billing page immediately. Payments use the saved price.
        </p>
      </div>
    </Panel>
  );
}

const EVENT_LABELS: Record<string, string> = {
  new_signup: "New user signs up",
  payment_received: "Payment received",
  automation_failure: "Automation keeps failing",
  account_disconnected: "Social account disconnected",
  plan_expiring: "Plan about to expire",
  workspace_suspended: "Workspace / user suspended",
};

export function EmailAndResetPanels() {
  const { config, mutation } = useConfig();
  const [draft, setDraft] = useState<Config | null>(null);
  useEffect(() => {
    if (config) setDraft(structuredClone(config));
  }, [config]);
  if (!draft) return null;
  const setEmail = (patch: Partial<Config["email"]>) =>
    setDraft((d) => (d ? { ...d, email: { ...d.email, ...patch } } : d));

  return (
    <>
      <Panel title="Email settings">
        <div className="grid gap-3 sm:grid-cols-3">
          <label className="text-xs text-muted-foreground">
            Sender name
            <Input value={draft.email.senderName} onChange={(e) => setEmail({ senderName: e.target.value })} />
          </label>
          <label className="text-xs text-muted-foreground">
            Support email (shown to users)
            <Input value={draft.email.supportEmail} onChange={(e) => setEmail({ supportEmail: e.target.value.trim() })} />
          </label>
          <label className="text-xs text-muted-foreground">
            Admin alert email
            <Input value={draft.email.adminAlertEmail} onChange={(e) => setEmail({ adminAlertEmail: e.target.value.trim() })} />
          </label>
        </div>
        <p className="mt-4 mb-2 text-sm font-medium">Send an email when…</p>
        <div className="space-y-3">
          {Object.entries(EVENT_LABELS).map(([key, label]) => (
            <div key={key} className="flex items-center justify-between gap-4 text-sm">
              {label}
              <Switch
                checked={Boolean((draft.email.events as Record<string, boolean>)[key])}
                onCheckedChange={(v) => setEmail({ events: { ...draft.email.events, [key]: v } })}
              />
            </div>
          ))}
        </div>
        <Button className="mt-4" disabled={mutation.isPending} onClick={() => mutation.mutate(draft)}>
          Save email settings
        </Button>
      </Panel>

      <Panel title="Forgot-password limit">
        <p className="mb-3 text-sm text-muted-foreground">
          How many reset links one email address can ask for. Stops people spamming someone's inbox.
        </p>
        <div className="grid max-w-md gap-3 sm:grid-cols-2">
          <label className="text-xs text-muted-foreground">
            Per hour
            <Input
              inputMode="numeric"
              value={String(draft.passwordReset.perHour)}
              onChange={(e) =>
                setDraft({ ...draft, passwordReset: { ...draft.passwordReset, perHour: Math.max(1, Number(e.target.value) || 1) } })
              }
            />
          </label>
          <label className="text-xs text-muted-foreground">
            Per day
            <Input
              inputMode="numeric"
              value={String(draft.passwordReset.perDay)}
              onChange={(e) =>
                setDraft({ ...draft, passwordReset: { ...draft.passwordReset, perDay: Math.max(1, Number(e.target.value) || 1) } })
              }
            />
          </label>
        </div>
        <Button className="mt-4" disabled={mutation.isPending} onClick={() => mutation.mutate(draft)}>
          Save limit
        </Button>
      </Panel>
    </>
  );
}
