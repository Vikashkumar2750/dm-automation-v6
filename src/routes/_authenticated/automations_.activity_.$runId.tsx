import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft } from "lucide-react";

import { AppShell } from "@/components/app/AppShell";
import { PageHeader, Panel, StatusBadge } from "@/components/app/primitives";
import { Button } from "@/components/ui/button";
import { useTenant } from "@/hooks/useTenant";
import { explainReason, stepLabel } from "@/lib/activity-explain";
import { getAutomationRunDetail } from "@/lib/automations.functions";

export const Route = createFileRoute("/_authenticated/automations_/activity_/$runId")({
  head: () => ({
    meta: [
      { title: "Activity details — AutoDM by Techaasvik" },
      { name: "description", content: "Full details of one automation step: contact, rule, timeline and messages." },
      { property: "og:title", content: "Activity details — Techaasvik" },
      { property: "og:description", content: "Automation step details." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: RunDetailPage,
});

const tone = { sent: "success", matched: "info", skipped: "neutral", failed: "danger" } as const;
const conditionLabel: Record<string, string> = {
  any: "Everyone",
  followers_only: "Followers only",
  non_followers: "Non-followers only",
};

function label(detail: string | null, status: string) {
  return status === "sent" || status === "matched" ? stepLabel(detail) : explainReason(detail).title;
}

function Row({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-4 py-2 text-sm">
      <span className="text-muted-foreground">{k}</span>
      <span className="text-right font-medium break-all">{v}</span>
    </div>
  );
}

function RunDetailPage() {
  const { runId } = Route.useParams();
  const { activeOrg } = useTenant();
  const orgId = activeOrg?.id;
  const fetchDetail = useServerFn(getAutomationRunDetail);
  const q = useQuery({
    queryKey: ["automation-run", orgId, runId],
    enabled: Boolean(orgId),
    queryFn: () => fetchDetail({ data: { organizationId: orgId!, runId } }),
    retry: false,
  });
  const d = q.data;
  const ok = d && (d.run.status === "sent" || d.run.status === "matched");
  const ex = d && !ok ? explainReason(d.run.detail) : null;

  return (
    <AppShell>
      <div className="space-y-6">
        <Button asChild variant="ghost" size="sm">
          <Link to="/automations/activity"><ArrowLeft className="size-4" /> All activity</Link>
        </Button>
        {q.isLoading || !orgId ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : q.error || !d ? (
          <p className="text-sm text-destructive">{(q.error as Error)?.message ?? "Activity not found"}</p>
        ) : (
          <>
            <PageHeader
              title={label(d.run.detail, d.run.status)}
              description={new Date(d.run.created_at).toLocaleString()}
            />
            <div className="grid gap-6 lg:grid-cols-2">
              <Panel title="What happened">
                <Row k="Result" v={<StatusBadge tone={tone[d.run.status]}>{d.run.status}</StatusBadge>} />
                <Row k="Step code" v={<code className="text-xs">{d.run.detail ?? "—"}</code>} />
                {ex?.hint && <p className="mt-2 rounded-md bg-muted p-3 text-sm">{ex.hint}</p>}
              </Panel>
              <Panel title="Contact">
                {d.contact ? (
                  <>
                    <Row k="Name" v={d.contact.name ?? "Unknown"} />
                    <Row k="User ID" v={d.contact.externalUserId} />
                    <Row k="Platform" v={<span className="capitalize">{d.contact.platform}</span>} />
                    <Row k="Channel" v={d.contact.channel === "comment" ? "Comment" : "DM"} />
                    <Row k="Conversation" v={<span className="capitalize">{d.contact.status}</span>} />
                  </>
                ) : (
                  <p className="text-sm text-muted-foreground">No contact linked to this step.</p>
                )}
              </Panel>
              <Panel title="Rule">
                {d.rule ? (
                  <>
                    <Row k="Name" v={d.rule.name} />
                    <Row k="Trigger" v={d.rule.trigger === "comment_received" ? "New comment" : "New DM"} />
                    <Row k="Keywords" v={d.rule.match_type === "any" ? "Any message" : d.rule.keywords.join(", ") || "—"} />
                    <Row k="Action" v={d.rule.action} />
                    <Row k="Reply to" v={conditionLabel[d.rule.follower_condition] ?? d.rule.follower_condition} />
                    <Row k="Ask to follow first" v={d.rule.require_follow ? "On" : "Off"} />
                    <Row k="Link" v={d.rule.dm_link_url ?? "—"} />
                    <Row k="Attachment" v={d.rule.dm_attachment_type} />
                  </>
                ) : (
                  <p className="text-sm text-muted-foreground">Safety settings or a deleted rule.</p>
                )}
              </Panel>
              <Panel title="Flow timeline (±30 min, this contact)">
                <ol className="space-y-3">
                  {d.timeline.map((t) => (
                    <li key={t.id} className={`flex gap-3 text-sm ${t.id === d.run.id ? "font-semibold" : ""}`}>
                      <StatusBadge tone={tone[t.status]}>{t.status}</StatusBadge>
                      <div>
                        <p>{label(t.detail, t.status)}</p>
                        <p className="text-xs text-muted-foreground">{new Date(t.created_at).toLocaleTimeString()} · {t.detail ?? "—"}</p>
                      </div>
                    </li>
                  ))}
                </ol>
              </Panel>
            </div>
            <Panel title="Messages around this step">
              {d.messages.length === 0 ? (
                <p className="text-sm text-muted-foreground">No messages recorded.</p>
              ) : (
                <ul className="space-y-2">
                  {d.messages.map((m) => (
                    <li key={m.id} className={`flex ${m.direction === "outbound" ? "justify-end" : ""}`}>
                      <div className={`max-w-[80%] rounded-lg px-3 py-2 text-sm ${m.direction === "outbound" ? "bg-primary text-primary-foreground" : "bg-muted"}`}>
                        <p className="whitespace-pre-wrap">{m.body}</p>
                        <p className="mt-1 text-[10px] opacity-70">{new Date(m.sent_at).toLocaleTimeString()}</p>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </Panel>
          </>
        )}
      </div>
    </AppShell>
  );
}
