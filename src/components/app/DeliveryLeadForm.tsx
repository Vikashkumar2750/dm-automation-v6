import { useState } from "react";
import type { PageExtras } from "@/lib/delivery-page";
import { useServerFn } from "@tanstack/react-start";
import { CheckCircle2, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { captureLeadProgress, sendLeadOtp, submitOfferForm, submitPageForm, verifyLeadOtpCode } from "@/lib/revenue.functions";
import { validateLeadValue, type LeadField } from "@/lib/delivery-page";

export type LeadFormConfig = { mode: "none" | "optional" | "required"; consent?: string; fields?: LeadField[]; extras?: PageExtras; otpRequired?: boolean };
export type LeadFormSource = { token?: string; slug?: string; preview?: boolean; config: LeadFormConfig };

type OtpState = { id: string | null; verified: boolean; busy: boolean; error: string; code: string };

/**
 * Lead form state. `run()` validates and saves; returns false only when the visitor must fix a field.
 * Network/save failures never block the visitor from continuing.
 */
export function useLeadForm(src: LeadFormSource | null | undefined) {
  const submitOffer = useServerFn(submitOfferForm);
  const submitPage = useServerFn(submitPageForm);
  const sendOtpFn = useServerFn(sendLeadOtp);
  const verifyOtpFn = useServerFn(verifyLeadOtpCode);
  const captureFn = useServerFn(captureLeadProgress);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [state, setState] = useState<"idle" | "saving" | "done">("idle");
  const [note, setNote] = useState("");
  const [otp, setOtp] = useState<OtpState>({ id: null, verified: false, busy: false, error: "", code: "" });
  const fields = src && src.config.mode !== "none" ? src.config.fields ?? [] : [];
  const active = fields.length > 0;
  const phoneField = fields.find((f) => f.type === "phone");
  const otpNeeded = !!src?.config.otpRequired && !!phoneField && !src.preview;

  /** Silent background save of email/phone so drop-offs are still captured. Never shows errors. */
  const capture = (stage: "intent_started" | "otp_pending", extra?: Record<string, string>) => {
    if (!src || src.preview || state === "done") return;
    void captureFn({ data: { ...(src.slug ? { slug: src.slug } : { token: src.token! }), answers: { ...answers, ...extra }, stage } }).catch(() => {});
  };

  const sendOtp = async () => {
    if (!src || !phoneField) return;
    const phone = (answers[phoneField.key] ?? "").trim();
    const problem = validateLeadValue(phoneField, phone);
    if (problem) { setErrors({ ...errors, [phoneField.key]: problem }); return; }
    setOtp({ ...otp, busy: true, error: "" });
    try {
      const r = await sendOtpFn({ data: { ...(src.slug ? { slug: src.slug } : { token: src.token! }), phone } });
      setOtp({ id: r.verificationId, verified: false, busy: false, error: "", code: "" });
      setNote("Code sent on WhatsApp — check your messages.");
      capture("otp_pending");
    } catch (e) {
      setOtp({ ...otp, busy: false, error: e instanceof Error ? e.message : "Could not send the code" });
    }
  };

  const verifyOtp = async () => {
    if (!otp.id) return;
    setOtp({ ...otp, busy: true, error: "" });
    try {
      await verifyOtpFn({ data: { verificationId: otp.id, code: otp.code } });
      setOtp({ ...otp, verified: true, busy: false, error: "" });
      setNote("Phone number verified ✓");
    } catch (e) {
      setOtp({ ...otp, busy: false, error: e instanceof Error ? e.message : "Wrong code" });
    }
  };

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
    if (!filled) { setNote("Please fill in your details to continue."); return false; }
    if (src.preview) { setNote("Preview only — the real page saves the details."); return false; }
    if (otpNeeded && !otp.verified) { setNote("Please verify your phone number with the WhatsApp code first."); return false; }
    setState("saving");
    try {
      if (src.token) await submitOffer({ data: { token: src.token, answers } });
      else if (src.slug) await submitPage({ data: { slug: src.slug, answers } });
      setState("done");
    } catch (e) {
      setState("idle");
      const msg = e instanceof Error ? e.message : "";
      if (/email|phone|pincode|valid|verif/i.test(msg)) { setNote(msg); return false; }
    }
    return true;
  };

  return { active, answers, setAnswers, errors, state, note, run, capture, fields, consent: src?.config.consent, otpNeeded, otp, setOtp, sendOtp, verifyOtp, phoneKey: phoneField?.key };
}

/** Form fields only — the page's main button submits. With `standalone`, shows its own Submit button. */
export function LeadFields({ form, standalone, className = "" }: { form: ReturnType<typeof useLeadForm>; standalone?: boolean; className?: string }) {
  if (!form.active) return null;
  if (form.state === "done" && standalone) return <div className="rounded-lg border border-border bg-card p-5 text-center"><CheckCircle2 className="mx-auto size-7 text-success" /><p className="mt-2 font-medium">Details saved</p></div>;
  const { fields, answers, setAnswers, errors } = form;
  return <div className={`lead-form w-full ${className} space-y-4 rounded-xl border border-border bg-card p-4 text-left text-card-foreground shadow-sm`}>
    <div><h2 className="text-lg font-semibold">{fields.length === 1 ? "Where should we send it?" : "Fill in your details"}</h2><p className="mt-1 text-sm text-muted-foreground">Takes less than a minute.</p></div>
    {fields.map((field) => <div key={field.key} className="space-y-1.5">
      <Label htmlFor={`lead-${field.key}`}>{field.label}{field.required ? " *" : ""}</Label>
      {field.type === "choice"
        ? <select id={`lead-${field.key}`} className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={answers[field.key] ?? ""} onChange={(e) => setAnswers({ ...answers, [field.key]: e.target.value })}><option value="">Choose…</option>{field.options.map((o) => <option key={o}>{o}</option>)}</select>
        : <Input id={`lead-${field.key}`} type={field.type === "phone" ? "tel" : field.type === "email" ? "email" : "text"} inputMode={field.type === "pincode" || field.type === "phone" ? "numeric" : undefined}
            maxLength={field.type === "pincode" ? 6 : 200} value={answers[field.key] ?? ""} onChange={(e) => setAnswers({ ...answers, [field.key]: e.target.value })}
            onBlur={field.type === "email" || field.type === "phone" ? () => form.capture("intent_started") : undefined} />}
      {errors[field.key] && <p className="text-xs text-destructive">{errors[field.key]}</p>}
      {form.otpNeeded && field.key === form.phoneKey && !form.otp.verified && (
        <div className="space-y-2 rounded-lg border border-primary/30 bg-primary/5 p-3">
          {!form.otp.id ? (
            <Button type="button" size="sm" variant="outline" className="w-full" disabled={form.otp.busy} onClick={() => void form.sendOtp()}>
              <ShieldCheck className="size-4" /> {form.otp.busy ? "Sending…" : "Verify this number on WhatsApp"}
            </Button>
          ) : (
            <div className="flex gap-2">
              <Input inputMode="numeric" maxLength={6} placeholder="6-digit code" value={form.otp.code}
                onChange={(e) => form.setOtp({ ...form.otp, code: e.target.value.replace(/\D/g, "").slice(0, 6) })} />
              <Button type="button" size="sm" disabled={form.otp.busy || form.otp.code.length !== 6} onClick={() => void form.verifyOtp()}>
                {form.otp.busy ? "Checking…" : "Verify"}
              </Button>
            </div>
          )}
          {form.otp.id && !form.otp.verified && <button type="button" className="text-xs text-primary underline" onClick={() => void form.sendOtp()}>Resend code</button>}
          {form.otp.error && <p className="text-xs text-destructive">{form.otp.error}</p>}
        </div>
      )}
      {form.otpNeeded && field.key === form.phoneKey && form.otp.verified && (
        <p className="flex items-center gap-1.5 text-xs font-medium text-success"><CheckCircle2 className="size-3.5" /> Phone number verified on WhatsApp</p>
      )}
    </div>)}
    {form.consent && <p className="text-xs text-muted-foreground">{form.consent}</p>}
    {form.note && <p className="text-sm text-muted-foreground">{form.note}</p>}
    {standalone && <Button type="button" className="w-full" disabled={form.state === "saving"} onClick={() => void form.run()}>{form.state === "saving" ? "Saving…" : "Submit"}</Button>}
  </div>;
}
