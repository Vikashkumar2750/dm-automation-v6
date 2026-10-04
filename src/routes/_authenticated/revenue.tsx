import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Copy, IndianRupee, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { AppShell } from "@/components/app/AppShell";
import { GuideButton } from "@/components/app/GuideButton";
import { EmptyState, PageHeader, Panel, StatusBadge } from "@/components/app/primitives";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useTenant } from "@/hooks/useTenant";
import { buildFunnel, formatInr, rupeesToPaise, slugify } from "@/lib/revenue";
import {
  deleteRevenueItem, getRevenue, removeRazorpayKeys, saveCampaign, savePage, saveProduct, saveRazorpayKeys, saveRevenueSettings,
} from "@/lib/revenue.functions";

export const Route = createFileRoute("/_authenticated/revenue")({
  head: () => ({
    meta: [
      { title: "Revenue — AutoDM by Techaasvik" },
      { name: "description", content: "Sell inside DMs: Razorpay payment links, coupons, delivery pages and a comment-to-sale report." },
      { property: "og:title", content: "Revenue — AutoDM by Techaasvik" },
      { property: "og:description", content: "Payment links, coupons and sales attribution for Instagram and Facebook DMs." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: RevenuePage,
});

const area = "w-full rounded-md border border-input bg-background px-3 py-2 text-sm";

function RevenuePage() {
  const { activeOrg } = useTenant();
  const orgId = activeOrg?.id ?? null;
  const fetchRev = useServerFn(getRevenue);
  const q = useQuery({ queryKey: ["revenue", orgId], enabled: !!orgId, queryFn: () => fetchRev({ data: { organizationId: orgId! } }) });
  const d = q.data;
  return (
    <AppShell>
      <PageHeader title="Revenue" description="Sell inside DMs with payment links, coupons and delivery pages." actions={<GuideButton guide="revenue" />} />
      {!d ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : (
        <Tabs defaultValue="report">
          <TabsList className="flex-wrap">
            <TabsTrigger value="report">Sales report</TabsTrigger>
            <TabsTrigger value="products">Products</TabsTrigger>
            <TabsTrigger value="coupons">Coupons</TabsTrigger>
            <TabsTrigger value="pages">Delivery pages</TabsTrigger>
            <TabsTrigger value="payments">Payments setup</TabsTrigger>
          </TabsList>
          <TabsContent value="report"><Report d={d} /></TabsContent>
          <TabsContent value="products"><Products orgId={orgId!} items={d.products} /></TabsContent>
          <TabsContent value="coupons"><Coupons orgId={orgId!} items={d.campaigns} /></TabsContent>
          <TabsContent value="pages"><Pages orgId={orgId!} items={d.pages} /></TabsContent>
          <TabsContent value="payments"><Payments orgId={orgId!} d={d} /></TabsContent>
        </Tabs>
      )}
    </AppShell>
  );
}

type Data = Awaited<ReturnType<typeof getRevenue>>;

function useSave<T>(fn: (a: { data: T }) => Promise<unknown>, msg: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: T) => fn({ data }),
    onSuccess: () => { toast.success(msg); qc.invalidateQueries({ queryKey: ["revenue"] }); },
    onError: (e: Error) => toast.error(e.message),
  });
}

function Report({ d }: { d: Data }) {
  const steps = buildFunnel(d.funnel);
  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <Panel title="Revenue (30 days)"><p className="text-2xl font-semibold">{formatInr(d.funnel.revenuePaise)}</p></Panel>
        <Panel title="Coupons given"><p className="text-2xl font-semibold">{d.funnel.coupons}</p></Panel>
        <Panel title="Payment reminders sent"><p className="text-2xl font-semibold">{d.funnel.nudges}</p></Panel>
      </div>
      <Panel title="Comment → DM → click → sale (30 days)">
        <div className="space-y-2">
          {steps.map((s) => (
            <div key={s.label} className="flex items-center justify-between rounded-lg border border-border px-3 py-2 text-sm">
              <span>{s.label}</span>
              <span className="font-semibold">{s.value}{s.rate !== null && <span className="ml-2 text-xs font-normal text-muted-foreground">{s.rate}% of previous</span>}</span>
            </div>
          ))}
        </div>
      </Panel>
      <Panel title="Latest payment links">
        {d.links.length === 0 ? <p className="text-sm text-muted-foreground">No payment links sent yet.</p> : (
          <div className="space-y-1 text-sm">
            {d.links.slice(0, 30).map((l: any) => (
              <div key={l.id} className="flex flex-wrap items-center justify-between gap-2 border-b border-border py-1.5">
                <span className="text-muted-foreground">{new Date(l.created_at).toLocaleString()} · {l.platform}</span>
                <span>{formatInr(l.amount_paise)}</span>
                <StatusBadge tone={l.status === "paid" ? "success" : "neutral"}>{l.status === "paid" ? "Paid" : l.provider === "manual" ? "Sent (own link)" : "Waiting"}</StatusBadge>
              </div>
            ))}
          </div>
        )}
      </Panel>
    </div>
  );
}

function Products({ orgId, items }: { orgId: string; items: any[] }) {
  const save = useSave(useServerFn(saveProduct), "Product saved");
  const del = useSave(useServerFn(deleteRevenueItem), "Deleted");
  const [f, setF] = useState({ name: "", price: "", description: "", manualUrl: "" });
  const submit = () => {
    const p = rupeesToPaise(f.price);
    if (!f.name || !p) { toast.error("Name and price (at least ₹1) are needed"); return; }
    save.mutate({ organizationId: orgId, name: f.name, pricePaise: p, description: f.description || null, manualUrl: f.manualUrl || null, active: true },
      { onSuccess: () => setF({ name: "", price: "", description: "", manualUrl: "" }) });
  };
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Panel title="Add product">
        <div className="space-y-2">
          <Input placeholder="Name (e.g. Recipe e-book)" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
          <Input placeholder="Price in ₹" inputMode="decimal" value={f.price} onChange={(e) => setF({ ...f, price: e.target.value })} />
          <Input placeholder="Short description (optional)" value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} />
          <Input placeholder="Own payment link, used if Razorpay is not connected (optional)" value={f.manualUrl} onChange={(e) => setF({ ...f, manualUrl: e.target.value })} />
          <Button onClick={submit} disabled={save.isPending}>Save product</Button>
        </div>
      </Panel>
      <Panel title="Your products">
        {items.length === 0 ? <EmptyState icon={IndianRupee} title="No products yet" description="Add one, then use the “Send payment link” step in Flow builder." /> : (
          <div className="space-y-2">
            {items.map((p) => (
              <div key={p.id} className="flex items-center justify-between gap-2 rounded-lg border border-border p-3 text-sm">
                <div><p className="font-medium">{p.name}</p><p className="text-muted-foreground">{formatInr(p.price_paise)}{p.manual_url ? " · own link" : ""}</p></div>
                <div className="flex items-center gap-2">
                  <Switch checked={p.active} aria-label="Active" onCheckedChange={(v) => save.mutate({ organizationId: orgId, id: p.id, name: p.name, pricePaise: p.price_paise, description: p.description, manualUrl: p.manual_url, active: v })} />
                  <Button size="icon" variant="ghost" aria-label="Delete" onClick={() => del.mutate({ organizationId: orgId, id: p.id, table: "revenue_products" })}><Trash2 className="size-4" /></Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Panel>
    </div>
  );
}

function Coupons({ orgId, items }: { orgId: string; items: any[] }) {
  const save = useSave(useServerFn(saveCampaign), "Coupon campaign saved");
  const del = useSave(useServerFn(deleteRevenueItem), "Deleted");
  const [f, setF] = useState({ name: "", prefix: "", discount: "", max: "500", expires: "" });
  const submit = () => save.mutate({
    organizationId: orgId, name: f.name, prefix: f.prefix.toUpperCase(), discountLabel: f.discount, maxCodes: Number(f.max) || 500,
    expiresAt: f.expires ? new Date(f.expires).toISOString() : null, active: true,
  }, { onSuccess: () => setF({ name: "", prefix: "", discount: "", max: "500", expires: "" }) });
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Panel title="New coupon campaign">
        <div className="space-y-2">
          <Input placeholder="Name (e.g. Diwali sale)" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
          <Input placeholder="Code start, 2–12 letters/numbers (e.g. DIWALI)" value={f.prefix} onChange={(e) => setF({ ...f, prefix: e.target.value })} />
          <Input placeholder="Discount (e.g. 20% off)" value={f.discount} onChange={(e) => setF({ ...f, discount: e.target.value })} />
          <div className="grid grid-cols-2 gap-2">
            <div><Label className="text-xs">Max codes</Label><Input type="number" min={1} value={f.max} onChange={(e) => setF({ ...f, max: e.target.value })} /></div>
            <div><Label className="text-xs">Ends on (optional)</Label><Input type="date" value={f.expires} onChange={(e) => setF({ ...f, expires: e.target.value })} /></div>
          </div>
          <Button onClick={submit} disabled={save.isPending}>Save campaign</Button>
          <p className="text-xs text-muted-foreground">Each person gets one unique code like DIWALI-7KQ2MX. Use the “Send coupon” step in Flow builder with {"{code}"} in the message.</p>
        </div>
      </Panel>
      <Panel title="Campaigns">
        {items.length === 0 ? <p className="text-sm text-muted-foreground">No campaigns yet.</p> : items.map((c) => (
          <div key={c.id} className="mb-2 flex items-center justify-between rounded-lg border border-border p-3 text-sm">
            <div><p className="font-medium">{c.name}</p><p className="text-muted-foreground">{c.prefix}-XXXXXX · {c.discount_label} · max {c.max_codes}{c.expires_at ? ` · ends ${new Date(c.expires_at).toLocaleDateString()}` : ""}</p></div>
            <Button size="icon" variant="ghost" aria-label="Delete" onClick={() => del.mutate({ organizationId: orgId, id: c.id, table: "coupon_campaigns" })}><Trash2 className="size-4" /></Button>
          </div>
        ))}
      </Panel>
    </div>
  );
}

function Pages({ orgId, items }: { orgId: string; items: any[] }) {
  const save = useSave(useServerFn(savePage), "Page saved");
  const del = useSave(useServerFn(deleteRevenueItem), "Deleted");
  const [f, setF] = useState({ title: "", slug: "", body: "", buttonLabel: "", buttonUrl: "" });
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const submit = () => save.mutate({
    organizationId: orgId, title: f.title, slug: f.slug || slugify(f.title), body: f.body || null,
    buttonLabel: f.buttonLabel || null, buttonUrl: f.buttonUrl || null, active: true,
  }, { onSuccess: () => setF({ title: "", slug: "", body: "", buttonLabel: "", buttonUrl: "" }) });
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Panel title="New delivery page">
        <div className="space-y-2">
          <Input placeholder="Title (e.g. Your free guide)" value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} />
          <Input placeholder="Address (e.g. free-guide)" value={f.slug} onChange={(e) => setF({ ...f, slug: slugify(e.target.value) })} />
          <textarea rows={4} className={area} placeholder="Text shown on the page" value={f.body} onChange={(e) => setF({ ...f, body: e.target.value })} />
          <div className="grid grid-cols-2 gap-2">
            <div className="flex items-center gap-1">
              <Input placeholder="Button text" value={f.buttonLabel} onChange={(e) => setF({ ...f, buttonLabel: e.target.value })} />
              <FieldInfo
                title="Button text"
                how="Ye us button par likha text hai jo aapki delivery page par dikhega. Chhota aur clear rakho — jaise 'Download Now' ya 'Buy Now'."
                why="Sahi text se visitor samajh jaata hai button dabane se kya milega, isliye zyada log click karte hain."
                example="Download Now · Buy Now · Get Free Guide"
              />
            </div>
            <div className="flex items-center gap-1">
              <Input placeholder="https://button-link" value={f.buttonUrl} onChange={(e) => setF({ ...f, buttonUrl: e.target.value })} />
              <FieldInfo
                title="Button link"
                how="Ye address us page ka hai jo button dabane par khulega. Poora link http:// ya https:// se shuru karo. Delivery page ka apna link (jaise origin/p/slug) bhi daal sakte ho, ya koi bhi website."
                why="Button isi link par le jaata hai — galat ya adhoora link daala to visitor blank page par pahunchega."
                example="https://yoursite.com/your-guide ya apna delivery page: origin/p/free-guide"
              />
            </div>
          </div>
          <Button onClick={submit} disabled={save.isPending}>Save page</Button>
          <p className="text-xs text-muted-foreground">Put the page link in any DM button. Views and button clicks show in the Sales report.</p>
        </div>
      </Panel>
      <Panel title="Your pages">
        {items.length === 0 ? <p className="text-sm text-muted-foreground">No pages yet.</p> : items.map((p) => (
          <div key={p.id} className="mb-2 flex items-center justify-between gap-2 rounded-lg border border-border p-3 text-sm">
            <div className="min-w-0"><p className="font-medium">{p.title}</p><p className="truncate text-muted-foreground">{origin}/p/{p.slug} · {p.views} views</p></div>
            <div className="flex">
              <Button size="icon" variant="ghost" aria-label="Copy link" onClick={() => { navigator.clipboard.writeText(`${origin}/p/${p.slug}`); toast.success("Link copied"); }}><Copy className="size-4" /></Button>
              <Button size="icon" variant="ghost" aria-label="Delete" onClick={() => del.mutate({ organizationId: orgId, id: p.id, table: "delivery_pages" })}><Trash2 className="size-4" /></Button>
            </div>
          </div>
        ))}
      </Panel>
    </div>
  );
}

function Payments({ orgId, d }: { orgId: string; d: Data }) {
  const saveKeys = useSave(useServerFn(saveRazorpayKeys), "Razorpay connected");
  const removeKeys = useSave(useServerFn(removeRazorpayKeys), "Razorpay removed");
  const saveSet = useSave(useServerFn(saveRevenueSettings), "Reminder settings saved");
  const [k, setK] = useState({ keyId: "", keySecret: "", webhookSecret: "" });
  const [s, setS] = useState({ enabled: d.settings.nudge_enabled, delay: d.settings.nudge_delay_minutes, text: d.settings.nudge_text });
  useEffect(() => setS({ enabled: d.settings.nudge_enabled, delay: d.settings.nudge_delay_minutes, text: d.settings.nudge_text }), [d.settings]);
  const hook = `${typeof window !== "undefined" ? window.location.origin : ""}/api/public/webhooks/razorpay/${orgId}`;
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Panel title="Razorpay">
        {d.razorpay ? (
          <div className="space-y-3 text-sm">
            <p>Connected with key <span className="font-mono">{d.razorpay.keyIdHint}</span>. Every customer gets their own payment link, and paid customers get the “paid” tag.</p>
            <Button variant="outline" onClick={() => removeKeys.mutate({ organizationId: orgId })}>Disconnect</Button>
          </div>
        ) : (
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">Razorpay Dashboard → Account & Settings → API keys. Money goes straight to your Razorpay account.</p>
            <Input placeholder="Key ID (rzp_live_… or rzp_test_…)" value={k.keyId} onChange={(e) => setK({ ...k, keyId: e.target.value })} />
            <Input type="password" placeholder="Key secret" value={k.keySecret} onChange={(e) => setK({ ...k, keySecret: e.target.value })} />
            <Input type="password" placeholder="Webhook secret (you choose it in Razorpay)" value={k.webhookSecret} onChange={(e) => setK({ ...k, webhookSecret: e.target.value })} />
            <Button disabled={saveKeys.isPending} onClick={() => saveKeys.mutate({ organizationId: orgId, ...k }, { onSuccess: () => setK({ keyId: "", keySecret: "", webhookSecret: "" }) })}>Connect Razorpay</Button>
          </div>
        )}
        <div className="mt-4 rounded-lg bg-muted p-3 text-xs">
          <p className="font-medium">Step 2 — Webhook address (Razorpay → Webhooks → Add, event “payment_link.paid”):</p>
          <div className="mt-1 flex items-center gap-2"><code className="break-all">{hook}</code>
            <Button size="icon" variant="ghost" aria-label="Copy webhook address" onClick={() => { navigator.clipboard.writeText(hook); toast.success("Copied"); }}><Copy className="size-4" /></Button></div>
          <p className="mt-2 text-muted-foreground">Yeh zaroori hai — iske bina Razorpay ko pata nahi chalega ki payment hui, isliye “paid” tag, sale report aur reminder kaam nahi karenge. Address apke live site ke domain se shuru hota hai (jaise autodm.techaasvik.com) — yahin se copy karke Razorpay mein paste karo.</p>
        </div>
      </Panel>
      <Panel title="Payment reminder">
        <div className="space-y-3">
          <label className="flex items-center gap-2 text-sm"><Switch checked={s.enabled} onCheckedChange={(v) => setS({ ...s, enabled: v })} /> Send one reminder if not paid</label>
          <div><Label className="text-xs">Wait (minutes, 15–1200)</Label><Input type="number" min={15} max={1200} value={s.delay} onChange={(e) => setS({ ...s, delay: Number(e.target.value) })} /></div>
          <textarea rows={3} className={area} value={s.text} maxLength={600} onChange={(e) => setS({ ...s, text: e.target.value })} />
          <p className="text-xs text-muted-foreground">Only one reminder per link, and only if the person messaged you in the last 24 hours (Meta rule). Quiet hours and limits apply.</p>
          <Button onClick={() => saveSet.mutate({ organizationId: orgId, nudgeEnabled: s.enabled, nudgeDelayMinutes: s.delay, nudgeText: s.text })}>Save</Button>
        </div>
      </Panel>
    </div>
  );
}
