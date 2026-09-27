import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { CheckCircle2, Mail } from "lucide-react";

import { LegalPage, SUPPORT_EMAIL } from "@/components/app/LegalPage";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { submitSupportInquiry, supportInquirySchema } from "@/lib/support.functions";

const title = "Contact & Support — AutoDM by Techaasvik";
const description = "Contact AutoDM by Techaasvik for product, billing, privacy, partnership, or technical support.";

export const Route = createFileRoute("/contact")({
  head: () => ({ meta: [
    { title }, { name: "description", content: description },
    { property: "og:title", content: title }, { property: "og:description", content: description },
    { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" },
  ], links: [{ rel: "canonical", href: "https://autodm.techaasvik.com/contact" }] }),
  component: ContactPage,
});

function ContactPage() {
  const submit = useServerFn(submitSupportInquiry);
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    const form = new FormData(event.currentTarget);
    const parsed = supportInquirySchema.safeParse(Object.fromEntries(form));
    if (!parsed.success) return setError(parsed.error.issues[0]?.message ?? "Check the form and try again.");
    setBusy(true);
    try {
      const result = await submit({ data: parsed.data });
      if (!result.ok) setError("Too many recent requests. Please wait an hour or email us directly.");
      else setSent(true);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not send your inquiry.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <LegalPage title="Contact & Support" updated="27 September 2026">
      <div className="flex items-start gap-3 rounded-lg border bg-surface-secondary p-4">
        <Mail className="mt-0.5 size-5 shrink-0 text-primary" />
        <p>For direct help, email <a className="font-medium text-primary" href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>. You can also submit the secure form below.</p>
      </div>
      {sent ? (
        <div className="rounded-lg border bg-success-soft p-5 text-foreground">
          <CheckCircle2 className="size-6 text-success" />
          <h2 className="mt-3">Inquiry received</h2>
          <p className="mt-1 text-muted-foreground">Our team can now see it in the support inbox and will reply by email.</p>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4 rounded-lg border bg-surface p-5 text-foreground">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Name"><Input name="name" maxLength={100} required autoComplete="name" /></Field>
            <Field label="Email"><Input name="email" type="email" maxLength={200} required autoComplete="email" /></Field>
          </div>
          <Field label="Category">
            <select name="category" className="h-10 w-full rounded-md border bg-background px-3 text-sm" defaultValue="general">
              <option value="general">General</option><option value="technical">Technical support</option>
              <option value="billing">Billing</option><option value="privacy">Privacy or data</option>
              <option value="partnership">Partnership</option>
            </select>
          </Field>
          <Field label="Subject"><Input name="subject" minLength={3} maxLength={160} required /></Field>
          <Field label="How can we help?"><Textarea name="message" minLength={10} maxLength={4000} rows={7} required /></Field>
          {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}
          <Button type="submit" disabled={busy}>{busy ? "Sending…" : "Send inquiry"}</Button>
        </form>
      )}
    </LegalPage>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="space-y-1.5"><Label>{label}</Label>{children}</div>;
}