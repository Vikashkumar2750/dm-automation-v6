import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { ArrowDown, ArrowUp, GitBranch, GripVertical, Plus, Trash2, Zap } from "lucide-react";

import { AppShell } from "@/components/app/AppShell";
import { EmptyState, PageHeader, Panel, StatusBadge } from "@/components/app/primitives";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { useTenant } from "@/hooks/useTenant";
import { getFlows, saveFlows } from "@/lib/flows.functions";
import { FLOW_TEMPLATES, flowFromTemplate } from "@/lib/flow-templates";
import { GuideButton } from "@/components/app/GuideButton";
import {
  MAX_FLOWS, MAX_STEPS, TRIGGER_LABELS, moveStep, newStepId, runFlowDry, validateFlow,
  type Flow, type FlowStep, type FlowTrigger,
} from "@/lib/flows";

export const Route = createFileRoute("/_authenticated/automations_/flows")({
  head: () => ({
    meta: [
      { title: "Flow Builder — AutoDM by Techaasvik" },
      { name: "description", content: "Design and test multi-step Instagram and Facebook automation flows." },
      { property: "og:title", content: "Flow Builder — AutoDM by Techaasvik" },
      { property: "og:description", content: "Trigger, condition and action steps in one visual flow." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: FlowsPage,
});

const sel = "h-9 rounded-md border border-input bg-background px-2 text-sm";

const STEP_TEMPLATES: { label: string; make: () => FlowStep }[] = [
  { label: "If comment/DM contains", make: () => ({ id: newStepId(), kind: "condition", check: "contains", value: "" }) },
  { label: "If follower", make: () => ({ id: newStepId(), kind: "condition", check: "is_follower", value: "yes" }) },
  { label: "Send DM", make: () => ({ id: newStepId(), kind: "send_dm", text: "" }) },
  { label: "Public reply", make: () => ({ id: newStepId(), kind: "public_reply", text: "" }) },
  { label: "Wait", make: () => ({ id: newStepId(), kind: "wait", minutes: 5 }) },
  { label: "Add tag", make: () => ({ id: newStepId(), kind: "tag", value: "" }) },
];

function FlowsPage() {
  const { activeOrg } = useTenant();
  const orgId = activeOrg?.id;
  const qc = useQueryClient();
  const fetchFlows = useServerFn(getFlows);
  const persist = useServerFn(saveFlows);
  const q = useQuery({
    queryKey: ["flows", orgId],
    enabled: !!orgId,
    queryFn: () => fetchFlows({ data: { organizationId: orgId! } }),
  });
  const [flows, setFlows] = useState<Flow[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [dragFrom, setDragFrom] = useState<number | null>(null);
  const [dragOver, setDragOver] = useState<number | null>(null);
  useEffect(() => {
    if (q.data) {
      setFlows(q.data.flows);
      setSelected((s) => s ?? q.data.flows[0]?.id ?? null);
    }
  }, [q.data]);

  const m = useMutation({
    mutationFn: (next: Flow[]) => persist({ data: { organizationId: orgId!, flows: next } }),
    onSuccess: (r) => {
      setFlows(r.flows);
      toast.success("Flows saved");
      qc.invalidateQueries({ queryKey: ["flows", orgId] });
    },
    onError: () => toast.error("Could not save flows"),
  });

  const flow = flows.find((f) => f.id === selected) ?? null;
  const update = (patch: Partial<Flow>) =>
    setFlows((all) => all.map((f) => (f.id === selected ? { ...f, ...patch, updatedAt: new Date().toISOString() } : f)));
  const setSteps = (steps: FlowStep[]) => update({ steps });

  function addFlow() {
    const f: Flow = {
      id: newStepId(), name: "New flow", active: false, platform: "both", trigger: "new_comment",
      steps: [], updatedAt: new Date().toISOString(),
    };
    setFlows((all) => [...all, f]);
    setSelected(f.id);
  }

  function addTemplate(key: string) {
    const f = flowFromTemplate(key);
    if (!f || flows.length >= MAX_FLOWS) return;
    setFlows((all) => [...all, f]);
    setSelected(f.id);
    toast.success("Template added as a draft — edit the texts and links, then Save all.");
  }

  if (q.data && !q.data.enabled) {
    return (
      <AppShell>
        <PageHeader title="Flow Builder" />
        <Panel>
          <EmptyState icon={GitBranch} title="Not available yet" description="The flow builder is not switched on for this workspace. Your keyword rules keep working as usual." />
        </Panel>
      </AppShell>
    );
  }

  const issues = flow ? validateFlow(flow) : [];

  return (
    <AppShell>
      <PageHeader
        title="Flow Builder"
        description="Advanced mode: chain conditions and actions into one flow. Keyword rules stay as simple mode."
        actions={
          <div className="flex gap-2">
            <GuideButton guide="automations" />
            <Button asChild variant="outline"><Link to="/automations">Back to rules</Link></Button>
            <Button onClick={() => m.mutate(flows)} disabled={m.isPending || !orgId}>Save all</Button>
          </div>
        }
      />
      <div className="rounded-lg border border-border bg-muted/40 p-3 text-sm text-muted-foreground">
        {q.data?.live
          ? "Live: active flows send real messages. Keyword rules run first; a flow only acts when no rule replied. Safety limits and quiet hours apply."
          : "Test mode: flows are designed and tested here only. They do not send real messages until Super Admin turns on live sending."}
      </div>
      <div className="mt-4 grid gap-4 lg:grid-cols-[260px_1fr_320px]">
        <Panel title="Flows" action={<Button size="sm" variant="outline" onClick={addFlow} disabled={flows.length >= MAX_FLOWS}><Plus className="size-4" /></Button>}>
          {flows.length === 0 ? (
            <p className="text-sm text-muted-foreground">No flows yet. Click + to start.</p>
          ) : (
            <ul className="space-y-1">
              {flows.map((f) => (
                <li key={f.id}>
                  <button
                    onClick={() => setSelected(f.id)}
                    className={`w-full rounded-md px-3 py-2 text-left text-sm ${f.id === selected ? "bg-accent text-accent-foreground" : "hover:bg-muted"}`}
                  >
                    <span className="block truncate font-medium">{f.name}</span>
                    <span className="text-xs text-muted-foreground">{TRIGGER_LABELS[f.trigger]} · {f.steps.length} steps</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
          <div className="mt-4 border-t border-border pt-3">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Ready-made templates</p>
            <ul className="space-y-1">
              {FLOW_TEMPLATES.map((t) => (
                <li key={t.key}>
                  <button
                    onClick={() => addTemplate(t.key)}
                    disabled={flows.length >= MAX_FLOWS}
                    className="w-full rounded-md border border-dashed border-border px-3 py-2 text-left text-sm hover:bg-muted disabled:opacity-50"
                  >
                    <span className="block font-medium">{t.name}</span>
                    <span className="text-xs text-muted-foreground">{t.description}</span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </Panel>

        {flow ? (
          <div className="space-y-3">
            <Panel>
              <div className="grid gap-3 sm:grid-cols-2">
                <Input value={flow.name} maxLength={80} onChange={(e) => update({ name: e.target.value })} aria-label="Flow name" />
                <div className="flex items-center justify-end gap-3">
                  <StatusBadge tone={flow.active ? "success" : "neutral"}>{flow.active ? "Active" : "Draft"}</StatusBadge>
                  <Switch checked={flow.active} disabled={issues.length > 0} onCheckedChange={(v) => update({ active: v })} aria-label="Active" />
                  <Button size="icon" variant="ghost" aria-label="Delete flow" onClick={() => { setFlows((a) => a.filter((f) => f.id !== flow.id)); setSelected(null); }}>
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              </div>
            </Panel>

            <div className="rounded-xl border-2 border-primary/40 bg-card p-4">
              <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-primary"><Zap className="size-3.5" /> Trigger</p>
              <div className="mt-2 flex flex-wrap gap-2">
                <select className={sel} value={flow.trigger} onChange={(e) => update({ trigger: e.target.value as FlowTrigger })}>
                  {Object.entries(TRIGGER_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
                <select className={sel} value={flow.platform} onChange={(e) => update({ platform: e.target.value as Flow["platform"] })}>
                  <option value="both">Both platforms (FB+IG only)</option>
                  <option value="instagram">Instagram</option>
                  <option value="facebook">Facebook</option>
                </select>
              </div>
            </div>

            {flow.steps.map((s, i) => (
              <div
                key={s.id}
                draggable
                onDragStart={(e) => { setDragFrom(i); e.dataTransfer.effectAllowed = "move"; }}
                onDragOver={(e) => { e.preventDefault(); setDragOver(i); }}
                onDragLeave={() => setDragOver((d) => (d === i ? null : d))}
                onDrop={(e) => {
                  e.preventDefault();
                  if (dragFrom !== null) setSteps(moveStep(flow.steps, dragFrom, i));
                  setDragFrom(null); setDragOver(null);
                }}
                onDragEnd={() => { setDragFrom(null); setDragOver(null); }}
                className={`${dragFrom === i ? "opacity-50" : ""} ${dragOver === i && dragFrom !== i ? "rounded-xl ring-2 ring-primary" : ""}`}
              >
                <div className="mx-auto h-4 w-px bg-border" />
                <StepCard
                  step={s}
                  index={i}
                  onChange={(n) => setSteps(flow.steps.map((x) => (x.id === s.id ? n : x)))}
                  onRemove={() => setSteps(flow.steps.filter((x) => x.id !== s.id))}
                  onMove={(d) => {
                    const arr = [...flow.steps];
                    const j = i + d;
                    if (j < 0 || j >= arr.length) return;
                    [arr[i], arr[j]] = [arr[j]!, arr[i]!];
                    setSteps(arr);
                  }}
                />
              </div>
            ))}

            <div className="mx-auto h-4 w-px bg-border" />
            <div className="flex flex-wrap justify-center gap-2 rounded-xl border border-dashed border-border p-3">
              {STEP_TEMPLATES.map((t) => (
                <Button key={t.label} size="sm" variant="outline" disabled={flow.steps.length >= MAX_STEPS} onClick={() => setSteps([...flow.steps, t.make()])}>
                  <Plus className="size-3.5" /> {t.label}
                </Button>
              ))}
            </div>
            {issues.length > 0 && (
              <ul className="list-disc space-y-1 pl-5 text-sm text-destructive">
                {issues.map((x) => <li key={x}>{x}</li>)}
              </ul>
            )}
          </div>
        ) : (
          <Panel><EmptyState icon={GitBranch} title="Pick or create a flow" description="Flows run top to bottom. A condition that is not met stops the flow." /></Panel>
        )}

        {flow && <TestPanel flow={flow} />}
      </div>
    </AppShell>
  );
}

function StepCard({ step, index, onChange, onRemove, onMove }: {
  step: FlowStep; index: number; onChange: (s: FlowStep) => void; onRemove: () => void; onMove: (d: number) => void;
}) {
  const isCond = step.kind === "condition";
  return (
    <div className={`rounded-xl border bg-card p-4 ${isCond ? "border-warning/50" : "border-border"}`}>
      <div className="flex items-center justify-between">
        <p className="flex items-center gap-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          <GripVertical className="size-4 cursor-grab" aria-label="Drag to reorder" />
          {index + 1}. {isCond ? "Condition" : step.kind === "send_dm" ? "Send DM" : step.kind === "public_reply" ? "Public reply" : step.kind === "wait" ? "Wait" : "Tag"}
        </p>
        <div className="flex">
          <Button size="icon" variant="ghost" aria-label="Move up" onClick={() => onMove(-1)}><ArrowUp className="size-4" /></Button>
          <Button size="icon" variant="ghost" aria-label="Move down" onClick={() => onMove(1)}><ArrowDown className="size-4" /></Button>
          <Button size="icon" variant="ghost" aria-label="Remove step" onClick={onRemove}><Trash2 className="size-4" /></Button>
        </div>
      </div>
      <div className="mt-2 space-y-2">
        {step.kind === "condition" && step.check === "contains" && (
          <Input placeholder="Keywords, comma separated (e.g. price, link)" value={step.value} onChange={(e) => onChange({ ...step, value: e.target.value })} />
        )}
        {step.kind === "condition" && step.check === "is_follower" && (
          <select className={sel} value={step.value} onChange={(e) => onChange({ ...step, value: e.target.value as "yes" | "no" })}>
            <option value="yes">Person follows the account</option>
            <option value="no">Person does not follow</option>
          </select>
        )}
        {(step.kind === "send_dm" || step.kind === "public_reply") && (
          <textarea
            rows={3}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            placeholder="Message text"
            value={step.text}
            maxLength={step.kind === "send_dm" ? 1000 : 500}
            onChange={(e) => onChange({ ...step, text: e.target.value })}
          />
        )}
        {step.kind === "send_dm" && (
          <div className="grid gap-2 sm:grid-cols-2">
            <Input placeholder="Button title (optional)" maxLength={20} value={step.buttonTitle ?? ""} onChange={(e) => onChange({ ...step, buttonTitle: e.target.value })} />
            <Input placeholder="https://link" value={step.buttonUrl ?? ""} onChange={(e) => onChange({ ...step, buttonUrl: e.target.value })} />
          </div>
        )}
        {step.kind === "wait" && (
          <Input type="number" min={1} max={1440} value={step.minutes} onChange={(e) => onChange({ ...step, minutes: Number(e.target.value) })} />
        )}
        {step.kind === "tag" && (
          <Input placeholder="Tag name (e.g. hot-lead)" maxLength={40} value={step.value} onChange={(e) => onChange({ ...step, value: e.target.value })} />
        )}
      </div>
    </div>
  );
}

function TestPanel({ flow }: { flow: Flow }) {
  const [text, setText] = useState("What is the price?");
  const [platform, setPlatform] = useState<"instagram" | "facebook">("instagram");
  const [follower, setFollower] = useState<"yes" | "no">("yes");
  const r = runFlowDry(flow, { text, platform, isFollower: follower === "yes", trigger: flow.trigger });
  return (
    <Panel title="Try it">
      <div className="space-y-2">
        <Input value={text} onChange={(e) => setText(e.target.value)} aria-label="Sample message" />
        <div className="flex gap-2">
          <select className={sel} value={platform} onChange={(e) => setPlatform(e.target.value as "instagram" | "facebook")}>
            <option value="instagram">Instagram</option>
            <option value="facebook">Facebook</option>
          </select>
          <select className={sel} value={follower} onChange={(e) => setFollower(e.target.value as "yes" | "no")}>
            <option value="yes">Follower</option>
            <option value="no">Not follower</option>
          </select>
        </div>
      </div>
      <div className="mt-4 space-y-2 text-sm">
        {!r.matched && <p className="text-muted-foreground">This flow would not start for this platform.</p>}
        {r.matched && r.actions.length === 0 && r.stoppedAt === null && <p className="text-muted-foreground">No actions yet.</p>}
        {r.actions.map((a, i) => (
          <div key={i} className="rounded-md border border-border p-2">
            <p className="text-xs font-semibold text-primary">{a.kind}</p>
            <p className="whitespace-pre-wrap">{a.detail || "(empty)"}</p>
          </div>
        ))}
        {r.stoppedAt !== null && <p className="text-muted-foreground">Stopped at step {r.stoppedAt + 1} (condition not met).</p>}
        <p className="pt-2 text-xs text-muted-foreground">Preview only — this box never sends anything.</p>
      </div>
    </Panel>
  );
}
