import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { createContext, useContext, useEffect, useState } from "react";
import { getRevenue, saveCampaign, saveProduct } from "@/lib/revenue.functions";
import { rupeesToPaise } from "@/lib/revenue";
import { toast } from "sonner";
import { ArrowDown, ArrowUp, GitBranch, GripVertical, Info, Lock, Maximize2, Plus, Sparkles, Trash2, Zap, ZoomIn, ZoomOut } from "lucide-react";

import { AppShell } from "@/components/app/AppShell";
import { EmptyState, PageHeader, Panel, StatusBadge } from "@/components/app/primitives";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Switch } from "@/components/ui/switch";
import { useTenant } from "@/hooks/useTenant";
import { getFlowAiStatus, getFlows, saveFlows, suggestFlowWithAi } from "@/lib/flows.functions";
import { FLOW_TEMPLATES, TEMPLATE_CATEGORIES, flowFromTemplate } from "@/lib/flow-templates";
import { GuideButton } from "@/components/app/GuideButton";
import {
  MAX_FLOWS, MAX_STEPS, MAX_LEAD_FIELDS, MAX_LEAD_OPTIONS, leadFieldKey, TAG_PRESETS, TRIGGER_LABELS, moveStep, newStepId, runFlowDry, validateFlow,
  type Flow, type FlowStep, type FlowTrigger, type LeadField,
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

const RevenueOptions = createContext<{ orgId?: string | undefined; products: { id: string; name: string }[]; campaigns: { id: string; name: string }[] }>({ products: [], campaigns: [] });

const sel = "h-9 rounded-md border border-input bg-background px-2 text-sm";

const STEP_TEMPLATES: { group: "Conditions" | "Actions" | "Sales" | "Contacts"; label: string; make: () => FlowStep }[] = [
  { group: "Conditions", label: "If contains", make: () => ({ id: newStepId(), kind: "condition", check: "contains", value: "" }) },
  { group: "Conditions", label: "If does not contain", make: () => ({ id: newStepId(), kind: "condition", check: "not_contains", value: "" }) },
  { group: "Conditions", label: "If follower", make: () => ({ id: newStepId(), kind: "condition", check: "is_follower", value: "yes" }) },
  { group: "Conditions", label: "If non-follower", make: () => ({ id: newStepId(), kind: "condition", check: "is_follower", value: "no" }) },
  { group: "Conditions", label: "If has tag", make: () => ({ id: newStepId(), kind: "condition", check: "has_tag", value: "" }) },
  { group: "Conditions", label: "If missing tag", make: () => ({ id: newStepId(), kind: "condition", check: "no_tag", value: "" }) },
  { group: "Conditions", label: "If email / phone known", make: () => ({ id: newStepId(), kind: "condition", check: "has_contact", value: "any" }) },
  { group: "Actions", label: "Send DM", make: () => ({ id: newStepId(), kind: "send_dm", text: "" }) },
  { group: "Actions", label: "Public reply", make: () => ({ id: newStepId(), kind: "public_reply", text: "" }) },
  { group: "Actions", label: "Follow gate (Visit profile)", make: () => ({ id: newStepId(), kind: "follow_gate", text: "Please follow us first, then tap \"I followed\" 🙏", buttonTitle: "Visit profile", profileUrl: "" }) },
  { group: "Actions", label: "Wait", make: () => ({ id: newStepId(), kind: "wait", minutes: 5 }) },
  { group: "Contacts", label: "Add tag", make: () => ({ id: newStepId(), kind: "tag", value: "" }) },
  { group: "Contacts", label: "Remove tag", make: () => ({ id: newStepId(), kind: "remove_tag", value: "" }) },
  { group: "Contacts", label: "Ask email / phone", make: () => ({ id: newStepId(), kind: "ask_contact", text: "Reply with your email or WhatsApp number and we'll send you the details 😊" }) },
  { group: "Contacts", label: "Lead form", make: () => ({ id: newStepId(), kind: "lead_form", intro: "Quick 3 questions so we can help you better 🙌", fields: [
    { key: "name", label: "What's your name?", type: "text", options: [] },
    { key: "email", label: "Your email?", type: "email", options: [] },
    { key: "interest", label: "What are you interested in?", type: "choice", options: ["Product", "Service", "Just browsing"] },
  ] }) },
  { group: "Sales", label: "Send payment link", make: () => ({ id: newStepId(), kind: "send_payment", productId: "", text: "" }) },
  { group: "Sales", label: "Send coupon", make: () => ({ id: newStepId(), kind: "send_coupon", campaignId: "", text: "Here is your code: {code}" }) },
];

function stepLabel(s: FlowStep): string {
  if (s.kind === "condition") {
    return { contains: "If contains", not_contains: "If does not contain", is_follower: s.value === "no" ? "If non-follower" : "If follower", has_tag: "If has tag", no_tag: "If missing tag", has_contact: "If email / phone" }[s.check];
  }
  return { send_dm: "Send DM", public_reply: "Public reply", wait: "Wait", tag: "Add tag", remove_tag: "Remove tag", ask_contact: "Ask email / phone", follow_gate: "Follow gate", send_payment: "Payment link", send_coupon: "Coupon", lead_form: "Lead form" }[s.kind];
}

const STEP_HELP = {
  contains: {
    title: "If comment/DM contains",
    how: "Checks whether the person's comment or DM contains any keyword entered here. Separate multiple keywords with commas.",
    why: "Use it to continue this flow only for messages about a specific topic, such as price, link or catalog.",
  },
  follower: {
    title: "If follower",
    how: "Checks whether the person currently follows the connected Instagram or Facebook account.",
    why: "Use it to give follower-only links or to ask non-followers to follow before continuing.",
  },
  send_dm: {
    title: "Send DM",
    how: "Sends a private message to the person. You can also add one optional button with a secure https link.",
    why: "Use it for links, details or replies that should not appear publicly under a post.",
  },
  public_reply: {
    title: "Public reply",
    how: "Posts this message as a public reply below the person's comment. It works only with a New comment trigger.",
    why: "Use it to acknowledge a comment publicly before sending any private follow-up.",
  },
  wait: {
    title: "Wait",
    how: "Pauses this person's flow for the number of minutes entered, then continues with the next step.",
    why: "Use it to space out follow-ups instead of sending several messages at once.",
  },
  tag: {
    title: "Add tag",
    how: "Adds a label to the person's record in Contacts, for example hot-lead, pricing or customer.",
    why: "Use it to organise contacts, create filtered groups and target future broadcasts. It does not send a message.",
  },
  send_payment: {
    title: "Send payment link",
    how: "Creates a unique payment link for the selected product and sends it privately to this person.",
    why: "Use it to take payment inside a sales conversation and track whether that person paid.",
  },
  send_coupon: {
    title: "Send coupon",
    how: "Creates a unique code from the selected campaign and replaces {code} in your message before sending.",
    why: "Use it for personal offers without giving every contact the same reusable code.",
  },
  not_contains: {
    title: "If does not contain",
    how: "Continues only when the message has none of these keywords.",
    why: "Use it to skip spam or people who already said 'stop', 'no' or 'done'.",
  },
  has_tag: {
    title: "If has tag / If missing tag",
    how: "Checks the person's tags in Contacts. 'Has tag' continues only if the tag is there; 'missing tag' only if it is not.",
    why: "Use it to avoid sending the same offer twice (e.g. missing tag discount-claimed) or to treat paid customers differently.",
  },
  has_contact: {
    title: "If email / phone known",
    how: "Checks whether this person's email or phone is already saved in Contacts.",
    why: "Use 'not saved yet' before an Ask email / phone step so you never ask twice.",
  },
  remove_tag: {
    title: "Remove tag",
    how: "Removes a label from the person in Contacts. It does not send a message.",
    why: "Use it to move people between stages, e.g. remove cart-abandoned after they pay.",
  },
  ask_contact: {
    title: "Ask email / phone",
    how: "Sends a DM asking for email or WhatsApp number. When they reply, it is saved to Contacts automatically.",
    why: "Use it to build your lead list for follow-ups outside Instagram/Facebook.",
  },
  follow_gate: {
    title: "Follow gate (Visit profile)",
    how: "Followers pass straight through to the next step. Non-followers get this DM with a Visit profile button and the flow stops — when they follow and comment again, the flow continues for them.",
    why: "Use it to give links or freebies only to followers and grow your audience.",
  },
  lead_form: {
    title: "Lead form",
    how: "Asks your questions one by one in DM. Choice questions show tap buttons. Each answer is checked (email, phone, choice) and saved to the person's Contacts record; after the last answer the flow continues.",
    why: "Use it to qualify leads — name, budget, city, interest — without sending people to an outside form.",
  },
} as const;

function helpForStep(step: FlowStep) {
  if (step.kind === "condition") {
    if (step.check === "is_follower") return STEP_HELP.follower;
    if (step.check === "no_tag") return STEP_HELP.has_tag;
    return STEP_HELP[step.check];
  }
  return STEP_HELP[step.kind];
}

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
  const fetchRev = useServerFn(getRevenue);
  const revQ = useQuery({ queryKey: ["revenue", orgId], enabled: !!orgId, queryFn: () => fetchRev({ data: { organizationId: orgId! } }) });
  const revOpts = {
    orgId: orgId ?? undefined,
    products: (revQ.data?.products ?? []).map((p: any) => ({ id: p.id as string, name: p.name as string })),
    campaigns: (revQ.data?.campaigns ?? []).map((c: any) => ({ id: c.id as string, name: c.name as string })),
  };
  const [flows, setFlows] = useState<Flow[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [zoom, setZoom] = useState(0.8);
  const [category, setCategory] = useState<string>("all");
  const zoomBy = (d: number) => setZoom((z) => Math.min(1.5, Math.max(0.4, Math.round((z + d) * 10) / 10)));
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

  function addAiFlow(f: Flow) {
    if (flows.length >= MAX_FLOWS) return;
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
    <RevenueOptions.Provider value={revOpts}><AppShell>
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
      <div className="mt-4 grid gap-4 lg:grid-cols-[240px_minmax(0,1fr)] 2xl:grid-cols-[240px_minmax(0,1fr)_320px]">
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
            <div className="mb-2 flex flex-wrap gap-1">
              {TEMPLATE_CATEGORIES.map((c) => (
                <button
                  key={c.key}
                  onClick={() => setCategory(c.key)}
                  className={`rounded-full border px-2 py-0.5 text-xs ${category === c.key ? "border-primary bg-primary text-primary-foreground" : "border-border hover:bg-muted"}`}
                >
                  {c.label}
                </button>
              ))}
            </div>
            <ul className="space-y-1">
              {FLOW_TEMPLATES.filter((t) => category === "all" || t.category === category).map((t) => (
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

            <FlowCanvas
              flow={flow}
              zoom={zoom}
              setZoom={setZoom}
              zoomBy={zoomBy}
              onFlow={(patch) => update(patch)}
              trigger={
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
              }
              renderStep={(s, i) => (
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
              )}
              addBar={
                <div className="space-y-2">
                  {(["Conditions", "Actions", "Contacts", "Sales"] as const).map((g) => (
                    <div key={g}>
                      <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{g}</p>
                      <div className="flex flex-wrap gap-1.5">
                        {STEP_TEMPLATES.filter((t) => t.group === g).map((t) => (
                          <Button key={t.label} size="sm" variant="outline" disabled={flow.steps.length >= MAX_STEPS} onClick={() => setSteps([...flow.steps, t.make()])}>
                            <Plus className="size-3.5" /> {t.label}
                          </Button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              }
            />
            <p className="text-xs text-muted-foreground">Tip: drag a card by its title to place it anywhere, drag empty space to move around, Ctrl + mouse wheel zooms. Lines show the order steps run in (change it with the arrows). Switch a step off with its toggle to skip it.</p>
            {issues.length > 0 && (
              <ul className="list-disc space-y-1 pl-5 text-sm text-destructive">
                {issues.map((x) => <li key={x}>{x}</li>)}
              </ul>
            )}
          </div>
        ) : (
          <Panel><EmptyState icon={GitBranch} title="Pick or create a flow" description="Flows run top to bottom. A condition that is not met stops the flow." /></Panel>
        )}

        {flow ? (
          <div className="grid gap-4 md:grid-cols-2 lg:col-span-2 2xl:col-span-1 2xl:grid-cols-1 2xl:content-start">
            <TestPanel flow={flow} />
            <AiSuggestPanel orgId={orgId} current={flow} onAdd={addAiFlow} />
          </div>
        ) : (
          <AiSuggestPanel orgId={orgId} current={null} onAdd={addAiFlow} />
        )}
      </div>
    </AppShell></RevenueOptions.Provider>
  );
}

function StepCard({ step, index, onChange, onRemove, onMove }: {
  step: FlowStep; index: number; onChange: (s: FlowStep) => void; onRemove: () => void; onMove: (d: number) => void;
}) {
  const isCond = step.kind === "condition";
  const rev = useContext(RevenueOptions);
  const help = helpForStep(step);
  return (
    <div className={`rounded-xl border bg-card p-4 shadow-sm ${isCond ? "border-warning/50" : "border-border"} ${step.disabled ? "opacity-50" : ""}`}>
      <div className="flex items-center justify-between">
        <div className="flex min-w-0 items-center gap-1">
          <p data-drag-handle className="flex min-w-0 cursor-move items-center gap-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            <GripVertical className="size-4 cursor-grab" aria-label="Drag to place" />
            {index + 1}. {stepLabel(step)}{step.disabled ? " · off" : ""}
          </p>
          <Popover>
            <PopoverTrigger asChild>
              <Button
                type="button"
                size="icon"
                variant="ghost"
                className="size-7 shrink-0 text-muted-foreground"
                aria-label={`About ${help.title}`}
              >
                <Info className="size-3.5" />
              </Button>
            </PopoverTrigger>
            <PopoverContent align="start" className="w-80 max-w-[calc(100vw-2rem)]">
              <p className="text-sm font-semibold">{help.title}</p>
              <div className="mt-3 space-y-3 text-sm">
                <div>
                  <p className="font-medium">How it works</p>
                  <p className="mt-1 text-muted-foreground">{help.how}</p>
                </div>
                <div>
                  <p className="font-medium">Why use it</p>
                  <p className="mt-1 text-muted-foreground">{help.why}</p>
                </div>
              </div>
            </PopoverContent>
          </Popover>
        </div>
        <div className="flex items-center">
          <Switch checked={!step.disabled} onCheckedChange={(v) => onChange({ ...step, disabled: !v })} aria-label="Step on or off" className="mr-1" />
          <Button size="icon" variant="ghost" aria-label="Move up" onClick={() => onMove(-1)}><ArrowUp className="size-4" /></Button>
          <Button size="icon" variant="ghost" aria-label="Move down" onClick={() => onMove(1)}><ArrowDown className="size-4" /></Button>
          <Button size="icon" variant="ghost" aria-label="Remove step" onClick={onRemove}><Trash2 className="size-4" /></Button>
        </div>
      </div>
      <div className="mt-2 space-y-2">
        {step.kind === "condition" && step.check === "not_contains" && (
          <Input placeholder="Keywords, comma separated (e.g. stop, no)" value={step.value} onChange={(e) => onChange({ ...step, value: e.target.value })} />
        )}
        {step.kind === "condition" && (step.check === "has_tag" || step.check === "no_tag") && (
          <div className="space-y-2">
            <select className={sel} value={step.check} onChange={(e) => onChange({ ...step, check: e.target.value as "has_tag" | "no_tag" })}>
              <option value="has_tag">Has tag</option>
              <option value="no_tag">Does not have tag</option>
            </select>
            <TagInput value={step.value} onChange={(v) => onChange({ ...step, value: v })} />
          </div>
        )}
        {step.kind === "condition" && step.check === "has_contact" && (
          <select className={sel} value={step.value} onChange={(e) => onChange({ ...step, value: e.target.value as typeof step.value })}>
            <option value="any">Email or phone is saved</option>
            <option value="email">Email is saved</option>
            <option value="phone">Phone is saved</option>
            <option value="none">Nothing saved yet</option>
          </select>
        )}
        {(step.kind === "ask_contact" || step.kind === "follow_gate") && (
          <textarea
            rows={3}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            placeholder="Message text"
            value={step.text}
            maxLength={1000}
            onChange={(e) => onChange({ ...step, text: e.target.value })}
          />
        )}
        {step.kind === "follow_gate" && (
          <div className="grid gap-2 sm:grid-cols-2">
            <Input placeholder="Button title" maxLength={20} value={step.buttonTitle} onChange={(e) => onChange({ ...step, buttonTitle: e.target.value })} />
            <Input placeholder="https://instagram.com/yourprofile" value={step.profileUrl} onChange={(e) => onChange({ ...step, profileUrl: e.target.value })} />
          </div>
        )}
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
        {step.kind === "send_payment" && (
          <>
            <select className={sel} value={step.productId} onChange={(e) => onChange({ ...step, productId: e.target.value })}>
              <option value="">Choose a product…</option>
              {rev.products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
            <Input placeholder="Message (optional, default: product name + price)" maxLength={600} value={step.text} onChange={(e) => onChange({ ...step, text: e.target.value })} />
            <QuickCreate kind="product" onCreated={(id) => onChange({ ...step, productId: id })} />
          </>
        )}
        {step.kind === "send_coupon" && (
          <>
            <select className={sel} value={step.campaignId} onChange={(e) => onChange({ ...step, campaignId: e.target.value })}>
              <option value="">Choose a coupon campaign…</option>
              {rev.campaigns.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <Input placeholder="Message with {code}" maxLength={600} value={step.text} onChange={(e) => onChange({ ...step, text: e.target.value })} />
            <QuickCreate kind="coupon" onCreated={(id) => onChange({ ...step, campaignId: id })} />
          </>
        )}
        {step.kind === "lead_form" && <LeadFormEditor step={step} onChange={onChange} />}
        {(step.kind === "tag" || step.kind === "remove_tag") && (
          <TagInput value={step.value} onChange={(v) => onChange({ ...step, value: v })} />
        )}
      </div>
    </div>
  );
}

function LeadFormEditor({ step, onChange }: { step: Extract<FlowStep, { kind: "lead_form" }>; onChange: (s: FlowStep) => void }) {
  const setField = (j: number, f: LeadField) => onChange({ ...step, fields: step.fields.map((x, k) => (k === j ? f : x)) });
  return (
    <div className="space-y-2">
      <Input placeholder="Intro message (optional)" maxLength={500} value={step.intro} onChange={(e) => onChange({ ...step, intro: e.target.value })} />
      {step.fields.map((f, j) => (
        <div key={j} className="space-y-2 rounded-lg border bg-surface-secondary p-2">
          <div className="flex gap-2">
            <Input placeholder={`Question ${j + 1}`} maxLength={120} value={f.label} onChange={(e) => setField(j, { ...f, label: e.target.value, key: leadFieldKey(e.target.value) })} />
            <select className={sel} value={f.type} aria-label="Answer type" onChange={(e) => setField(j, { ...f, type: e.target.value as LeadField["type"], options: e.target.value === "choice" ? (f.options.length ? f.options : ["Option 1", "Option 2"]) : [] })}>
              <option value="text">Text</option>
              <option value="email">Email</option>
              <option value="phone">Phone</option>
              <option value="choice">Multiple choice</option>
            </select>
            <Button size="icon" variant="ghost" aria-label="Remove question" onClick={() => onChange({ ...step, fields: step.fields.filter((_, k) => k !== j) })}><Trash2 className="size-4" /></Button>
          </div>
          {f.type === "choice" && (
            <Input placeholder="Choices, comma separated (max 20 letters each)" value={f.options.join(", ")}
              onChange={(e) => setField(j, { ...f, options: e.target.value.split(",").map((o) => o.trimStart().slice(0, 20)).slice(0, MAX_LEAD_OPTIONS) })} />
          )}
          <p className="text-xs text-muted-foreground">Saved in Contacts as “{f.key}”.</p>
        </div>
      ))}
      {step.fields.length < MAX_LEAD_FIELDS && (
        <Button size="sm" variant="outline" onClick={() => onChange({ ...step, fields: [...step.fields, { key: "field", label: "", type: "text", options: [] }] })}>
          <Plus className="size-4" /> Add question
        </Button>
      )}
    </div>
  );
}

/** Create a product or coupon campaign right inside the step, then auto-select it. */
function QuickCreate({ kind, onCreated }: { kind: "product" | "coupon"; onCreated: (id: string) => void }) {
  const rev = useContext(RevenueOptions);
  const qc = useQueryClient();
  const saveP = useServerFn(saveProduct);
  const saveC = useServerFn(saveCampaign);
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({ name: "", price: "", url: "", desc: "", prefix: "", label: "", max: "500" });
  const m = useMutation({
    mutationFn: async () => {
      if (!rev.orgId) throw new Error("No workspace selected");
      if (kind === "product") {
        const pricePaise = rupeesToPaise(f.price);
        if (!pricePaise) throw new Error("Price must be at least ₹1");
        return saveP({ data: { organizationId: rev.orgId, name: f.name, description: f.desc || null, pricePaise, manualUrl: f.url || null, active: true } });
      }
      return saveC({ data: { organizationId: rev.orgId, name: f.name, prefix: f.prefix, discountLabel: f.label, maxCodes: Number(f.max) || 500, expiresAt: null, active: true } });
    },
    onSuccess: async (r) => {
      await qc.invalidateQueries({ queryKey: ["revenue", rev.orgId] });
      onCreated(r.id);
      toast.success(kind === "product" ? "Product created and selected" : "Coupon created and selected");
      setOpen(false);
      setF({ name: "", price: "", url: "", desc: "", prefix: "", label: "", max: "500" });
    },
    onError: (e: Error) => toast.error(e.message),
  });
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button type="button" size="sm" variant="outline" className="w-fit"><Plus className="mr-1 size-3.5" />{kind === "product" ? "Create new product" : "Create new coupon"}</Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 space-y-2">
        <p className="text-sm font-medium">{kind === "product" ? "New product" : "New coupon campaign"}</p>
        <Input placeholder={kind === "product" ? "Product name (e.g. Instagram Growth Ebook)" : "Campaign name (e.g. Diwali sale)"} value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
        {kind === "product" ? (
          <>
            <Input type="number" min={1} placeholder="Price in ₹ (e.g. 499)" value={f.price} onChange={(e) => setF({ ...f, price: e.target.value })} />
            <Input placeholder="Short description (optional)" value={f.desc} onChange={(e) => setF({ ...f, desc: e.target.value })} />
            <Input placeholder="https:// payment link (only if Razorpay is not set up)" value={f.url} onChange={(e) => setF({ ...f, url: e.target.value })} />
          </>
        ) : (
          <>
            <Input placeholder="Code start (e.g. DIWALI) — letters/numbers" value={f.prefix} onChange={(e) => setF({ ...f, prefix: e.target.value.toUpperCase() })} />
            <Input placeholder="Discount (e.g. 20% off)" value={f.label} onChange={(e) => setF({ ...f, label: e.target.value })} />
            <Input type="number" min={1} placeholder="How many codes" value={f.max} onChange={(e) => setF({ ...f, max: e.target.value })} />
          </>
        )}
        <Button size="sm" className="w-full" disabled={m.isPending || !f.name} onClick={() => m.mutate()}>{m.isPending ? "Saving…" : "Create & select"}</Button>
      </PopoverContent>
    </Popover>
  );
}

function TagInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div className="w-full space-y-1.5">
      <Input placeholder="Tag name (e.g. hot-lead)" maxLength={40} value={value} onChange={(e) => onChange(e.target.value.toLowerCase().replace(/\s+/g, "-"))} />
      <div className="flex flex-wrap gap-1">
        {TAG_PRESETS.map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => onChange(t)}
            className={`rounded-full border px-2 py-0.5 text-xs ${value === t ? "border-primary bg-primary text-primary-foreground" : "border-border text-muted-foreground hover:bg-muted"}`}
          >
            {t}
          </button>
        ))}
      </div>
    </div>
  );
}

function AiSuggestPanel({ orgId, current, onAdd }: { orgId: string | undefined; current: Flow | null; onAdd: (f: Flow) => void }) {
  const fetchStatus = useServerFn(getFlowAiStatus);
  const suggest = useServerFn(suggestFlowWithAi);
  const qc = useQueryClient();
  const st = useQuery({ queryKey: ["flow-ai", orgId], enabled: !!orgId, queryFn: () => fetchStatus({ data: { organizationId: orgId! } }) });
  const [goal, setGoal] = useState("");
  const [note, setNote] = useState("");
  const m = useMutation({
    mutationFn: () => suggest({ data: { organizationId: orgId!, goal, current: current ?? undefined } }),
    onSuccess: (r) => {
      qc.invalidateQueries({ queryKey: ["flow-ai", orgId] });
      if ("flow" in r && r.flow) {
        onAdd(r.flow);
        setNote(r.explanation);
        toast.success("AI flow added as a draft — review it, then Save all.");
      } else if ("error" in r) {
        toast.error(r.error === "daily_limit" ? "You already used today's AI flow." : r.error === "agency_only" ? "AI flows are on the Agency plan." : "AI could not build a flow right now. Try again later.");
      }
    },
    onError: () => toast.error("AI could not build a flow right now."),
  });
  const allowed = st.data?.allowed;
  const nextAt = st.data?.nextAt;
  return (
    <Panel title="AI flow suggestion">
      {!allowed ? (
        <div className="space-y-2 text-sm">
          <p className="flex items-center gap-2 font-medium"><Lock className="size-4" /> Agency plan only</p>
          <p className="text-muted-foreground">On the Agency plan, AI looks at your flow and builds an improved version — one AI flow per day.</p>
          <Button asChild size="sm" variant="outline"><Link to="/billing">Upgrade</Link></Button>
        </div>
      ) : (
        <div className="space-y-2">
          <p className="text-sm text-muted-foreground">{current ? "AI will suggest what to add next to this flow." : "Describe your goal and AI will build a flow."} 1 per day.</p>
          <Input placeholder="Goal (optional), e.g. sell my course and collect emails" maxLength={400} value={goal} onChange={(e) => setGoal(e.target.value)} />
          <Button size="sm" className="w-full" onClick={() => m.mutate()} disabled={!!nextAt || m.isPending}>
            <Sparkles className="size-4" /> {m.isPending ? "Thinking…" : nextAt ? `Next on ${new Date(nextAt).toLocaleString()}` : "AI suggest flow"}
          </Button>
          {note && <p className="whitespace-pre-wrap rounded-md border border-border p-2 text-xs text-muted-foreground">{note}</p>}
        </div>
      )}
    </Panel>
  );
}

function TestPanel({ flow }: { flow: Flow }) {
  const [text, setText] = useState("What is the price?");
  const [platform, setPlatform] = useState<"instagram" | "facebook">("instagram");
  const [follower, setFollower] = useState<"yes" | "no">("yes");
  const [tags, setTags] = useState("");
  const [contact, setContact] = useState<"none" | "email" | "phone">("none");
  const r = runFlowDry(flow, {
    text, platform, isFollower: follower === "yes", trigger: flow.trigger,
    tags: tags.split(",").map((t) => t.trim()).filter(Boolean), hasEmail: contact === "email", hasPhone: contact === "phone",
  });
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
        <Input value={tags} onChange={(e) => setTags(e.target.value)} placeholder="Existing tags (optional), e.g. paid-customer" aria-label="Sample tags" />
        <select className={sel} value={contact} onChange={(e) => setContact(e.target.value as "none" | "email" | "phone")}>
          <option value="none">No email/phone saved</option>
          <option value="email">Email saved</option>
          <option value="phone">Phone saved</option>
        </select>
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
        {r.stoppedAt !== null && <p className="text-muted-foreground">Stopped at step {r.stoppedAt + 1} ({flow.steps[r.stoppedAt]?.kind === "follow_gate" ? "waiting for them to follow" : "condition not met"}).</p>}
        <p className="pt-2 text-xs text-muted-foreground">Preview only — this box never sends anything.</p>
      </div>
    </Panel>
  );
}

/* ---------------- n8n-style free canvas ---------------- */

const NODE_W = 360;
const GAP_X = 420;
const defaultPos = (i: number) => ({ x: 40 + ((i + 1) % 3) * GAP_X, y: 60 + Math.floor((i + 1) / 3) * 460 });
type Pos = { x: number; y: number };

function FlowCanvas({ flow, zoom, setZoom, zoomBy, onFlow, trigger, renderStep, addBar }: {
  flow: Flow; zoom: number; setZoom: (z: number) => void; zoomBy: (d: number) => void;
  onFlow: (patch: Partial<Flow>) => void; trigger: React.ReactNode;
  renderStep: (s: FlowStep, i: number) => React.ReactNode; addBar: React.ReactNode;
}) {
  const [pan, setPan] = useState<Pos>({ x: 0, y: 0 });
  const [live, setLive] = useState<Record<string, Pos>>({});
  const tPos = live["__trigger"] ?? flow.triggerPos ?? { x: 40, y: 60 };
  const posOf = (s: FlowStep, i: number) => live[s.id] ?? s.pos ?? defaultPos(i);
  const addPos = live["__add"] ?? flow.addPos ?? defaultPos(flow.steps.length);
  const nodes: Pos[] = [tPos, ...flow.steps.map(posOf), addPos];

  const startPan = (e: React.PointerEvent) => {
    if ((e.target as HTMLElement).closest("[data-node]")) return;
    const sx = e.clientX, sy = e.clientY, o = pan;
    const move = (ev: PointerEvent) => setPan({ x: o.x + ev.clientX - sx, y: o.y + ev.clientY - sy });
    const up = () => { window.removeEventListener("pointermove", move); window.removeEventListener("pointerup", up); };
    window.addEventListener("pointermove", move); window.addEventListener("pointerup", up);
  };
  const startDrag = (key: string, from: Pos) => (e: React.PointerEvent) => {
    if (!(e.target as HTMLElement).closest("[data-drag-handle]")) return;
    e.preventDefault();
    const sx = e.clientX, sy = e.clientY;
    let last = from;
    const move = (ev: PointerEvent) => {
      last = { x: Math.round(from.x + (ev.clientX - sx) / zoom), y: Math.round(from.y + (ev.clientY - sy) / zoom) };
      setLive((l) => ({ ...l, [key]: last }));
    };
    const up = () => {
      window.removeEventListener("pointermove", move); window.removeEventListener("pointerup", up);
      setLive((l) => { const { [key]: _x, ...rest } = l; return rest; });
      if (key === "__trigger") onFlow({ triggerPos: last });
      else if (key === "__add") onFlow({ addPos: last });
      else onFlow({ steps: flow.steps.map((s) => (s.id === key ? { ...s, pos: last } : s)) });
    };
    window.addEventListener("pointermove", move); window.addEventListener("pointerup", up);
  };
  const arrange = () => { onFlow({ triggerPos: undefined, addPos: undefined, steps: flow.steps.map(({ pos: _p, ...s }) => s as FlowStep) }); setPan({ x: 0, y: 0 }); setZoom(1); };
  const PORT = 30;
  const maxX = Math.max(...nodes.map((n) => n.x)) + NODE_W + 200;
  const maxY = Math.max(...nodes.map((n) => n.y)) + 900;

  return (
    <div className="relative overflow-hidden rounded-xl border border-border">
      <div className="absolute right-2 top-2 z-10 flex items-center gap-1 rounded-md border border-border bg-card p-1 shadow-sm">
        <Button size="icon" variant="ghost" className="size-7" aria-label="Zoom out" onClick={() => zoomBy(-0.1)}><ZoomOut className="size-4" /></Button>
        <span className="w-10 text-center text-xs tabular-nums">{Math.round(zoom * 100)}%</span>
        <Button size="icon" variant="ghost" className="size-7" aria-label="Zoom in" onClick={() => zoomBy(0.1)}><ZoomIn className="size-4" /></Button>
        <Button size="icon" variant="ghost" className="size-7" aria-label="Reset view" onClick={() => { setPan({ x: 0, y: 0 }); setZoom(1); }}><Maximize2 className="size-4" /></Button>
        <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={arrange}>Auto-arrange</Button>
      </div>
      <div
        className="h-[75vh] cursor-grab touch-none select-none bg-muted/30 active:cursor-grabbing"
        style={{ backgroundImage: "radial-gradient(var(--border) 1px, transparent 1px)", backgroundSize: `${20 * zoom}px ${20 * zoom}px`, backgroundPosition: `${pan.x}px ${pan.y}px` }}
        onPointerDown={startPan}
        onWheel={(e) => { if (e.ctrlKey || e.metaKey) { e.preventDefault(); zoomBy(e.deltaY < 0 ? 0.1 : -0.1); } else setPan((p) => ({ x: p.x - e.deltaX, y: p.y - e.deltaY })); }}
      >
        <div className="relative origin-top-left" style={{ transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`, width: maxX, height: maxY }}>
          <svg className="pointer-events-none absolute inset-0 overflow-visible" width={maxX} height={maxY}>
            {nodes.slice(0, -1).map((a, i) => {
              const b = nodes[i + 1]!;
              const x1 = a.x + NODE_W, y1 = a.y + PORT, x2 = b.x, y2 = b.y + PORT;
              const dx = Math.max(60, Math.abs(x2 - x1) / 2);
              const off = flow.steps[i]?.disabled;
              return (
                <g key={i}>
                  <path d={`M${x1},${y1} C${x1 + dx},${y1} ${x2 - dx},${y2} ${x2},${y2}`} fill="none" stroke="var(--primary)" strokeOpacity={off ? 0.3 : 0.7} strokeWidth={2} strokeDasharray={i === nodes.length - 2 ? "6 5" : undefined} />
                  <circle cx={x1} cy={y1} r={5} fill="var(--card)" stroke="var(--primary)" strokeWidth={2} />
                  <circle cx={x2} cy={y2} r={5} fill="var(--primary)" />
                </g>
              );
            })}
          </svg>
          <div data-node className="absolute" style={{ left: tPos.x, top: tPos.y, width: NODE_W }} onPointerDown={startDrag("__trigger", tPos)}>
            <div className="cursor-auto rounded-xl border-2 border-primary/40 bg-card p-4 shadow-md">
              <p data-drag-handle className="flex cursor-move items-center gap-2 text-xs font-semibold uppercase tracking-wide text-primary"><GripVertical className="size-4" /><Zap className="size-3.5" /> Trigger</p>
              {trigger}
            </div>
          </div>
          {flow.steps.map((s, i) => {
            const p = posOf(s, i);
            return (
              <div key={s.id} data-node className="absolute cursor-auto shadow-md" style={{ left: p.x, top: p.y, width: NODE_W }} onPointerDown={startDrag(s.id, p)}>
                {renderStep(s, i)}
              </div>
            );
          })}
          <div data-node className="absolute" style={{ left: addPos.x, top: addPos.y, width: NODE_W }} onPointerDown={startDrag("__add", addPos)}>
            <div className="cursor-auto rounded-xl border border-dashed border-border bg-card p-3 shadow-md">
              <p data-drag-handle className="mb-2 flex cursor-move items-center gap-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground"><GripVertical className="size-4" /> Add next step</p>
              {addBar}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
