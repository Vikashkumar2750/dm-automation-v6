import { ImageIcon, CheckCircle2, Clock3, Copy, Mail, Package, ShieldCheck, Tag } from "lucide-react";
import { Fragment, useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { DisclaimerContent } from "@/components/app/DisclaimerContent";
import { BuyerSignIn, BuyerSignInButton } from "@/components/app/BuyerSignIn";
import { LeadFields, useLeadForm, type LeadFormSource } from "@/components/app/DeliveryLeadForm";
import { inlineParts, parseBody, priceDisplay, type Block } from "@/lib/delivery-page";

export type PagePrice = { originalPaise: number | null; offerPaise: number | null; label?: string | null; couponCode?: string | null; couponNote?: string | null };

function PriceBox({ price }: { price: PagePrice }) {
  const [copied, setCopied] = useState(false);
  const d = priceDisplay(price.originalPaise, price.offerPaise, price.label);
  if (!d.offer && !price.couponCode) return null;
  return (
    <div className="rounded-xl border border-primary/30 bg-background p-4">
      {d.offer && <div className="flex flex-wrap items-baseline justify-center gap-3">
        <span className="text-4xl font-bold tracking-tight text-foreground">{d.offer}</span>
        {d.original && <span className="text-lg text-muted-foreground line-through">{d.original}</span>}
        {d.badge && <span className="rounded-full bg-primary px-2.5 py-0.5 text-xs font-semibold text-primary-foreground">{d.badge}</span>}
      </div>}
      {price.couponCode && <div className="mt-4 rounded-xl border border-dashed border-primary/50 bg-primary/5 p-3">
        <p className="flex items-center justify-center gap-1.5 text-xs font-medium text-muted-foreground"><Tag className="size-3.5 text-primary" /> Use coupon code</p>
        <div className="mt-1.5 flex items-center justify-center gap-2">
          <code className="rounded-md bg-background px-3 py-1 text-lg font-bold tracking-widest text-foreground">{price.couponCode}</code>
          <Button type="button" size="sm" variant="outline" onClick={() => { void navigator.clipboard?.writeText(price.couponCode!); setCopied(true); window.setTimeout(() => setCopied(false), 1500); }}><Copy className="size-3.5" /> {copied ? "Copied" : "Copy"}</Button>
        </div>
        {price.couponNote && <p className="mt-1.5 text-center text-xs text-muted-foreground">{price.couponNote}</p>}
      </div>}
    </div>
  );
}

function TrustLines() {
  return (
    <ul className="grid gap-1.5 border-t border-border pt-3 text-xs text-muted-foreground">
      <li className="flex items-center gap-2"><ShieldCheck className="size-3.5 text-primary" /> Secure checkout & delivery</li>
      <li className="flex items-center gap-2"><CheckCircle2 className="size-3.5 text-primary" /> Instant access after you continue</li>
      <li className="flex items-center gap-2"><Clock3 className="size-3.5 text-primary" /> Access again anytime with your email</li>
    </ul>
  );
}

function Inline({ text }: { text: string }) {
  return <>{inlineParts(text).map((p, i) => p.bold ? <strong key={i} className="font-semibold text-foreground">{p.text}</strong> : <Fragment key={i}>{p.text}</Fragment>)}</>;
}

/** Landing-page style rendering of a delivery page (used publicly and as a live preview). */
export function DeliveryPageView({ title, body, buttonLabel, buttonHref, imageUrl, imageAlt, countdownAt, expiryAction = "disable_cta", expiryMessage, price, leadForm, buyerSlug, imagePlaceholder }: {
  title: string; body: string; buttonLabel?: string | null; buttonHref?: string | null; imageUrl?: string | null; imageAlt?: string | null;
  countdownAt?: string | null; expiryAction?: "disable_cta" | "hide_cta"; expiryMessage?: string | null; price?: PagePrice | null; leadForm?: LeadFormSource | null; buyerSlug?: string | null; imagePlaceholder?: boolean;
}) {
  const [signIn, setSignIn] = useState(false);
  const form = useLeadForm(leadForm);
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
  const extras = leadForm?.config?.extras ?? {};
  const del = extras.deliverables ?? {};
  const delItems = [del.count, del.format, del.size].filter(Boolean) as string[];
  const policyItems = ([["refund", "Refund policy"], ["fulfilment", "Fulfilment policy"], ["privacy", "Privacy policy"], ["terms", "Terms & conditions"]] as const)
    .map(([k, label]) => ({ label, text: extras.policies?.[k] })).filter((x) => x.text);
  const faqs = content.filter((b): b is Extract<Block, { t: "faq" }> => b.t === "faq");
  const onCta = async (e: React.MouseEvent<HTMLAnchorElement>) => {
    e.preventDefault();
    if (expired || !buttonHref) return;
    if (form.active && !(await form.run())) { Array.from(document.querySelectorAll<HTMLElement>(".lead-form")).find((el) => el.offsetParent)?.scrollIntoView({ behavior: "smooth", block: "center" }); return; }
    if (buttonHref !== "#") window.location.href = buttonHref;
  };
  const cta = buttonHref && !(expired && expiryAction === "hide_cta") ? (
    <Button asChild size="lg" className="h-12 w-full rounded-xl text-base shadow-lg @xl:w-auto @xl:px-10">
      <a href={expired ? undefined : buttonHref} aria-disabled={expired || form.state === "saving"} onClick={onCta} rel="nofollow">{expired ? (expiryMessage || "Offer ended") : form.state === "saving" ? "Please wait…" : (buttonLabel || "Open")}</a>
    </Button>
  ) : null;

  const d = price ? priceDisplay(price.originalPaise, price.offerPaise, price.label) : null;
  const toCheckout = () => { const lf = form.active && form.state !== "done" ? Array.from(document.querySelectorAll<HTMLElement>(".lead-form")).find((el) => el.offsetParent) : null; (lf ?? document.getElementById("checkout"))?.scrollIntoView({ behavior: "smooth", block: "center" }); };
  return (
    <div className="@container min-h-full bg-background">
    <div className="relative">
      <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-72 bg-gradient-to-b from-primary/15 via-primary/5 to-transparent" />
      {buyerSlug && <>
        <header className="sticky top-0 z-20 border-b border-border bg-background/90 backdrop-blur"><div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-2.5 @xl:px-6"><span className="truncate text-sm font-semibold text-foreground">{heading.replace(/\*\*/g, "")}</span><BuyerSignInButton onClick={() => setSignIn(true)} /></div></header>
        <BuyerSignIn slug={buyerSlug} open={signIn} onOpenChange={setSignIn} creatorName={extras.creatorName} />
      </>}
      <div className="relative mx-auto grid max-w-6xl gap-8 px-4 py-8 @xl:px-6 @3xl:grid-cols-[minmax(0,1fr)_380px] @3xl:py-12">
        <article className="min-w-0 space-y-5">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/5 px-3 py-1 text-xs font-medium text-primary"><CheckCircle2 className="size-3.5" /> Ready for you</span>
          <h1 className="text-balance text-2xl font-bold tracking-tight text-foreground @xl:text-4xl"><Inline text={heading} /></h1>
          {!imageUrl && imagePlaceholder && <div className="flex aspect-video w-full flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-border bg-gradient-to-br from-primary/15 via-muted to-primary/5 text-muted-foreground"><ImageIcon className="size-8" /><span className="text-xs">Your 16:9 banner image (1920×1080)</span></div>}
          {imageUrl && <div className="aspect-video w-full overflow-hidden rounded-xl border border-border bg-muted"><img src={imageUrl} alt={imageAlt || title} className="size-full object-cover" /></div>}
          {intro && <p className="text-pretty text-base text-muted-foreground"><Inline text={intro} /></p>}
          {content.map((b, i) => {
            if (b.t === "faq") return null;
            // The FAQ section renders its own heading below; hide duplicate headings from the body.
            if ((b.t === "h1" || b.t === "h2" || b.t === "h3") && /frequently\s*asked|^faq\b/i.test(b.text.trim())) return null;
            if (b.t === "h1" || b.t === "h2") return <h2 key={i} className="pt-3 text-xl font-semibold tracking-tight text-foreground"><Inline text={b.text} /></h2>;
            if (b.t === "h3") return <h3 key={i} className="pt-2 text-lg font-semibold text-foreground"><Inline text={b.text} /></h3>;
            if (b.t === "quote") return <blockquote key={i} className="rounded-xl border-l-4 border-primary bg-primary/5 px-5 py-4 text-foreground"><Inline text={b.text} /></blockquote>;
            if (b.t === "list") return (
              <ul key={i} className="grid gap-2">
                {b.items.map((it, j) => <li key={j} className="flex items-start gap-3 text-muted-foreground"><CheckCircle2 className="mt-0.5 size-4 shrink-0 text-primary" /><span><Inline text={it} /></span></li>)}
              </ul>
            );
            return <p key={i} className="leading-relaxed text-muted-foreground"><Inline text={b.text} /></p>;
          })}
          {form.active && (
            <div className="space-y-3 @3xl:hidden">
              <LeadFields form={form} standalone={!cta} />
              {cta && <div className="rounded-2xl border border-primary/20 bg-card p-4 text-card-foreground shadow-sm"><div className="[&_a]:w-full">{cta}</div><div className="mt-3"><TrustLines /></div></div>}
            </div>
          )}
          {faqs.length > 0 && (
            <div className="space-y-3 pt-4">
              <h2 className="text-xl font-semibold tracking-tight text-foreground">Frequently asked questions</h2>
              {faqs.map((f, i) => (
                <details key={i} className="rounded-xl border border-border bg-card p-4 text-card-foreground">
                  <summary className="cursor-pointer list-none font-medium">{f.q}</summary>
                  {f.a && <p className="mt-2 text-sm text-muted-foreground">{f.a}</p>}
                </details>
              ))}
            </div>
          )}
          {delItems.length > 0 && (
            <div className="rounded-xl border border-border bg-card p-4 text-card-foreground">
              <p className="mb-3 flex items-center gap-2 font-semibold"><Package className="size-4 text-primary" /> What you'll get</p>
              <div className="flex flex-wrap gap-2">{delItems.map((x, i) => <span key={i} className="rounded-full bg-muted px-3 py-1 text-sm text-muted-foreground">{x}</span>)}</div>
            </div>
          )}
          {(extras.creatorName || extras.supportEmail) && (
            <div className="rounded-xl border border-border bg-card p-4 text-card-foreground">
              <p className="font-semibold">Contact {extras.creatorName || "the creator"}</p>
              {extras.supportEmail && <a href={`mailto:${extras.supportEmail}`} className="mt-1 inline-flex items-center gap-2 text-sm text-primary"><Mail className="size-4" /> {extras.supportEmail}</a>}
            </div>
          )}
          {policyItems.length > 0 && (
            <div className="space-y-2">
              {policyItems.map((p) => (
                <details key={p.label} className="rounded-xl border border-border bg-card p-4 text-card-foreground">
                  <summary className="cursor-pointer list-none font-medium">{p.label}</summary>
                  <p className="mt-2 whitespace-pre-line text-sm text-muted-foreground">{p.text}</p>
                </details>
              ))}
            </div>
          )}
          {extras.disclaimer && <div className="whitespace-pre-line border-t border-border pt-4 text-xs text-muted-foreground">
            <span className="font-semibold text-foreground">Disclaimer</span><br />
            {extras.disclaimer.replace(/\s*Learn more\.?\s*$/i, "")} {" "}
            <Dialog>
              <DialogTrigger asChild><Button type="button" variant="link" className="h-auto p-0 text-xs text-muted-foreground underline">Learn more</Button></DialogTrigger>.
              <DialogContent className="max-w-2xl">
                <DialogHeader className="pr-6">
                  <DialogTitle>Disclaimer</DialogTitle>
                  <DialogDescription>Important limitations and third-party platform information for AutoDM by Techaasvik.</DialogDescription>
                </DialogHeader>
                <div className="space-y-4 whitespace-normal text-sm leading-relaxed text-muted-foreground [&_h2]:text-base [&_h2]:font-semibold [&_h2]:text-foreground">
                  <DisclaimerContent />
                </div>
              </DialogContent>
            </Dialog>
          </div>}
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border-l-4 border-primary bg-muted px-4 py-3 text-sm text-muted-foreground"><span>Already got access? {buyerSlug ? "Sign in with your email to open it again." : "Your link was sent in your DM."}</span>{buyerSlug && <Button size="sm" variant="outline" onClick={() => setSignIn(true)}>Access your purchase</Button>}</div>
          <p className="flex items-center gap-1.5 pt-2 text-xs text-muted-foreground"><ShieldCheck className="size-3.5" /> Secure delivery</p>
        </article>

        <aside id="checkout" className="@3xl:sticky @3xl:top-6 @3xl:self-start">
          <div className="space-y-4 rounded-2xl border border-primary/20 bg-card p-5 ring-1 ring-primary/5 text-card-foreground shadow-sm">
            {countdownAt && !expired && <div><p className="mb-2 flex items-center justify-center gap-2 text-sm font-medium"><Clock3 className="size-4 text-primary" /> Offer ends in</p><div className="grid grid-cols-4 gap-2">{countdown.map((n, i) => <div key={i} className="rounded-md bg-muted px-2 py-2 text-center"><strong className="block text-lg">{String(n).padStart(2, "0")}</strong><span className="text-[10px] text-muted-foreground">{["Days", "Hours", "Mins", "Secs"][i]}</span></div>)}</div></div>}
            {expired && <p className="rounded-lg bg-muted p-3 text-sm text-muted-foreground">{expiryMessage || "This offer has ended."}</p>}
            {price && <PriceBox price={price} />}
            <LeadFields form={form} standalone={!cta} className="hidden @3xl:block" />
            {cta && <div className="[&_a]:w-full">{cta}</div>}
            <TrustLines />
          </div>
        </aside>
      </div>

      {cta && (
        <div className="sticky bottom-0 z-30 flex items-center justify-between gap-3 border-t border-border bg-background/95 px-4 py-3 backdrop-blur @3xl:hidden">
          <div className="min-w-0">
            {d?.offer ? <p className="flex items-baseline gap-2"><span className="text-lg font-bold text-foreground">{d.offer}</span>{d.original && <span className="text-xs text-muted-foreground line-through">{d.original}</span>}</p> : <p className="truncate text-sm font-medium text-foreground">{heading}</p>}
          </div>
          <Button size="lg" className="rounded-xl" onClick={toCheckout}>{expired ? (expiryMessage || "Offer ended") : (buttonLabel || "Open")}</Button>
        </div>
      )}
    </div>
    </div>
  );
}
