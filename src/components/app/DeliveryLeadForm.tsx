import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { submitOfferForm } from "@/lib/revenue.functions";

type Field = { key: string; label: string; type: "text" | "email" | "phone" | "choice"; required: boolean; options: string[] };

export function DeliveryLeadForm({ token, config }: { token: string; config: { mode: "none" | "optional" | "required"; consent?: string; fields?: Field[] } }) {
  const submit = useServerFn(submitOfferForm);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [state, setState] = useState<"idle" | "saving" | "done">("idle");
  const [error, setError] = useState("");
  const fields = config.fields ?? [];
  if (config.mode === "none" || fields.length === 0) return null;
  if (state === "done") return <div className="rounded-lg border border-border bg-card p-5 text-center"><CheckCircle2 className="mx-auto size-7 text-success" /><p className="mt-2 font-medium">Details saved</p><p className="text-sm text-muted-foreground">You can continue with the offer below.</p></div>;
  return <form className="space-y-4 rounded-lg border border-border bg-card p-5" onSubmit={async (e) => { e.preventDefault(); setState("saving"); setError(""); try { await submit({ data: { token, answers } }); setState("done"); } catch (err) { setState("idle"); setError(err instanceof Error ? err.message : "Could not save details"); } }}>
    <div><h2 className="text-xl font-semibold">Tell us where to send the details</h2><p className="mt-1 text-sm text-muted-foreground">A short form after you have seen the offer.</p></div>
    {fields.map((field) => <div key={field.key} className="space-y-1.5"><Label htmlFor={`offer-${field.key}`}>{field.label}{field.required ? " *" : ""}</Label>{field.type === "choice" ? <select id={`offer-${field.key}`} required={field.required} className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={answers[field.key] ?? ""} onChange={(e) => setAnswers({ ...answers, [field.key]: e.target.value })}><option value="">Choose…</option>{field.options.map((o) => <option key={o}>{o}</option>)}</select> : <Input id={`offer-${field.key}`} type={field.type === "phone" ? "tel" : field.type} required={field.required} value={answers[field.key] ?? ""} onChange={(e) => setAnswers({ ...answers, [field.key]: e.target.value })} />}</div>)}
    {config.consent && <p className="text-xs text-muted-foreground">{config.consent}</p>}
    {error && <p className="text-sm text-destructive">{error}</p>}
    <Button type="submit" disabled={state === "saving"}>{state === "saving" ? "Saving…" : config.mode === "required" ? "Save and continue" : "Save details"}</Button>
  </form>;
}