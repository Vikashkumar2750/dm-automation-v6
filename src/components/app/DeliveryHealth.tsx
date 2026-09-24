import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { Activity, AlertTriangle, Send, Timer } from "lucide-react";

import { Panel, StatCard, StatusBadge } from "@/components/app/primitives";
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
            <div className="flex justify-between">
              <span>{i + 1}. {label}</span>
              <span className="font-medium">{n}</span>
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
  const f = h?.funnel;

  return (
    <Panel
      title="Delivery health"
      action={
        <div className="flex gap-2 text-sm">
          <select className="rounded-md border bg-background px-2 py-1" value={platform} onChange={(e) => setPlatform(e.target.value as typeof platform)}>
            <option value="all">All</option><option value="instagram">Instagram</option><option value="facebook">Facebook</option>
          </select>
          <select className="rounded-md border bg-background px-2 py-1" value={hours} onChange={(e) => setHours(Number(e.target.value))}>
            <option value={24}>Last 24h</option><option value={168}>Last 7 days</option>
          </select>
        </div>
      }
    >
      {!h ? (
        <p className="text-sm text-muted-foreground">{q.isError ? "Could not load health data." : "Loading…"}</p>
      ) : (
        <div className="space-y-5">
          {h.tapsMissing && (
            <div className="flex gap-2 rounded-lg border border-warning bg-warning/10 p-3 text-sm">
              <AlertTriangle className="size-4 shrink-0 text-warning" />
              <span>
                Buttons are being sent but <b>no button taps are reaching us</b>. This is a Meta setting, not the automation: make sure the tester has a role in the Meta app, <b>messaging_postbacks</b> is ticked for Instagram and Page webhooks, and the app is Live.
              </span>
            </div>
          )}
          <div className="rounded-xl border p-4 text-sm">
            <div className="mb-3 flex items-center justify-between gap-3">
              <p className="font-medium">Live real-event trace</p>
              <StatusBadge tone="info">Refreshes every 30s</StatusBadge>
            </div>
            {h.traces.length === 0 ? (
              <p className="text-muted-foreground">No real webhook events in this period.</p>
            ) : (
              <div className="space-y-2">
                {h.traces.map((trace) => (
                  <div key={trace.id} className="grid gap-1 rounded border px-3 py-2 sm:grid-cols-[150px_1fr_auto] sm:items-center">
                    <div>
                      <p className="font-medium">{trace.eventType}</p>
                      <p className="font-mono text-xs text-muted-foreground">Trace {trace.correlationId}</p>
                    </div>
                    <p className="text-xs text-muted-foreground">{traceLabel(trace.detail)}</p>
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
            <StatCard icon={Activity} label="Incoming events OK" value={pct(h.inbound.ok, h.inbound.total)} sub={`${h.inbound.total} events`} />
            <StatCard icon={Send} label="Outgoing success" value={pct(outSent, outSent + outFailed)} sub={`${outFailed} failed`} />
            <StatCard icon={Timer} label="Waiting gates" value={String(h.gates.filter((g) => g.status === "waiting").length)} sub="Users mid-flow" />
            <StatCard icon={Activity} label="Conversion" value={pct(f!.finalDms, f!.openers)} sub="Opener → final link" />
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <Funnel title="Follower path" steps={[["Opener sent", f!.openers], ["Button tapped", f!.taps], ["Follower verified", f!.followerDirect]]} />
            <Funnel title="Non-follower path" steps={[["Opener sent", f!.openers], ["Button tapped", f!.taps], ["Follow prompt sent", f!.followPrompts], ["Confirmed & delivered", f!.confirmedAfterFollow]]} />
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
                  {o.topError && <p className="truncate text-xs text-danger">{o.topError}</p>}
                </div>
              ))}
            </div>
          </div>

          <div className="text-sm">
            <p className="mb-2 font-medium">Retry history</p>
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
