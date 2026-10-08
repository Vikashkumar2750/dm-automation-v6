import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { submitOfferForm, submitPageForm } from "@/lib/revenue.functions";
import type { LeadField } from "@/lib/delivery-page";

type Config = { mode: "none" | "optional" | "required"; consent?: string; fields?: LeadField[] };

/** Lead form on a delivery page. Pass `token` (buyer offer link), `slug` (public page) or `preview`. */
export function DeliveryLeadForm({ token, slug, preview, config }: { token?: string; slug?: string; preview?: boolean; config: Config }) {
  const submitOffer = useServerFn(submitOfferForm);
  const submitPage = useServerFn(submitPageForm);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [state, setState] = useState<"idle" | "saving" | "done">("idle");
  const [error, setError] = useState("");
  const fields = config.fields ?? [];
  if (config.mode === "none" || fields.length === 0) return null;
  if (state === "done") return <div className="rounded-lg border border-border bg-card p-5 text-center"><CheckCircle2 className="mx-auto size-7 text-success" /><p className="mt-2 font-medium">Details saved</p><p className="text-sm text-muted-foreground">You can continue with the offer.</p></div>;
  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (preview) { setError("Preview only — the real page saves the details."); return; }
    setState("saving"); setError("");
    try {
      if (token) await submitOffer({ data: { token, answers } });
      else if (slug) await submitPage({ data: { slug, answers } });
      setState("done");
    } catch (err) { setState("idle"); setError(err instanceof Error ? err.message : "Could not save details"); }
  };
  return <form className="space-y-4 rounded-lg border border-border bg-card p-5 text-card-foreground" onSubmit={onSubmit}>
    <div><h2 className="text-xl font-semibold">{fields.length === 1 ? "Where should we send it?" : "Fill in your details"}</h2><p className="mt-1 text-sm text-muted-foreground">Takes less than a minute.</p></div>
    {fields.map((field) => <div key={field.key} className="space-y-1.5">
      <Label htmlFor={`lead-${field.key}`}>{field.label}{field.required ? " *" : ""}</Label>
      {field.type === "choice"
        ? <select id={`lead-${field.key}`} required={field.required} className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={answers[field.key] ?? ""} onChange={(e) => setAnswers({ ...answers, [field.key]: e.target.value })}><option value="">Choose…</option>{field.options.map((o) => <option key={o}>{o}</option>)}</select>
        : <Input id={`lead-${field.key}`} type={field.type === "phone" ? "tel" : field.type === "email" ? "email" : "text"} inputMode={field.type === "pincode" || field.type === "phone" ? "numeric" : undefined}
            maxLength={field.type === "pincode" ? 6 : 200} required={field.required} value={answers[field.key] ?? ""} onChange={(e) => setAnswers({ ...answers, [field.key]: e.target.value })} />}
    </div>)}
    {config.consent && <p className="text-xs text-muted-foreground">{config.consent}</p>}
    {error && <p className="text-sm text-destructive">{error}</p>}
    <Button type="submit" className="w-full sm:w-auto" disabled={state === "saving"}>{state === "saving" ? "Saving…" : config.mode === "required" ? "Save and continue" : "Save details"}</Button>
  </form>;
}
