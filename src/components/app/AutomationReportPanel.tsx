import { csvCell } from "@/lib/csv-safe";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { AlertTriangle, Download, Link2, MessageCircle, Paperclip, Send, Zap, RefreshCw } from "lucide-react";

import { Panel, StatCard, StatusBadge } from "@/components/app/primitives";
import { Button } from "@/components/ui/button";
import { getAutomationReport, type ReportRow } from "@/lib/automation-report.functions";

const PERIODS = {
  daily: { label: "Daily (today)", days: 1, bucket: "day" },
  weekly: { label: "Weekly (7 days)", days: 7, bucket: "day" },
  monthly: { label: "Monthly (30 days)", days: 30, bucket: "day" },
  quarter: { label: "90 days", days: 90, bucket: "week" },
} as const;
type Period = keyof typeof PERIODS;

const OUTCOMES = ["all", "delivered", "failed", "skipped", "in_progress"] as const;
const yn = (b: boolean) => (b ? "Yes" : "No");
const outcomeTone = { delivered: "success", failed: "danger", skipped: "neutral", in_progress: "info" } as const;

function toCsv(rows: ReportRow[]) {
  const head = [
    "Contact handle", "Platform", "Automation", "Started at", "Public reply sent",
    "Final DM sent", "Sent time", "Outcome", "Failed stage", "Failed reason",
    "Link opened", "Attachment opened",
  ];
  const esc = (v: string) => csvCell(v);
  const lines = rows.map((r) =>
    [
      r.handle, r.platform, r.rule, new Date(r.startedAt).toLocaleString(), yn(r.publicReply),
      yn(r.finalDm), r.sentAt ? new Date(r.sentAt).toLocaleString() : "", r.outcome,
      r.failedStage ?? "", r.failedReason ?? "", yn(r.linkClicked), yn(r.attachmentClicked),
    ].map((v) => esc(String(v))).join(","),
  );
  return [head.map(esc).join(","), ...lines].join("\n");
}

export function AutomationReportPanel({ orgId }: { orgId: string }) {
  const [period, setPeriod] = useState<Period>("weekly");
  const [platform, setPlatform] = useState<"all" | "instagram" | "facebook">("all");
  const [outcome, setOutcome] = useState<(typeof OUTCOMES)[number]>("all");
  const [search, setSearch] = useState("");
  const fetchReport = useServerFn(getAutomationReport);

  const q = useQuery({
    queryKey: ["automation-report", orgId, period, platform],
    refetchInterval: 60_000,
    queryFn: () => {
      const p = PERIODS[period];
      const to = new Date();
      const from = new Date();
      if (p.days === 1) from.setHours(0, 0, 0, 0);
      else from.setTime(to.getTime() - p.days * 86400000);
      return fetchReport({
        data: { organizationId: orgId, from: from.toISOString(), to: to.toISOString(), platform, bucket: p.bucket },
      });
    },
  });
  const r = q.data;

  const rows = useMemo(
    () =>
      (r?.rows ?? []).filter(
        (x) =>
          (outcome === "all" || x.outcome === outcome) &&
          (!search || x.handle.toLowerCase().includes(search.toLowerCase())),
      ),
    [r, outcome, search],
  );

  const download = () => {
    const blob = new Blob([toCsv(rows)], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `automation-report-${period}-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const sel = "rounded-md border bg-background px-2 py-1 text-sm";

  return (
    <Panel
      title="Automation report · loaded results"
      action={
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="outline" aria-label="Refresh automation report" disabled={q.isFetching} onClick={() => void q.refetch()}><RefreshCw className="size-4" /></Button>
          <select aria-label="Automation report period" className={sel} value={period} onChange={(e) => setPeriod(e.target.value as Period)}>
            {Object.entries(PERIODS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
          </select>
          <select aria-label="Automation report platform" className={sel} value={platform} onChange={(e) => setPlatform(e.target.value as typeof platform)}>
            <option value="all">All platforms</option><option value="instagram">Instagram</option><option value="facebook">Facebook</option>
          </select>
          <Button size="sm" variant="outline" onClick={download} disabled={!rows.length}>
            <Download className="size-4" /> Export CSV
          </Button>
        </div>
      }
    >
      <p className="mb-3 text-xs text-muted-foreground">This report groups up to 20,000 loaded automation events. Summary cards use the loaded period/platform sample; contact and outcome filters affect the table and CSV only. Counts are not billing usage totals.</p>
      {q.isError && <p role="alert" className="mb-3 text-sm text-destructive">The automation report could not be refreshed. Previously loaded results may be out of date.</p>}
      {!r ? (
        <p role="status" className="text-sm text-muted-foreground">{q.isError ? "Automation report unavailable. Refresh to retry." : "Loading automation report…"}</p>
      ) : (
        <div className="space-y-5">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard icon={Zap} info="How many times an automation started for a person in this period. One comment or DM that triggers a rule or flow = 1 attempt, however many steps it has." label="Automation attempts" value={String(r.totals.attempts)} sub={`${r.totals.skipped} skipped steps`} />
            <StatCard icon={MessageCircle} info="Replies posted publicly under comments by your automations." label="Public replies" value={String(r.totals.publicReplies)} sub="Replies under comments" />
            <StatCard icon={Send} info="Attempts where the main private message (link, offer or flow message) reached the person's inbox." label="Final DMs sent" value={String(r.totals.dmsSent)} sub={r.totals.attempts ? `${Math.round((r.totals.dmsSent / r.totals.attempts) * 100)}% of attempts` : "—"} />
            <StatCard icon={AlertTriangle} info="Steps that Meta or the system rejected. See the Reason column for what went wrong." label="Failed" value={String(r.totals.failed)} sub="Failed steps" />
            <StatCard icon={Link2} info="How many times people opened the link button inside your automated DMs." label="Link opened" value={String(r.totals.linkClicks)} sub={r.totals.dmsSent ? `${Math.round((r.totals.linkClicks / r.totals.dmsSent) * 100)}% of DMs` : "—"} />
            <StatCard icon={Paperclip} info="How many times people opened an attachment that was sent as a link." label="Attachment opened" value={String(r.totals.attachmentClicks)} sub="When sent as a link" />
          </div>

          <div className="grid gap-3 lg:grid-cols-[2fr_1fr]">
            <div className="h-56 rounded-xl border p-3">
              {r.series.length === 0 ? (
                <p className="text-sm text-muted-foreground">No activity in this period.</p>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={r.series}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                    <XAxis dataKey="date" fontSize={11} />
                    <YAxis allowDecimals={false} fontSize={11} />
                    <Tooltip />
                    <Bar dataKey="attempts" name="Attempts" fill="var(--color-muted-foreground)" />
                    <Bar dataKey="dms" name="Final DMs" fill="var(--color-primary)" />
                    <Bar dataKey="failed" name="Failed" fill="var(--color-destructive)" />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
            <div className="rounded-xl border p-4 text-sm">
              <p className="mb-2 font-medium">Failed by stage</p>
              {r.failedByStage.length === 0 ? (
                <p className="text-muted-foreground">No failures recorded in this loaded sample.</p>
              ) : (
                r.failedByStage.map((s) => (
                  <div key={s.stage} className="flex justify-between py-0.5">
                    <span>{s.stage}</span><span className="font-medium">{s.count}</span>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <input aria-label="Search automation report contacts" className={`${sel} w-full min-w-0 sm:w-48`} placeholder="Search contact…" value={search} onChange={(e) => setSearch(e.target.value)} />
            {OUTCOMES.map((o) => (
              <Button key={o} size="sm" variant={outcome === o ? "default" : "outline"} className="capitalize" onClick={() => setOutcome(o)}>
                {o.replace("_", " ")}
              </Button>
            ))}
            <span className="ml-auto text-xs text-muted-foreground">{rows.length} matching loaded rows</span>
          </div>

          {rows.length === 0 ? <p role="status" className="text-sm text-muted-foreground">{search || outcome !== "all" ? "No loaded attempts match these filters." : "No automation attempts recorded in this loaded period."}</p> : <div className="max-h-[520px] min-w-0 max-w-full overflow-auto rounded-xl border">
            <table className="w-full min-w-[980px] text-sm">
              <thead className="sticky top-0 bg-background text-left text-xs uppercase text-muted-foreground">
                <tr>
                  {["Contact", "Platform", "Public reply", "Final DM", "Sent time", "Outcome", "Failed stage", "Reason", "Link", "Attachment"].map((h) => (
                    <th key={h} className="px-3 py-2">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.slice(0, 500).map((x) => (
                  <tr key={x.id} className="border-t align-top">
                    <td className="px-3 py-2 font-medium">{x.handle}<p className="text-xs font-normal text-muted-foreground">{x.rule}</p></td>
                    <td className="px-3 py-2 capitalize">{x.platform}</td>
                    <td className="px-3 py-2">{yn(x.publicReply)}</td>
                    <td className="px-3 py-2">{yn(x.finalDm)}</td>
                    <td className="px-3 py-2 text-xs">{x.sentAt ? new Date(x.sentAt).toLocaleString() : "—"}</td>
                    <td className="px-3 py-2"><StatusBadge tone={outcomeTone[x.outcome]}>{x.outcome.replace("_", " ")}</StatusBadge></td>
                    <td className="px-3 py-2">{x.failedStage ?? "—"}</td>
                    <td className="px-3 py-2 text-xs text-muted-foreground">{x.failedReason ?? "—"}</td>
                    <td className="px-3 py-2">{x.linkClicked ? "Opened" : "—"}</td>
                    <td className="px-3 py-2">{x.attachmentClicked ? "Opened" : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {rows.length > 500 && <p className="p-3 text-xs text-muted-foreground">Showing 500 rows — CSV includes all {rows.length} matching loaded rows, not full history.</p>}
          </div>}
        </div>
      )}
    </Panel>
  );
}
