import { CheckCircle2, Clock3, ShieldCheck } from "lucide-react";
import { Fragment, useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { inlineParts, parseBody, type Block } from "@/lib/delivery-page";

function Inline({ text }: { text: string }) {
  return <>{inlineParts(text).map((p, i) => p.bold ? <strong key={i} className="font-semibold text-foreground">{p.text}</strong> : <Fragment key={i}>{p.text}</Fragment>)}</>;
}

/** Landing-page style rendering of a delivery page (used publicly and as a live preview). */
export function DeliveryPageView({ title, body, buttonLabel, buttonHref, imageUrl, imageAlt, countdownAt, expiryAction = "disable_cta", expiryMessage }: {
  title: string; body: string; buttonLabel?: string | null; buttonHref?: string | null; imageUrl?: string | null; imageAlt?: string | null;
  countdownAt?: string | null; expiryAction?: "disable_cta" | "hide_cta"; expiryMessage?: string | null;
}) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!countdownAt) return;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [countdownAt]);
  const remaining = countdownAt ? Math.max(0, new Date(countdownAt).getTime() - now) : 0;
  const expired = Boolean(countdownAt) && remaining === 0;
  const countdown = remaining ? [Math.floor(remaining / 86400000), Math.floor(remaining / 3600000) % 24, Math.floor(remaining / 60000) % 60, Math.floor(remaining / 1000) % 60] : [];
  const blocks = parseBody(body);
  const hasH1 = blocks[0]?.t === "h1";
  const heading = hasH1 ? (blocks[0] as { text: string }).text : title;
  const rest = hasH1 ? blocks.slice(1) : blocks;
  const intro = rest[0]?.t === "p" ? (rest[0] as { text: string }).text : null;
  const content = intro ? rest.slice(1) : rest;
  const faqs = content.filter((b): b is Extract<Block, { t: "faq" }> => b.t === "faq");
  const cta = buttonHref && !(expired && expiryAction === "hide_cta") ? (
    <Button asChild size="lg" className="h-12 w-full rounded-xl text-base shadow-lg sm:w-auto sm:px-10">
      <a href={expired ? undefined : buttonHref} aria-disabled={expired} onClick={expired ? (e) => e.preventDefault() : undefined} rel="nofollow">{expired ? (expiryMessage || "Offer ended") : (buttonLabel || "Open")}</a>
    </Button>
  ) : null;

  return (
    <div className="min-h-full bg-background">
      <section className="relative overflow-hidden border-b border-border bg-gradient-to-b from-primary/15 via-primary/5 to-background px-6 pb-14 pt-16 text-center">
        <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/30 bg-background/70 px-3 py-1 text-xs font-medium text-primary">
          <CheckCircle2 className="size-3.5" /> Ready for you
        </span>
        <h1 className="mx-auto mt-5 max-w-2xl text-balance text-3xl font-bold tracking-tight text-foreground sm:text-5xl"><Inline text={heading} /></h1>
        {intro && <p className="mx-auto mt-4 max-w-xl text-pretty text-base text-muted-foreground sm:text-lg"><Inline text={intro} /></p>}
        {imageUrl && <div className="mx-auto mt-7 aspect-[4/3] w-full max-w-xl overflow-hidden rounded-xl border border-border bg-muted"><img src={imageUrl} alt={imageAlt || title} className="size-full object-cover" /></div>}
        {countdownAt && !expired && <div className="mx-auto mt-6 max-w-md rounded-lg border border-border bg-card p-3 text-card-foreground"><p className="mb-2 flex items-center justify-center gap-2 text-sm font-medium"><Clock3 className="size-4 text-primary" /> Offer ends in</p><div className="grid grid-cols-4 gap-2">{countdown.map((n, i) => <div key={i} className="rounded-md bg-muted px-2 py-2"><strong className="block text-lg">{String(n).padStart(2, "0")}</strong><span className="text-[10px] text-muted-foreground">{["Days", "Hours", "Mins", "Secs"][i]}</span></div>)}</div></div>}
        {expired && <p className="mx-auto mt-6 max-w-md rounded-lg border border-border bg-muted p-3 text-sm text-muted-foreground">{expiryMessage || "This offer has ended."}</p>}
        {cta && <div className="mt-8">{cta}</div>}
      </section>

      <article className="mx-auto max-w-2xl space-y-5 px-6 py-12">
        {content.map((b, i) => {
          if (b.t === "faq") return null;
          if (b.t === "h1" || b.t === "h2") return <h2 key={i} className="pt-4 text-2xl font-semibold tracking-tight text-foreground"><Inline text={b.text} /></h2>;
          if (b.t === "h3") return <h3 key={i} className="pt-2 text-lg font-semibold text-foreground"><Inline text={b.text} /></h3>;
          if (b.t === "quote") return <blockquote key={i} className="rounded-xl border-l-4 border-primary bg-primary/5 px-5 py-4 text-foreground"><Inline text={b.text} /></blockquote>;
          if (b.t === "list") return (
            <ul key={i} className="grid gap-3">
              {b.items.map((it, j) => (
                <li key={j} className="flex items-start gap-3 rounded-xl border border-border bg-card p-4 text-card-foreground shadow-sm">
                  <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-primary" /><span><Inline text={it} /></span>
                </li>
              ))}
            </ul>
          );
          return <p key={i} className="leading-relaxed text-muted-foreground"><Inline text={b.text} /></p>;
        })}

        {faqs.length > 0 && (
          <div className="space-y-3 pt-4">
            <h2 className="text-2xl font-semibold tracking-tight text-foreground">Frequently asked questions</h2>
            {faqs.map((f, i) => (
              <details key={i} className="group rounded-xl border border-border bg-card p-4 text-card-foreground">
                <summary className="cursor-pointer list-none font-medium">{f.q}</summary>
                {f.a && <p className="mt-2 text-sm text-muted-foreground">{f.a}</p>}
              </details>
            ))}
          </div>
        )}

        {cta && (
          <div className="mt-6 rounded-2xl border border-border bg-card p-8 text-center shadow-sm">
            <p className="mb-4 text-lg font-semibold text-foreground">{heading}</p>
            {cta}
          </div>
        )}
        <p className="flex items-center justify-center gap-1.5 pt-6 text-xs text-muted-foreground"><ShieldCheck className="size-3.5" /> Secure delivery</p>
      </article>
    </div>
  );
}
