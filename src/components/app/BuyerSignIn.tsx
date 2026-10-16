import { useEffect, useState } from "react";
import { LogIn, LogOut, Package } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { getBuyerLibrary, requestBuyerCode, signOutBuyer, verifyBuyerCode } from "@/lib/buyer-access.functions";

type Library = { email: string; items: { title: string; slug: string; at: string; hasFile: boolean; imageUrl: string | null }[] };
const key = (slug: string) => `autodm:buyer:${slug}`;

/** "Sign in" for buyers: email → 6-digit code → list of everything they got from this creator. */
export function BuyerSignIn({ slug, open, onOpenChange }: { slug: string; open: boolean; onOpenChange: (v: boolean) => void }) {
  const [step, setStep] = useState<"email" | "code" | "library">("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [lib, setLib] = useState<Library | null>(null);

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
  const signOut = () => run(async () => {
    const token = localStorage.getItem(key(slug));
    if (token) await signOutBuyer({ data: { token } });
    localStorage.removeItem(key(slug)); setLib(null); setCode(""); setStep("email");
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{step === "library" ? "Your purchases" : "Sign in to access your purchases"}</DialogTitle>
          <DialogDescription>
            {step === "email" && "Use the email you entered when you got this."}
            {step === "code" && `Enter the 6-digit code we sent to ${email}.`}
            {step === "library" && lib && `Signed in as ${lib.email}`}
          </DialogDescription>
        </DialogHeader>
        {step === "email" && (
          <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); void sendCode(); }}>
            <Input type="email" required placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} />
            <Button type="submit" className="w-full" disabled={busy}>{busy ? "Sending…" : "Send code"}</Button>
          </form>
        )}
        {step === "code" && (
          <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); void verify(); }}>
            <Input inputMode="numeric" maxLength={6} placeholder="123456" value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))} className="text-center text-lg tracking-[0.4em]" />
            <Button type="submit" className="w-full" disabled={busy || code.length !== 6}>{busy ? "Checking…" : "Sign in"}</Button>
            <button type="button" className="w-full text-xs text-muted-foreground underline" onClick={() => setStep("email")}>Use a different email</button>
          </form>
        )}
        {step === "library" && lib && (
          <div className="space-y-3">
            {lib.items.length === 0 && <p className="text-sm text-muted-foreground">Nothing here yet.</p>}
            <ul className="max-h-80 space-y-2 overflow-y-auto">
              {lib.items.map((it) => (
                <li key={it.slug} className="flex items-center gap-3 rounded-lg border border-border p-2">
                  <div className="aspect-video w-20 shrink-0 overflow-hidden rounded bg-muted">{it.imageUrl ? <img src={it.imageUrl} alt="" className="size-full object-cover" /> : <Package className="m-auto mt-2 size-5 text-muted-foreground" />}</div>
                  <div className="min-w-0 flex-1"><p className="truncate text-sm font-medium">{it.title}</p><p className="text-xs text-muted-foreground">{new Date(it.at).toLocaleDateString()}</p></div>
                  <Button asChild size="sm"><a href={it.hasFile ? `/api/public/pg/${it.slug}` : `/p/${it.slug}`} rel="nofollow">Open</a></Button>
                </li>
              ))}
            </ul>
            <Button variant="outline" className="w-full" onClick={() => void signOut()} disabled={busy}><LogOut className="size-4" /> Sign out</Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

export function BuyerSignInButton({ onClick }: { onClick: () => void }) {
  return <Button variant="outline" size="sm" onClick={onClick}><LogIn className="size-4" /> Sign in</Button>;
}
