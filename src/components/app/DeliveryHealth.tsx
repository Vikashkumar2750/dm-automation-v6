import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { Activity, AlertTriangle, Send, Timer, RefreshCw } from "lucide-react";

import { Panel, StatCard, StatusBadge } from "@/components/app/primitives";
import { Button } from "@/components/ui/button";
import { getDeliveryHealth } from "@/lib/webhooks.functions";

const STEP_LABEL: Record<string, string> = {
  comment_reply: "Public comment reply",
  tap_prompt: "“Send me the link” opener",
  follow_prompt: "Follow prompt",
  reply_dm: "Final link DM",
  attachment: "Attachment",
};

const pct = (a: number, b: number) => (b ? `${Math.round((a / b) * 100)}%` : "—");

function traceLabel(detail: string) {
  const labels: Record<string, string> = {
    processed: "Real event completed",
    app_secret_mismatch: "Rejected before processing: app secret mismatch",
    signature_header_missing: "Rejected before processing: signature missing",
    account_not_matched: "Connected account could not be matched",
    "trace:duplicate_delivery": "Duplicate Meta delivery ignored",
    "trace:echo": "Outgoing message echo ignored",
  };
  return labels[detail] ?? detail.replace(/^trace:/, "").replaceAll("_", " ");
}

function Funnel({ title, steps }: { title: string; steps: [string, number][] }) {
  const first = steps[0]?.[1] ?? 0;
  return (
    <div className="rounded-xl border p-4">
      <p className="mb-3 font-medium">{title}</p>
      <ol className="space-y-2">
        {steps.map(([label, n], i) => (
          <li key={label} className="text-sm">
            <div className="flex min-w-0 justify-between gap-3">
              <span className="min-w-0 break-words">{i + 1}. {label}</span>
              <span className="shrink-0 font-medium">{n}</span>
            </div>
            <div className="mt-1 h-1.5 rounded bg-surface-secondary">
              <div className="h-1.5 rounded bg-primary" style={{ width: first ? `${Math.min(100, (n / first) * 100)}%` : "0%" }} />
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}

export function DeliveryHealth({ orgId }: { orgId: string }) {
  const [platform, setPlatform] = useState<"all" | "instagram" | "facebook">("all");
  const [hours, setHours] = useState(24);
  const fetchHealth = useServerFn(getDeliveryHealth);
  const q = useQuery({
    queryKey: ["delivery-health", orgId, platform, hours],
    refetchInterval: 30_000,
    queryFn: () => fetchHealth({ data: { organizationId: orgId, platform, hours } }),
  });
  const h = q.data;
  const outSent = h?.outbound.reduce((s, o) => s + o.sent, 0) ?? 0;
  const outFailed = h?.outbound.reduce((s, o) => s + o.failed, 0) ?? 0;

  return (
    <Panel
      title="Delivery health"
      action={
        <div className="flex flex-wrap gap-2 text-sm">
          <Button variant="outline" size="sm" aria-label="Refresh delivery health" disabled={q.isFetching} onClick={() => void q.refetch()}><RefreshCw className="size-4" /></Button>
          <select aria-label="Delivery health platform" className="rounded-md border bg-background px-2 py-1" value={platform} onChange={(e) => setPlatform(e.target.value as typeof platform)}>
            <option value="all">All</option><option value="instagram">Instagram</option><option value="facebook">Facebook</option>
          </select>
          <select aria-label="Delivery health period" className="rounded-md border bg-background px-2 py-1" value={hours} onChange={(e) => setHours(Number(e.target.value))}>
            <option value={24}>Last 24h</option><option value={168}>Last 7 days</option>
          </select>
        </div>
      }
    >
      <p className="mb-3 text-xs text-muted-foreground">Loaded samples: up to 5,000 incoming events, 5,000 automation events and 50 follow checks. Automation events remain workspace-wide when a platform is selected. These are not full-history totals or verified delivery rates.</p>
      {q.isError && <p role="alert" className="mb-3 text-sm text-destructive">Delivery health could not be refreshed. Previously loaded results may be out of date.</p>}
      {!h ? (
        <p role="status" className="text-sm text-muted-foreground">{q.isError ? "Delivery health unavailable. Refresh to retry." : "Loading delivery health…"}</p>
      ) : (
        <div className="space-y-5">
          {h.tapsMissing && (
            <div className="flex gap-2 rounded-lg border border-warning bg-warning/10 p-3 text-sm">
              <AlertTriangle className="size-4 shrink-0 text-warning" />
              <span>
                Openers are recorded but <b>no button taps appear in the loaded sample</b>. Confirm a real tester tapped a button, then check Meta app roles and <b>messaging_postbacks</b> subscriptions. This signal alone does not establish the cause.
              </span>
            </div>
          )}
          <div className="rounded-xl border p-4 text-sm">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
              <p className="font-medium">Incoming event trace · up to 50 loaded events</p>
              <StatusBadge tone="info">Refreshes every 30s</StatusBadge>
            </div>
            {h.traces.length === 0 ? (
              <p className="text-muted-foreground">No incoming events in this loaded sample. This does not confirm delivery health.</p>
            ) : (
              <div className="space-y-2">
                {h.traces.map((trace) => (
                  <div key={trace.id} className="grid min-w-0 gap-1 rounded border px-3 py-2 sm:grid-cols-[150px_minmax(0,1fr)_auto] sm:items-center">
                    <div>
                      <p className="break-words font-medium">{trace.eventType}</p>
                      <p className="break-all font-mono text-xs text-muted-foreground">Trace {trace.correlationId}</p>
                    </div>
                    <p className="min-w-0 break-words text-xs text-muted-foreground">{traceLabel(trace.detail)}</p>
                    <div className="flex items-center gap-2">
                      <StatusBadge tone={trace.outcome === "processed" ? "success" : trace.outcome === "failed" ? "danger" : "warning"}>{trace.outcome}</StatusBadge>
                      <span className="text-xs text-muted-foreground">{new Date(trace.at).toLocaleTimeString()}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard icon={Activity} label="Incoming events not marked failed" value={pct(h.inbound.ok, h.inbound.total)} sub={h.inbound.total ? `${h.inbound.total} loaded events · includes unfinished statuses` : "No incoming activity in sample"} />
            <StatCard icon={Send} label="Outgoing step success · sample" value={pct(outSent, outSent + outFailed)} sub={outSent + outFailed ? `${outFailed} failed steps · workspace-wide` : "No outgoing steps in sample"} />
            <StatCard icon={Timer} label="Waiting gates · loaded" value={String(h.gates.filter((g) => g.status === "waiting").length)} sub="From up to 50 follow checks" />
            <StatCard icon={Activity} label="Final DMs / openers · sample" value={pct(h.funnel.finalDms, h.funnel.openers)} sub="Independent event counts, not buyer conversion" />
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <Funnel title="Follower path · sampled events" steps={[["Opener sent", h.funnel.openers], ["Button tapped", h.funnel.taps], ["Follower verified", h.funnel.followerDirect]]} />
            <Funnel title="Non-follower path · sampled events" steps={[["Opener sent", h.funnel.openers], ["Button tapped", h.funnel.taps], ["Follow prompt sent", h.funnel.followPrompts], ["Confirmed & delivered", h.funnel.confirmedAfterFollow]]} />
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <div className="rounded-xl border p-4 text-sm">
              <p className="mb-2 font-medium">Incoming events</p>
              {h.inbound.byType.length === 0 ? <p className="text-muted-foreground">None in this period.</p> : h.inbound.byType.map((t) => (
                <div key={t.type} className="flex justify-between py-0.5">
                  <span>{t.type}</span>
                  <span>{t.total}{t.failed ? <span className="text-danger"> · {t.failed} failed</span> : null}</span>
                </div>
              ))}
            </div>
            <div className="rounded-xl border p-4 text-sm">
              <p className="mb-2 font-medium">Outgoing messages</p>
              {h.outbound.map((o) => (
                <div key={o.step} className="py-0.5">
                  <div className="flex justify-between">
                    <span>{STEP_LABEL[o.step] ?? o.step}</span>
                    <span>{o.sent} sent{o.failed ? <span className="text-danger"> · {o.failed} failed</span> : null}</span>
                  </div>
                  {o.topError && <p className="break-words text-xs text-destructive">{o.topError}</p>}
                </div>
              ))}
            </div>
          </div>

          <div className="text-sm">
            <p className="mb-2 font-medium">Retry history · showing up to 15 loaded follow checks</p>
            {h.gates.length === 0 ? <p className="text-muted-foreground">No follow checks in this period.</p> : (
              <div className="space-y-1">
                {h.gates.slice(0, 15).map((g) => (
                  <div key={g.id} className="flex flex-wrap items-center justify-between gap-2 rounded border px-3 py-1.5">
                    <span className="text-xs text-muted-foreground">{new Date(g.created_at).toLocaleString()}</span>
                    <span className="text-xs">Attempt {g.attempts} / 4</span>
                    <StatusBadge tone={g.status === "completed" ? "success" : g.status === "waiting" ? "warning" : "neutral"}>{g.status}</StatusBadge>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </Panel>
  );
}
