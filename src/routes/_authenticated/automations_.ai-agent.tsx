import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Bot, Download, Plus, Trash2 } from "lucide-react";

import { AppShell } from "@/components/app/AppShell";
import { EmptyState, PageHeader, Panel, StatusBadge } from "@/components/app/primitives";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { useTenant } from "@/hooks/useTenant";
import { getAgent, importPostKnowledge, saveAgent, testAgent } from "@/lib/ai-agent.functions";
import { DEFAULT_AGENT, MAX_KNOWLEDGE, type AiAgentConfig } from "@/lib/ai-agent";

export const Route = createFileRoute("/_authenticated/automations_/ai-agent")({
  head: () => ({
    meta: [
      { title: "AI Agent — AutoDM by Techaasvik" },
      { name: "description", content: "An AI agent that answers Instagram and Facebook DMs from your own knowledge." },
      { property: "og:title", content: "AI Agent — AutoDM by Techaasvik" },
      { property: "og:description", content: "Knowledge base, human handoff, intent, sentiment and lead scoring." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AiAgentPage,
});

const area = "w-full rounded-md border border-input bg-background px-3 py-2 text-sm";
const rid = () => Math.random().toString(36).slice(2, 10);

function AiAgentPage() {
  const { activeOrg } = useTenant();
  const orgId = activeOrg?.id;
  const qc = useQueryClient();
  const fetchAgent = useServerFn(getAgent);
  const persist = useServerFn(saveAgent);
  const importPosts = useServerFn(importPostKnowledge);
  const runTest = useServerFn(testAgent);
  const q = useQuery({ queryKey: ["ai-agent", orgId], enabled: !!orgId, queryFn: () => fetchAgent({ data: { organizationId: orgId! } }) });
  const [cfg, setCfg] = useState<AiAgentConfig>(DEFAULT_AGENT);
  useEffect(() => { if (q.data) setCfg(q.data.config); }, [q.data]);
  const set = (p: Partial<AiAgentConfig>) => setCfg((c) => ({ ...c, ...p }));

  const save = useMutation({
    mutationFn: () => persist({ data: { organizationId: orgId!, config: cfg } }),
    onSuccess: (r) => { setCfg(r.config); toast.success("AI agent saved"); qc.invalidateQueries({ queryKey: ["ai-agent", orgId] }); },
    onError: () => toast.error("Could not save the AI agent"),
  });
  const imp = useMutation({
    mutationFn: () => importPosts({ data: { organizationId: orgId! } }),
    onSuccess: (r) => {
      if (r.items.length === 0) { toast.info("No published posts with captions found"); return; }
      setCfg((c) => {
        const have = new Set(c.knowledge.map((k) => k.id));
        return { ...c, knowledge: [...c.knowledge, ...r.items.filter((i) => !have.has(i.id))].slice(0, MAX_KNOWLEDGE) };
      });
      toast.success("Added post captions — press Save");
    },
    onError: () => toast.error("Could not import posts"),
  });
  const [sample, setSample] = useState("What is the price?");
  const test = useMutation({
    mutationFn: () => runTest({ data: { organizationId: orgId!, message: sample, config: cfg } }),
    onError: () => toast.error("Test failed — check AI keys in Super Admin"),
  });

  if (q.data && !q.data.available) {
    return (
      <AppShell>
        <PageHeader title="AI Agent" />
        <Panel><EmptyState icon={Bot} title="Not available yet" description="The AI agent is not switched on for this workspace. Your rules keep working as usual." /></Panel>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <PageHeader
        title="AI Agent"
        description="Answers DMs from your own knowledge when no keyword rule or flow replied. Unsure answers go to your team."
        actions={
          <div className="flex gap-2">
            <Button asChild variant="outline"><Link to="/automations">Back to rules</Link></Button>
            <Button onClick={() => save.mutate()} disabled={save.isPending || !orgId}>Save</Button>
          </div>
        }
      />
      <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
        <div className="space-y-4">
          <Panel>
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="font-semibold">Agent on</p>
                <p className="text-sm text-muted-foreground">Only DMs. Comments are never answered by the agent.</p>
              </div>
              <Switch checked={cfg.enabled} onCheckedChange={(v) => set({ enabled: v })} aria-label="Agent on" />
            </div>
            <div className="mt-4 flex items-center justify-between gap-4">
              <div>
                <p className="font-semibold">Reply automatically</p>
                <p className="text-sm text-muted-foreground">Off = only label messages (intent, mood, lead score), never reply.</p>
              </div>
              <Switch checked={cfg.autoReply} onCheckedChange={(v) => set({ autoReply: v })} aria-label="Reply automatically" />
            </div>
            <div className="mt-4 grid gap-2">
              <label className="text-sm font-medium">How sure must the agent be? ({cfg.confidenceThreshold}%)</label>
              <input type="range" min={0} max={100} step={5} value={cfg.confidenceThreshold} onChange={(e) => set({ confidenceThreshold: Number(e.target.value) })} />
              <p className="text-xs text-muted-foreground">Below this, the chat is handed to your team and marked open in the Inbox.</p>
            </div>
            <div className="mt-4 grid gap-2">
              <label className="text-sm font-medium">Tone</label>
              <textarea rows={2} className={area} maxLength={500} value={cfg.persona} onChange={(e) => set({ persona: e.target.value })} />
            </div>
            <div className="mt-4 grid gap-2">
              <label className="text-sm font-medium">Message when handing over (leave empty to send nothing)</label>
              <textarea rows={2} className={area} maxLength={500} value={cfg.handoffMessage} onChange={(e) => set({ handoffMessage: e.target.value })} />
            </div>
          </Panel>

          <Panel
            title={`Knowledge (${cfg.knowledge.length}/${MAX_KNOWLEDGE})`}
            action={
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={() => imp.mutate()} disabled={imp.isPending}><Download className="size-4" /> From my posts</Button>
                <Button size="sm" variant="outline" disabled={cfg.knowledge.length >= MAX_KNOWLEDGE}
                  onClick={() => set({ knowledge: [...cfg.knowledge, { id: rid(), title: "", content: "" }] })}><Plus className="size-4" /> Add</Button>
              </div>
            }
          >
            {cfg.knowledge.length === 0 ? (
              <p className="text-sm text-muted-foreground">Add FAQs, prices, timings, links and policies. The agent answers only from this.</p>
            ) : (
              <div className="space-y-3">
                {cfg.knowledge.map((k) => (
                  <div key={k.id} className="rounded-lg border border-border p-3">
                    <div className="flex gap-2">
                      <Input placeholder="Title (e.g. Prices)" maxLength={100} value={k.title}
                        onChange={(e) => set({ knowledge: cfg.knowledge.map((x) => (x.id === k.id ? { ...x, title: e.target.value } : x)) })} />
                      <Button size="icon" variant="ghost" aria-label="Remove" onClick={() => set({ knowledge: cfg.knowledge.filter((x) => x.id !== k.id) })}><Trash2 className="size-4" /></Button>
                    </div>
                    <textarea rows={3} className={`${area} mt-2`} maxLength={2000} placeholder="Facts the agent can use" value={k.content}
                      onChange={(e) => set({ knowledge: cfg.knowledge.map((x) => (x.id === k.id ? { ...x, content: e.target.value } : x)) })} />
                  </div>
                ))}
              </div>
            )}
          </Panel>

          <Panel title="Recent AI decisions">
            {(q.data?.insights ?? []).length === 0 ? (
              <p className="text-sm text-muted-foreground">Nothing yet.</p>
            ) : (
              <div className="space-y-2">
                {q.data!.insights.map((i) => (
                  <div key={i.id} className="rounded-md border border-border p-2 text-sm">
                    <div className="flex flex-wrap items-center gap-2">
                      <StatusBadge tone={i.decision === "reply" ? "success" : i.decision === "handoff" ? "warning" : "neutral"}>{i.decision}</StatusBadge>
                      <span className="text-xs text-muted-foreground">{i.intent} · {i.sentiment} · lead {i.lead_score} · sure {i.confidence}%</span>
                      <span className="ml-auto text-xs text-muted-foreground">{new Date(i.created_at).toLocaleString()}</span>
                    </div>
                    <p className="mt-1">“{i.message_text}”</p>
                    {i.reply_text && <p className="mt-1 text-muted-foreground">→ {i.reply_text}</p>}
                  </div>
                ))}
              </div>
            )}
          </Panel>
        </div>

        <Panel title="Try it">
          <textarea rows={3} className={area} value={sample} maxLength={600} onChange={(e) => setSample(e.target.value)} />
          <Button className="mt-2 w-full" onClick={() => test.mutate()} disabled={test.isPending || !sample.trim()}>
            {test.isPending ? "Thinking…" : "Test answer"}
          </Button>
          {test.data && (
            <div className="mt-3 space-y-2 text-sm">
              {!test.data.verdict ? (
                <p className="text-muted-foreground">No AI answer — it would hand over to your team.</p>
              ) : (
                <>
                  <p><b>Would:</b> {test.data.decision}</p>
                  <p className="text-xs text-muted-foreground">{test.data.verdict.intent} · {test.data.verdict.sentiment} · lead {test.data.verdict.leadScore} · sure {test.data.verdict.confidence}%</p>
                  <p className="rounded-md border border-border p-2 whitespace-pre-wrap">{test.data.verdict.reply || "(no reply)"}</p>
                </>
              )}
              <p className="text-xs text-muted-foreground">Test only — nothing is sent.</p>
            </div>
          )}
        </Panel>
      </div>
    </AppShell>
  );
}
