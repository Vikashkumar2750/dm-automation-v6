import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { CheckCircle2, FlaskConical, XCircle } from "lucide-react";

import { AppShell } from "@/components/app/AppShell";
import { PageHeader, Panel, StatusBadge } from "@/components/app/primitives";
import { Button } from "@/components/ui/button";
import { useTenant } from "@/hooks/useTenant";
import { explainReason, stepLabel } from "@/lib/activity-explain";
import { listAutomationRules } from "@/lib/automations.functions";
import { listSocialAccounts } from "@/lib/social-accounts.functions";
import { getSimulatorAccess, runAutomationSimulation, type SimResult, type SimScenario } from "@/lib/simulation.functions";

export const Route = createFileRoute("/_authenticated/automations_/simulator")({
  head: () => ({
    meta: [
      { title: "Automation Test Console — AutoDM by Techaasvik" },
      { name: "description", content: "Simulate follower and non-follower button taps without sending real messages." },
      { property: "og:title", content: "Automation Test Console" },
      { property: "og:description", content: "Dry-run your comment-to-DM automations end to end." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: TestConsolePage,
});

const SCENARIOS: { id: SimScenario; label: string; hint: string }[] = [
  { id: "follower", label: "Follower", hint: "Already follows — should get the link right after the tap" },
  { id: "non_follower", label: "Non-follower", hint: "Gets follow prompt, then link after “I followed”" },
  { id: "unknown", label: "Unknown status", hint: "Meta can't tell — must show the follow step" },
  { id: "duplicate", label: "Duplicate tap", hint: "Same tap twice — link only once" },
  { id: "expired", label: "Old button", hint: "Expired button — must not deliver" },
];

function TestConsolePage() {
  const { activeOrg } = useTenant();
  const orgId = activeOrg?.id ?? null;
  const fetchRules = useServerFn(listAutomationRules);
  const fetchAccounts = useServerFn(listSocialAccounts);
  const simulate = useServerFn(runAutomationSimulation);
  const fetchAccess = useServerFn(getSimulatorAccess);

  const access = useQuery({
    queryKey: ["simulator-access", orgId],
    enabled: !!orgId,
    queryFn: () => fetchAccess({ data: { organizationId: orgId! } }),
  });

  const rules = useQuery({
    queryKey: ["automation-rules", orgId],
    enabled: !!orgId,
    queryFn: () => fetchRules({ data: { organizationId: orgId! } }),
  });
  const accounts = useQuery({
    queryKey: ["social-accounts", orgId],
    enabled: !!orgId,
    queryFn: () => fetchAccounts({ data: { organizationId: orgId! } }),
  });

  const [ruleId, setRuleId] = useState("");
  const [accountId, setAccountId] = useState("");
  const [results, setResults] = useState<Partial<Record<SimScenario, SimResult | string>>>({});

  const ruleList = (rules.data ?? []) as { id: string; name: string }[];
  const accountList = (accounts.data ?? []).filter((a) => a.platform !== "youtube");
  const rId = ruleId || ruleList[0]?.id || "";
  const aId = accountId || accountList.find((a) => a.platform === "instagram")?.id || accountList[0]?.id || "";

  const run = useMutation({
    mutationFn: async (scenario: SimScenario) => {
      try {
        const r = await simulate({ data: { organizationId: orgId!, ruleId: rId, socialAccountId: aId, scenario } });
        setResults((p) => ({ ...p, [scenario]: r }));
      } catch (e) {
        setResults((p) => ({ ...p, [scenario]: e instanceof Error ? e.message : "Test failed" }));
      }
    },
  });

  if (access.data && !access.data.allowed) {
    return (
      <AppShell>
        <PageHeader title="Automation test console" actions={<Button asChild variant="outline"><Link to="/automations">Back to automations</Link></Button>} />
        <Panel title="Access not enabled">
          <p className="text-sm text-muted-foreground">A super admin must enable the test console for this workspace or your account.</p>
        </Panel>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <PageHeader
        title="Automation test console"
        description="Runs your real automation rules with pretend button taps. Nothing is sent to Instagram or Facebook, and test data is removed afterwards."
        actions={
          <Button asChild variant="outline">
            <Link to="/automations">Back to automations</Link>
          </Button>
        }
      />
      <div className="space-y-6">
        <Panel title="Setup">
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="text-sm">
              <span className="mb-1 block text-muted-foreground">Rule</span>
              <select className="w-full rounded-md border bg-background px-3 py-2" value={rId} onChange={(e) => setRuleId(e.target.value)}>
                {ruleList.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
              </select>
            </label>
            <label className="text-sm">
              <span className="mb-1 block text-muted-foreground">Account</span>
              <select className="w-full rounded-md border bg-background px-3 py-2" value={aId} onChange={(e) => setAccountId(e.target.value)}>
                {accountList.map((a) => <option key={a.id} value={a.id}>{a.platform} · {a.name}</option>)}
              </select>
            </label>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            {SCENARIOS.map((s) => (
              <Button key={s.id} variant="outline" disabled={!rId || !aId || run.isPending} onClick={() => run.mutate(s.id)}>
                <FlaskConical className="size-4" /> Test: {s.label}
              </Button>
            ))}
            <Button disabled={!rId || !aId || run.isPending} onClick={async () => { for (const s of SCENARIOS) await run.mutateAsync(s.id); }}>
              Run all tests
            </Button>
          </div>
        </Panel>

        {SCENARIOS.filter((s) => results[s.id]).map((s) => {
          const r = results[s.id]!;
          return (
            <Panel
              key={s.id}
              title={
                <span className="flex items-center gap-2">
                  {typeof r !== "string" && r.pass ? <CheckCircle2 className="size-5 text-success" /> : <XCircle className="size-5 text-danger" />}
                  {s.label} — {typeof r === "string" ? r : r.summary}
                </span>
              }
            >
              <p className="mb-3 text-xs text-muted-foreground">{s.hint}</p>
              {typeof r !== "string" && (
                <ol className="space-y-3">
                  {r.steps.map((st, i) => (
                    <li key={i} className="rounded-lg border p-3 text-sm">
                      <div className="flex flex-wrap items-center gap-2 font-medium">
                        {i + 1}. {st.label}
                        {st.follows !== null && <StatusBadge tone="neutral">follows: {String(st.follows)}</StatusBadge>}
                        {st.gateStatus && <StatusBadge tone="neutral">gate: {st.gateStatus}</StatusBadge>}
                      </div>
                      {st.runs.map((run, j) => {
                        const completed = run.status === "sent" || run.status === "matched";
                        const label = completed ? stepLabel(run.detail) : explainReason(run.detail).title;
                        return (
                          <div key={j} className="mt-1 flex gap-2 text-xs">
                            <StatusBadge tone={run.status === "sent" ? "success" : run.status === "matched" ? "neutral" : run.status === "failed" ? "danger" : "warning"}>
                              {run.status === "matched" ? "checked" : run.status}
                            </StatusBadge>
                            <span>{label}</span>
                            <span className="text-muted-foreground">({run.detail})</span>
                          </div>
                        );
                      })}
                      {st.messages.map((m, j) => (
                        <div key={j} className="mt-2 rounded bg-surface-secondary px-2 py-1 text-xs">
                          <span className="text-muted-foreground">Would send → </span>{m.text || "(message)"}
                          {m.buttons.length > 0 && <span className="text-muted-foreground"> · buttons: {m.buttons.join(", ")}</span>}
                        </div>
                      ))}
                      {st.runs.length === 0 && st.messages.length === 0 && (
                        <p className="mt-1 text-xs text-danger">Nothing happened at this step.</p>
                      )}
                    </li>
                  ))}
                </ol>
              )}
            </Panel>
          );
        })}
      </div>
    </AppShell>
  );
}
