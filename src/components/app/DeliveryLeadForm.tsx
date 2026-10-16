import { useState } from "react";
import type { PageExtras } from "@/lib/delivery-page";
import { useServerFn } from "@tanstack/react-start";
import { CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { submitOfferForm, submitPageForm } from "@/lib/revenue.functions";
import { validateLeadValue, type LeadField } from "@/lib/delivery-page";

export type LeadFormConfig = { mode: "none" | "optional" | "required"; consent?: string; fields?: LeadField[]; extras?: PageExtras };
export type LeadFormSource = { token?: string; slug?: string; preview?: boolean; config: LeadFormConfig };

/**
 * Lead form state. `run()` validates and saves; returns false only when the visitor must fix a field.
 * Network/save failures never block the visitor from continuing.
 */
export function useLeadForm(src: LeadFormSource | null | undefined) {
  const submitOffer = useServerFn(submitOfferForm);
  const submitPage = useServerFn(submitPageForm);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [state, setState] = useState<"idle" | "saving" | "done">("idle");
  const [note, setNote] = useState("");
  const fields = src && src.config.mode !== "none" ? src.config.fields ?? [] : [];
  const active = fields.length > 0;

  const run = async (): Promise<boolean> => {
    if (!active || !src || state === "done") return true;
    const errs: Record<string, string> = {};
    for (const f of fields) {
      const v = (answers[f.key] ?? "").trim();
      const p = validateLeadValue(f, v);
      if (p) errs[f.key] = p;
    }
    setErrors(errs);
    if (Object.keys(errs).length) { document.getElementById(`lead-${Object.keys(errs)[0]}`)?.focus(); return false; }
    const filled = Object.values(answers).some((v) => v.trim());
    if (!filled) return true;
    if (src.preview) { setNote("Preview only — the real page saves the details."); return false; }
    setState("saving");
    try {
      if (src.token) await submitOffer({ data: { token: src.token, answers } });
      else if (src.slug) await submitPage({ data: { slug: src.slug, answers } });
      setState("done");
    } catch { setState("idle"); }
    return true;
  };

  return { active, answers, setAnswers, errors, state, note, run, fields, consent: src?.config.consent };
}

/** Form fields only — the page's main button submits. With `standalone`, shows its own Submit button. */
export function LeadFields({ form, standalone }: { form: ReturnType<typeof useLeadForm>; standalone?: boolean }) {
  if (!form.active) return null;
  if (form.state === "done" && standalone) return <div className="rounded-lg border border-border bg-card p-5 text-center"><CheckCircle2 className="mx-auto size-7 text-success" /><p className="mt-2 font-medium">Details saved</p></div>;
  const { fields, answers, setAnswers, errors } = form;
  return <div id="lead-form" className="w-full space-y-4 rounded-xl border border-border bg-background p-4 text-left text-card-foreground shadow-sm">
    <div><h2 className="text-lg font-semibold">{fields.length === 1 ? "Where should we send it?" : "Fill in your details"}</h2><p className="mt-1 text-sm text-muted-foreground">Takes less than a minute.</p></div>
    {fields.map((field) => <div key={field.key} className="space-y-1.5">
      <Label htmlFor={`lead-${field.key}`}>{field.label}{field.required ? " *" : ""}</Label>
      {field.type === "choice"
        ? <select id={`lead-${field.key}`} className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={answers[field.key] ?? ""} onChange={(e) => setAnswers({ ...answers, [field.key]: e.target.value })}><option value="">Choose…</option>{field.options.map((o) => <option key={o}>{o}</option>)}</select>
        : <Input id={`lead-${field.key}`} type={field.type === "phone" ? "tel" : field.type === "email" ? "email" : "text"} inputMode={field.type === "pincode" || field.type === "phone" ? "numeric" : undefined}
            maxLength={field.type === "pincode" ? 6 : 200} value={answers[field.key] ?? ""} onChange={(e) => setAnswers({ ...answers, [field.key]: e.target.value })} />}
      {errors[field.key] && <p className="text-xs text-destructive">{errors[field.key]}</p>}
    </div>)}
    {form.consent && <p className="text-xs text-muted-foreground">{form.consent}</p>}
    {form.note && <p className="text-sm text-muted-foreground">{form.note}</p>}
    {standalone && <Button type="button" className="w-full" disabled={form.state === "saving"} onClick={() => void form.run()}>{form.state === "saving" ? "Saving…" : "Submit"}</Button>}
  </div>;
}
