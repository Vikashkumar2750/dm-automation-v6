import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { ArrowRight, LogIn, LogOut, Mail, Package, Receipt, ShoppingBag } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { formatInr } from "@/lib/revenue";
import { getBuyerContent, getBuyerLibrary, requestBuyerCode, signOutBuyer, verifyBuyerCode } from "@/lib/buyer-access.functions";

type Library = { email: string; items: { title: string; slug: string; at: string; hasFile: boolean; imageUrl: string | null }[] };
const key = (slug: string) => `autodm:buyer:${slug}`;

/** Buyer sign-in: store card → email → 6-digit code → purchases portal (Purchases / Transactions). */
export function BuyerSignIn({ slug, open, onOpenChange, creatorName }: { slug: string; open: boolean; onOpenChange: (v: boolean) => void; creatorName?: string | undefined }) {
  const contentFn = useServerFn(getBuyerContent);
  const [step, setStep] = useState<"intro" | "email" | "code" | "library">("intro");
  const [tab, setTab] = useState<"purchases" | "transactions">("purchases");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [lib, setLib] = useState<Library | null>(null);
  const store = creatorName?.trim() ? `${creatorName.trim()}'s Store` : "the Store";
  const initial = (creatorName?.trim()[0] ?? "S").toUpperCase();

  useEffect(() => {
    if (!open) return;
    const token = localStorage.getItem(key(slug));
    if (!token) return;
    void getBuyerLibrary({ data: { token } }).then((l) => { if (l) { setLib(l); setStep("library"); } else localStorage.removeItem(key(slug)); });
  }, [open, slug]);

  const run = async (fn: () => Promise<void>) => { setBusy(true); try { await fn(); } catch (e) { toast.error(e instanceof Error ? e.message : "Something went wrong"); } finally { setBusy(false); } };
  const sendCode = () => run(async () => { await requestBuyerCode({ data: { slug, email } }); setStep("code"); toast.success("If this email has a purchase, a code is on its way."); });
  const verify = () => run(async () => {
    const { token } = await verifyBuyerCode({ data: { slug, email, code } });
    localStorage.setItem(key(slug), token);
    const l = await getBuyerLibrary({ data: { token } });
    setLib(l); setStep("library");
  });
  const openContent = (itemSlug: string) => run(async () => {
    const token = localStorage.getItem(key(slug));
    if (!token) throw new Error("Please sign in again");
    const result = await contentFn({ data: { token, slug: itemSlug } });
    window.location.assign(result.url);
  });
  const signOut = () => run(async () => {
    const token = localStorage.getItem(key(slug));
    if (token) await signOutBuyer({ data: { token } });
    localStorage.removeItem(key(slug)); setLib(null); setCode(""); setStep("intro");
  });

  const avatar = <div className="grid size-14 place-items-center rounded-full bg-primary text-xl font-bold text-primary-foreground shadow-lg ring-4 ring-background">{initial}</div>;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={step === "library" ? "max-w-2xl overflow-hidden p-0" : "max-w-md overflow-hidden p-0"}>
        {step === "intro" && (
          <div>
            <div className="h-24 bg-gradient-to-br from-primary/30 via-primary/10 to-accent" />
            <div className="-mt-7 space-y-3 px-6 pb-6">
              {avatar}
              <DialogHeader className="text-left">
                <DialogTitle>Sign in to {store}</DialogTitle>
                <DialogDescription>Access all your previous purchases, manage your account details, and more.</DialogDescription>
              </DialogHeader>
              <Button className="h-11 w-full" onClick={() => setStep("email")}><LogIn className="size-4" /> Sign in</Button>
            </div>
          </div>
        )}
        {(step === "email" || step === "code") && (
          <div className="space-y-4 bg-gradient-to-b from-primary/10 to-background p-6">
            <div className="flex justify-center">{avatar}</div>
            <DialogHeader className="text-center sm:text-center">
              <DialogTitle>{step === "email" ? "Welcome" : "Check your email"}</DialogTitle>
              <DialogDescription>{step === "email" ? "Sign in to access your purchased content" : `Enter the 6-digit code we sent to ${email}.`}</DialogDescription>
            </DialogHeader>
            {step === "email" ? (
              <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); void sendCode(); }}>
                <Input type="email" required placeholder="Enter your email" value={email} onChange={(e) => setEmail(e.target.value)} className="h-11" />
                <Button type="submit" className="h-11 w-full" disabled={busy}><Mail className="size-4" /> {busy ? "Sending…" : "Continue with Email"}</Button>
                <p className="text-center text-xs text-muted-foreground">Use the email you entered when you bought or registered.</p>
              </form>
            ) : (
              <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); void verify(); }}>
                <Input inputMode="numeric" maxLength={6} placeholder="123456" value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))} className="h-11 text-center text-lg tracking-[0.4em]" />
                <Button type="submit" className="h-11 w-full" disabled={busy || code.length !== 6}>{busy ? "Checking…" : "Sign in"} <ArrowRight className="size-4" /></Button>
                <button type="button" className="w-full text-xs text-muted-foreground underline" onClick={() => setStep("email")}>Use a different email</button>
              </form>
            )}
          </div>
        )}
        {step === "library" && lib && (
          <div className="grid min-h-[420px] sm:grid-cols-[180px_1fr]">
            <aside className="flex flex-col gap-1 border-b border-border bg-muted/50 p-4 sm:border-b-0 sm:border-r">
              <div className="mb-3 flex items-center gap-2"><div className="grid size-9 place-items-center rounded-full bg-primary text-sm font-bold text-primary-foreground">{initial}</div><span className="truncate text-sm font-semibold">{creatorName || "Store"}</span></div>
              {([["purchases", "Purchases", ShoppingBag], ["transactions", "Transactions", Receipt]] as const).map(([k, label, Icon]) => (
                <button key={k} type="button" onClick={() => setTab(k)} className={`flex items-center gap-2 rounded-md px-3 py-2 text-left text-sm ${tab === k ? "bg-background font-medium text-foreground shadow-sm" : "text-muted-foreground hover:bg-background/60"}`}><Icon className="size-4" /> {label}</button>
              ))}
              <div className="mt-auto space-y-2 pt-4">
                <p className="truncate text-xs text-muted-foreground">{lib.email}</p>
                <Button variant="outline" size="sm" className="w-full" onClick={() => void signOut()} disabled={busy}><LogOut className="size-4" /> Sign out</Button>
                <p className="text-center text-[10px] text-muted-foreground">Powered by AutoDM</p>
              </div>
            </aside>
            <section className="p-5">
              <DialogHeader className="mb-4 text-left"><DialogTitle>{tab === "purchases" ? "Your purchases" : "Transactions"}</DialogTitle><DialogDescription>Signed in as {lib.email}</DialogDescription></DialogHeader>
              {tab === "transactions" ? (
                lib.transactions.length === 0 ? <p className="py-12 text-center text-sm text-muted-foreground">No payments yet.</p> : (
                <ul className="max-h-80 divide-y divide-border overflow-y-auto rounded-lg border border-border text-sm">
                  {lib.transactions.map((t, i) => (
                    <li key={`${t.ref ?? i}`} className="flex items-center justify-between gap-3 px-3 py-2.5">
                      <div className="min-w-0"><p className="truncate font-medium">{t.title}</p><p className="text-xs text-muted-foreground">{new Date(t.at).toLocaleString()}{t.ref ? ` · ${t.ref}` : ""}</p></div>
                      <div className="shrink-0 text-right"><p className="font-semibold">{formatInr(t.amountPaise)}</p><p className="text-xs text-primary">Paid</p></div>
                    </li>
                  ))}
                </ul>)
              ) : lib.items.length === 0 ? (
                <div className="grid place-items-center gap-2 py-12 text-center text-muted-foreground"><Package className="size-10" /><p className="font-medium text-foreground">No products found!</p><p className="text-xs">Items you get from this creator will show up here.</p></div>
              ) : (
                <ul className="max-h-80 space-y-2 overflow-y-auto">
                  {lib.items.map((it) => (
                    <li key={it.slug} className="flex items-center gap-3 rounded-lg border border-border p-2">
                      <div className="aspect-video w-20 shrink-0 overflow-hidden rounded bg-muted">{it.imageUrl ? <img src={it.imageUrl} alt="" className="size-full object-cover" /> : <Package className="m-auto mt-2 size-5 text-muted-foreground" />}</div>
                      <div className="min-w-0 flex-1"><p className="truncate text-sm font-medium">{it.title}</p><p className="text-xs text-muted-foreground">{new Date(it.at).toLocaleDateString()}</p></div>
                      <Button size="sm" disabled={busy} onClick={() => void openContent(it.slug)}>Open</Button>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

export function BuyerSignInButton({ onClick }: { onClick: () => void }) {
  return <Button variant="outline" size="sm" onClick={onClick}><LogIn className="size-4" /> Sign in</Button>;
}
