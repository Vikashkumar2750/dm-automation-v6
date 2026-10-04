import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Download, ShieldAlert } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { AppShell } from "@/components/app/AppShell";
import { GuideButton } from "@/components/app/GuideButton";
import { EmptyState, PageHeader, Panel, PlatformBadge, StatusBadge } from "@/components/app/primitives";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useTenant } from "@/hooks/useTenant";
import type { SocialPlatform } from "@/lib/social";
import { AUDIT_ENTITY_LABELS } from "@/lib/trust-safety";
import { getAuditTrail, getTrustOverview, saveTrustSettings } from "@/lib/trust-safety.functions";

export const Route = createFileRoute("/_authenticated/trust-safety")({
  head: () => ({
    meta: [
      { title: "Trust & safety — AutoDM by Techaasvik" },
      { name: "description", content: "Account health scores, predictive rate-limit guard, Meta policy checks and a full audit trail." },
      { property: "og:title", content: "Trust & safety — AutoDM by Techaasvik" },
      { property: "og:description", content: "Keep Instagram and Facebook accounts safe from blocks and policy problems." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: TrustSafetyPage,
});

const tone = (g: string) => (g === "good" || g === "ok" ? "success" : g === "watch" ? "warning" : "danger") as "success" | "warning" | "danger";
const sel = "h-9 rounded-md border border-input bg-background px-2 text-sm";

function TrustSafetyPage() {
  const { activeOrg } = useTenant();
  const orgId = activeOrg?.id ?? null;
  const fetchOverview = useServerFn(getTrustOverview);
  const q = useQuery({ queryKey: ["trust", orgId], enabled: !!orgId, refetchInterval: 60_000, queryFn: () => fetchOverview({ data: { organizationId: orgId! } }) });
  const role = activeOrg?.role;
  const manager = role === "owner" || role === "admin" || role === "manager";

  return (
    <AppShell>
      <PageHeader title="Trust & safety" description="Account health, rate-limit guard, policy checks and audit trail." actions={<GuideButton guide="trust-safety" />} />
      {!orgId || !q.data ? (
        <p className="text-sm text-muted-foreground">{q.error ? (q.error as Error).message : "Loading…"}</p>
      ) : (
        <Tabs defaultValue="health">
          <TabsList>
            <TabsTrigger value="health">Health score</TabsTrigger>
            <TabsTrigger value="guard">Rate-limit guard</TabsTrigger>
            <TabsTrigger value="policy">Compliance</TabsTrigger>
            {manager && <TabsTrigger value="audit">Audit trail</TabsTrigger>}
          </TabsList>
          <TabsContent value="health"><Health data={q.data} /></TabsContent>
          <TabsContent value="guard"><Guard orgId={orgId} data={q.data} manager={manager} /></TabsContent>
          <TabsContent value="policy"><Policy data={q.data} /></TabsContent>
          {manager && <TabsContent value="audit"><Audit orgId={orgId} /></TabsContent>}
        </Tabs>
      )}
    </AppShell>
  );
}

type Overview = Awaited<ReturnType<typeof getTrustOverview>>;

function Health({ data }: { data: Overview }) {
  if (!data.health.length) return <EmptyState icon={ShieldAlert} title="No connected accounts" description="Connect Instagram, Facebook or YouTube in Social Accounts to see a health score." />;
  return (
    <div className="grid gap-4 md:grid-cols-2">
      {data.health.map((a) => (
        <Panel key={a.id} title={a.name}>
          <div className="flex items-center gap-3">
            <span className="text-4xl font-semibold tabular-nums">{a.score}</span>
            <div className="space-y-1">
              <PlatformBadge platform={a.platform as SocialPlatform} />
              <div><StatusBadge tone={tone(a.grade)}>{a.grade === "good" ? "Healthy" : a.grade === "watch" ? "Needs a look" : "At risk"}</StatusBadge></div>
            </div>
          </div>
          <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-muted-foreground">
            {a.reasons.length ? a.reasons.map((r) => <li key={r}>{r}</li>) : <li>No problems found.</li>}
          </ul>
        </Panel>
      ))}
    </div>
  );
}

function Guard({ orgId, data, manager }: { orgId: string; data: Overview; manager: boolean }) {
  const qc = useQueryClient();
  const save = useServerFn(saveTrustSettings);
  const m = useMutation({
    mutationFn: (v: boolean) => save({ data: { organizationId: orgId, predictiveGuard: v } }),
    onSuccess: () => { toast.success("Saved"); void qc.invalidateQueries({ queryKey: ["trust", orgId] }); },
    onError: (e) => toast.error((e as Error).message),
  });
  return (
    <div className="space-y-4">
      <Panel title="Sending pace">
        <div className="flex flex-wrap items-center gap-3">
          <StatusBadge tone={tone(data.rate.level)}>{data.rate.level === "ok" ? "Safe" : data.rate.level === "watch" ? "Watch" : "Slow down"}</StatusBadge>
          <span className="text-sm">{data.rate.message}</span>
        </div>
        <p className="mt-2 text-sm text-muted-foreground">Last hour: {data.rate.sentLastHour} sent · Forecast: {data.rate.projectedHour}/hour · Your limits: {data.rate.hourlyLimit}/hour, {data.rate.dailyLimit}/day</p>
        {data.pausedUntil && <p className="mt-2 text-sm font-medium">Paused until {new Date(data.pausedUntil).toLocaleTimeString()} — {data.pauseReason}</p>}
      </Panel>
      <Panel title="Auto slow-down">
        <div className="flex items-center justify-between gap-4">
          <p className="text-sm text-muted-foreground">When Meta rejects 3+ messages for speed within 15 minutes, pause sending for 15 minutes so the account is not blocked.{data.lastGuardActionAt ? ` Last used ${new Date(data.lastGuardActionAt).toLocaleString()}.` : ""}</p>
          <Switch checked={data.predictiveGuard} disabled={!manager || m.isPending} onCheckedChange={(v) => m.mutate(v)} aria-label="Auto slow-down" />
        </div>
      </Panel>
    </div>
  );
}

function Policy({ data }: { data: Overview }) {
  if (!data.policy.length) return <EmptyState icon={ShieldAlert} title="No automations yet" description="Your automations will be checked here once you create them." />;
  const bad = data.policy.filter((p) => p.issues.length);
  return (
    <Panel title={`Policy check — ${bad.length ? `${bad.length} automation(s) need attention` : "all clear"}`}>
      <div className="divide-y divide-border">
        {data.policy.map((p) => (
          <div key={p.id} className="py-3">
            <div className="flex items-center gap-2">
              <span className="font-medium">{p.name}</span>
              {!p.isActive && <span className="text-xs text-muted-foreground">(off)</span>}
              <StatusBadge tone={p.issues.some((i) => i.severity === "block") ? "danger" : p.issues.length ? "warning" : "success"}>
                {p.issues.some((i) => i.severity === "block") ? "Breaks policy" : p.issues.length ? "Warning" : "OK"}
              </StatusBadge>
            </div>
            {p.issues.length > 0 && (
              <ul className="mt-1 list-disc pl-5 text-sm text-muted-foreground">
                {p.issues.map((i) => <li key={i.rule}>{i.message}</li>)}
              </ul>
            )}
          </div>
        ))}
      </div>
    </Panel>
  );
}

function Audit({ orgId }: { orgId: string }) {
  const [entity, setEntity] = useState("");
  const fetchAudit = useServerFn(getAuditTrail);
  const q = useQuery({ queryKey: ["audit", orgId, entity], queryFn: () => fetchAudit({ data: { organizationId: orgId, entity: entity || undefined } }) });
  const rows = q.data ?? [];
  const label = (e: string) => AUDIT_ENTITY_LABELS[e] ?? e;
  const verb = (a: string) => (a === "insert" ? "created" : a === "delete" ? "deleted" : "changed");
  const csv = () => {
    const head = "time,who,what,action,fields";
    const lines = rows.map((r) => [r.created_at, r.actor, label(r.entity), verb(r.action), (r.changed_fields ?? []).join(" ")].map((v) => `"${String(v).replace(/"/g, '""')}"`).join(","));
    const url = URL.createObjectURL(new Blob([[head, ...lines].join("\n")], { type: "text/csv" }));
    const a = document.createElement("a"); a.href = url; a.download = "audit-trail.csv"; a.click(); URL.revokeObjectURL(url);
  };
  return (
    <Panel
      title="Audit trail"
      action={
        <div className="flex gap-2">
          <select className={sel} value={entity} onChange={(e) => setEntity(e.target.value)} aria-label="Filter">
            <option value="">Everything</option>
            {Object.entries(AUDIT_ENTITY_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
          <Button size="sm" variant="outline" onClick={csv} disabled={!rows.length}><Download className="mr-1 h-4 w-4" />CSV</Button>
        </div>
      }
    >
      {q.isLoading ? <p className="text-sm text-muted-foreground">Loading…</p> : !rows.length ? <p className="text-sm text-muted-foreground">No changes recorded yet.</p> : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-xs text-muted-foreground"><tr><th className="py-2">When</th><th>Who</th><th>What</th><th>Fields</th></tr></thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-t border-border">
                  <td className="py-2 whitespace-nowrap">{new Date(r.created_at).toLocaleString()}</td>
                  <td>{r.actor}</td>
                  <td>{label(r.entity)} {verb(r.action)}</td>
                  <td className="text-xs text-muted-foreground">{(r.changed_fields ?? []).join(", ")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Panel>
  );
}
