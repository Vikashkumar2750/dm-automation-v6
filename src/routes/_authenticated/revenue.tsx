import { SocialIcon } from "@/components/app/SocialIcon";
import { SOCIAL_LABELS, SOCIAL_PLATFORMS, cleanSocials, connectedAccountUrl, normalizeSocialUrl, type SocialLink } from "@/lib/social-links";
import { AccountSelect } from "@/components/app/AccountSelect";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Copy, IndianRupee, Info, Loader2, Pencil, Plus, Trash2, Upload, Users } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { AppShell } from "@/components/app/AppShell";
import { GuideButton } from "@/components/app/GuideButton";
import { ContentFileField } from "@/components/app/ContentFileField";
import { EmptyState, PageHeader, Panel, StatusBadge } from "@/components/app/primitives";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useTenant } from "@/hooks/useTenant";
import { buildFunnel, formatInr, rupeesToPaise, slugify, withCharges } from "@/lib/revenue";
import { DeliveryPageView } from "@/components/app/DeliveryPageView";
import { DELIVERY_TEMPLATES, SAMPLE_BODY, EMAIL_ONLY_FIELDS, STANDARD_LEAD_FIELDS, priceDisplay, DEFAULT_POLICIES, DEFAULT_DISCLAIMER, DEFAULT_EXTRAS, type LeadField, type PageExtras } from "@/lib/delivery-page";
import { previewDeliveryImage, uploadDeliveryImage } from "@/lib/delivery-media";
import {
  deleteRevenueItem, getRevenue, removeRazorpayKeys, removeWhatsappOtpSettings, saveCampaign, savePage, saveProduct, saveRazorpayKeys, saveRevenueSettings, saveWhatsappOtpSettings,
} from "@/lib/revenue.functions";

export const Route = createFileRoute("/_authenticated/revenue")({
  head: () => ({
    meta: [
      { title: "Sales & Revenue — AutoDM by Techaasvik" },
      { name: "description", content: "Sell inside DMs: Razorpay payment links, coupons, delivery pages and a comment-to-sale report." },
      { property: "og:title", content: "Sales & Revenue — AutoDM by Techaasvik" },
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
  const [accountId, setAccountId] = useState("all");
  const q = useQuery({ queryKey: ["revenue", orgId, accountId], enabled: !!orgId, queryFn: () => fetchRev({ data: { organizationId: orgId!, ...(accountId !== "all" ? { socialAccountId: accountId } : {}) } }) });
  const d = q.data;
  return (
    <AppShell>
      <PageHeader title="Sales & Revenue" description="Sell inside DMs with payment links, coupons and delivery pages." actions={<div className="flex flex-nowrap items-center gap-2"><AccountSelect orgId={orgId ?? null} value={accountId} onChange={setAccountId} className="h-9 w-auto max-w-[240px]" /><GuideButton guide="revenue" /></div>} />
      {!d ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : (
        <Tabs defaultValue="report">
          <TabsList className="flex-nowrap">
            <TabsTrigger value="report">Sales report</TabsTrigger>
            <TabsTrigger value="products">Products</TabsTrigger>
            <TabsTrigger value="coupons">Coupons</TabsTrigger>
            <TabsTrigger value="pages">Delivery pages</TabsTrigger>
            <TabsTrigger value="payments">Payments setup</TabsTrigger>
          </TabsList>
          <TabsContent forceMount className="data-[state=inactive]:hidden" value="report"><Report d={d} /></TabsContent>
          <TabsContent forceMount className="data-[state=inactive]:hidden" value="products"><Products orgId={orgId ?? ""} items={d.products} connected={!!d.razorpay} /></TabsContent>
          <TabsContent forceMount className="data-[state=inactive]:hidden" value="coupons"><Coupons orgId={orgId!} items={d.campaigns} /></TabsContent>
          <TabsContent forceMount className="data-[state=inactive]:hidden" value="pages"><Pages orgId={orgId!} items={d.pages} leads={d.leads} products={d.products} campaigns={d.campaigns} whatsappOtp={d.whatsappOtp} connected={!!d.razorpay} accounts={d.accounts} /></TabsContent>
          <TabsContent forceMount className="data-[state=inactive]:hidden" value="payments"><Payments orgId={orgId!} d={d} /></TabsContent>
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
            <div key={s.label} className="grid gap-1 rounded-lg border border-border px-3 py-2 text-sm sm:flex sm:items-center sm:justify-between">
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

function Products({ orgId, items, connected }: { orgId: string; items: any[]; connected: boolean }) {
  const save = useSave(useServerFn(saveProduct), "Product saved");
  const del = useSave(useServerFn(deleteRevenueItem), "Deleted");
  const blankP = { id: "", name: "", price: "", originalPrice: "", description: "", manualUrl: "", deliveryUrl: "" };
  const [f, setF] = useState(blankP);
  const submit = () => {
    const p = rupeesToPaise(f.price);
    if (!f.name || !p) { toast.error("Name and price (at least ₹1) are needed"); return; }
    save.mutate({ organizationId: orgId, ...(f.id ? { id: f.id } : {}), name: f.name, pricePaise: p, originalPricePaise: f.originalPrice ? rupeesToPaise(f.originalPrice) : null, description: f.description || null, manualUrl: f.manualUrl || null, deliveryUrl: f.deliveryUrl || null, active: true },
      { onSuccess: () => setF(blankP) });
  };
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Panel title={f.id ? `Edit product: ${f.name}` : "Add product"}>
        <div className="space-y-2">
          <Chips label="Quick fill" items={PRODUCT_PRESETS.map((p) => p.name)} onPick={(v) => { const p = PRODUCT_PRESETS.find((x) => x.name === v)!; setF({ ...f, name: p.name, price: p.price, originalPrice: p.mrp, description: p.desc }); }} />
          <Input placeholder="Name (e.g. Recipe e-book)" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
          <div className="grid grid-cols-2 gap-2">
            <div><Label className="text-xs">Selling price ₹</Label><Input placeholder="999" inputMode="decimal" value={f.price} onChange={(e) => setF({ ...f, price: e.target.value })} /></div>
            <div><Label className="text-xs">MRP ₹ (optional, crossed out)</Label><Input placeholder="1999" inputMode="decimal" value={f.originalPrice} onChange={(e) => setF({ ...f, originalPrice: e.target.value })} /></div>
          </div>
          <Input placeholder="Short description (optional)" value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} />
          {connected ? <StatusBadge tone="success">Razorpay connected · Automatic checkout</StatusBadge> : <Input placeholder="External payment link (optional fallback)" value={f.manualUrl} onChange={(e) => setF({ ...f, manualUrl: e.target.value })} />}
          <Label htmlFor="product-delivery">Content / deliverable link — access after payment</Label>
          <ContentFileField id="product-delivery" orgId={orgId} placeholder="https://… (course, drive or private group)" value={f.deliveryUrl} onChange={(v) => setF({ ...f, deliveryUrl: v })} />
          <div className="flex gap-2"><Button onClick={submit} disabled={save.isPending}>{f.id ? "Update product" : "Save product"}</Button>{f.id && <Button variant="outline" onClick={() => setF(blankP)}>Cancel</Button>}</div>
          <p className="text-xs text-muted-foreground">Price and content are shared with linked delivery pages.</p>
        </div>
      </Panel>
      <Panel title="Your products">
        {items.length === 0 ? <EmptyState icon={IndianRupee} title="No products yet" description="Add one, then use the “Send payment link” step in Flow builder." /> : (
          <div className="space-y-2">
            {items.map((p) => (
              <div key={p.id} className="flex items-center justify-between gap-2 rounded-lg border border-border p-3 text-sm">
                <div><p className="font-medium">{p.name}</p><p className="text-muted-foreground">{formatInr(p.price_paise)}{p.original_price_paise > p.price_paise ? <s className="ml-1">{formatInr(p.original_price_paise)}</s> : null}{connected ? " · automatic checkout" : p.manual_url ? " · external payment" : ""}</p></div>
                <div className="flex items-center gap-2">
                  <Switch checked={p.active} aria-label="Active" onCheckedChange={(v) => save.mutate({ organizationId: orgId, id: p.id, name: p.name, pricePaise: p.price_paise, originalPricePaise: p.original_price_paise ?? null, description: p.description, manualUrl: p.manual_url, deliveryUrl: p.delivery_url ?? null, active: v })} />
                  <Button size="icon" variant="ghost" aria-label="Edit" onClick={() => setF({ id: p.id, name: p.name, price: String(p.price_paise / 100), originalPrice: p.original_price_paise ? String(p.original_price_paise / 100) : "", description: p.description ?? "", manualUrl: p.manual_url ?? "", deliveryUrl: p.delivery_url ?? "" })}><Pencil className="size-4" /></Button>
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
  const blankC = { id: "", name: "", prefix: "", discount: "", max: "500", expires: "", kind: "dm_unique" as "dm_unique" | "store_code", storeCode: "", active: true };
  const [f, setF] = useState(blankC);
  const submit = () => save.mutate({
    organizationId: orgId, ...(f.id ? { id: f.id } : {}), name: f.name, prefix: f.prefix.toUpperCase(), discountLabel: f.discount, maxCodes: Number(f.max) || 500,
    expiresAt: f.expires ? new Date(f.expires).toISOString() : null, active: f.active,
    kind: f.kind, storeCode: f.kind === "store_code" ? (f.storeCode || f.prefix).toUpperCase() : null,
  }, { onSuccess: () => setF(blankC) });
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Panel title={f.id ? `Edit campaign: ${f.name}` : "New coupon campaign"}>
        <div className="space-y-2">
          <div>
            <Label className="text-xs">Coupon type</Label>
            <select className={area} value={f.kind} onChange={(e) => setF({ ...f, kind: e.target.value as typeof f.kind })}>
              <option value="dm_unique">Unique code per person — sent in DM automation</option>
              <option value="store_code">One shared code — shown on a delivery page</option>
            </select>
          </div>
          <Chips label="Quick fill" items={["Diwali sale", "New Year sale", "Launch week", "Followers special"]} onPick={(v) => { const p = v.split(" ")[0]!.toUpperCase().slice(0, 12); setF({ ...f, name: v, prefix: p, storeCode: f.kind === "store_code" ? `${p}20` : f.storeCode, discount: f.discount || "20% off" }); }} />
          <Input placeholder="Name (e.g. Diwali sale)" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
          {f.kind === "store_code"
            ? <Input placeholder="Store code (e.g. DIWALI50)" value={f.storeCode} onChange={(e) => setF({ ...f, storeCode: e.target.value.toUpperCase().replace(/[^A-Z0-9-]/g, "").slice(0, 30) })} />
            : <Input placeholder="Code start, 2–12 letters/numbers (e.g. DIWALI)" value={f.prefix} onChange={(e) => setF({ ...f, prefix: e.target.value })} />}
          {f.kind === "store_code" && <Input placeholder="Code start for reference, 2–12 letters (e.g. DIWALI)" value={f.prefix} onChange={(e) => setF({ ...f, prefix: e.target.value })} />}
          <Chips items={["DIWALI", "SALE", "VIP", "FLASH", "LAUNCH"]} onPick={(v) => setF({ ...f, prefix: v, storeCode: f.kind === "store_code" ? `${v}20` : f.storeCode })} />
          <Input placeholder="Discount (e.g. 20% off)" value={f.discount} onChange={(e) => setF({ ...f, discount: e.target.value })} />
          <Chips items={["10% off", "20% off", "50% off", "₹100 off", "Buy 1 Get 1"]} onPick={(v) => setF({ ...f, discount: v })} />
          <div className="grid grid-cols-2 gap-2">
            <div><Label className="text-xs">Max codes</Label><Input type="number" min={1} value={f.max} onChange={(e) => setF({ ...f, max: e.target.value })} /></div>
            <div><Label className="text-xs">Ends on (optional)</Label><Input type="date" value={f.expires} onChange={(e) => setF({ ...f, expires: e.target.value })} /></div>
          </div>
          <Button onClick={submit} disabled={save.isPending || !f.name || !f.prefix || !f.discount || (f.kind === "store_code" && !f.storeCode && !f.prefix)}>{f.id ? "Update campaign" : "Save campaign"}</Button>
          {f.id && <Button variant="outline" className="ml-2" onClick={() => setF(blankC)}>Cancel</Button>}
          <p className="text-xs text-muted-foreground">{f.kind === "dm_unique"
            ? <>Each person gets one unique code like DIWALI-7KQ2MX. Use the “Send coupon” step in Flow builder with {"{code}"} in the message.</>
            : "One code for everyone (e.g. DIWALI50). Pick it in a delivery page's Price & offer card — it shows in the coupon box automatically while the campaign is active."}</p>
        </div>
      </Panel>
      <Panel title="Campaigns">
        {items.length === 0 ? <p className="text-sm text-muted-foreground">No campaigns yet.</p> : items.map((c) => (
          <div key={c.id} className="mb-2 flex items-center justify-between rounded-lg border border-border p-3 text-sm">
            <div><p className="font-medium">{c.name} {c.kind === "store_code" && <span className="ml-1 rounded-full bg-muted px-2 py-0.5 text-[10px]">Store code</span>}</p><p className="text-muted-foreground">{c.kind === "store_code" ? c.store_code : `${c.prefix}-XXXXXX`} · {c.discount_label} · max {c.max_codes}{c.expires_at ? ` · ends ${new Date(c.expires_at).toLocaleDateString()}` : ""}</p></div>
            <div className="flex"><Button size="icon" variant="ghost" aria-label="Edit" onClick={() => setF({ id: c.id, name: c.name, prefix: c.prefix ?? "", discount: c.discount_label ?? "", max: String(c.max_codes ?? 500), expires: c.expires_at ? String(c.expires_at).slice(0, 10) : "", kind: c.kind === "store_code" ? "store_code" : "dm_unique", storeCode: c.store_code ?? "", active: c.active !== false })}><Pencil className="size-4" /></Button>
            <Button size="icon" variant="ghost" aria-label="Delete" onClick={() => del.mutate({ organizationId: orgId, id: c.id, table: "coupon_campaigns" })}><Trash2 className="size-4" /></Button></div>
          </div>
        ))}
      </Panel>
    </div>
  );
}

type PageForm = {
  id: string | null; title: string; slug: string; originalSlug: string; body: string; buttonLabel: string; buttonUrl: string; imagePath: string; imageAlt: string; showImage: boolean;
  countdown: string; expiryAction: "disable_cta" | "hide_cta"; expiryMessage: string;
  formType: "none" | "email" | "full"; formMode: "optional" | "required"; fields: LeadField[];
  showPrice: boolean; priceOriginal: string; priceOffer: string; discountLabel: string; couponCode: string; couponNote: string;
  extras: PageExtras; productId: string; couponCampaignId: string; otpRequired: boolean;
};
const EMPTY_PAGE: PageForm = {
  id: null, title: "", slug: "", originalSlug: "", body: "", buttonLabel: "", buttonUrl: "", imagePath: "", imageAlt: "", showImage: false, countdown: "", expiryAction: "disable_cta",
  expiryMessage: "This offer has ended.", formType: "none", formMode: "optional", fields: STANDARD_LEAD_FIELDS,
  showPrice: false, priceOriginal: "", priceOffer: "", discountLabel: "", couponCode: "", couponNote: "", extras: DEFAULT_EXTRAS, productId: "", couponCampaignId: "", otpRequired: false,
};
const CONSENT = "I agree that my details may be used to fulfil this request and follow up about this offer.";
const toLocalInput = (iso: string | null) => { if (!iso) return ""; const d = new Date(iso); return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16); };
const paiseToRupees = (p: number | null) => (p ? String(p / 100) : "");

function pageToForm(p: any): PageForm {
  const cfg = (p.form_config ?? { mode: "none", fields: [] }) as { mode: string; fields?: LeadField[]; extras?: PageExtras };
  const fields = cfg.fields ?? [];
  const emailOnly = fields.length === 1 && fields[0]?.type === "email";
  return {
    ...EMPTY_PAGE, id: p.id, title: p.title ?? "", slug: p.slug ?? "", originalSlug: p.slug ?? "", body: p.body ?? "", buttonLabel: p.button_label ?? "", buttonUrl: p.button_url ?? "",
    imagePath: p.image_path ?? "", imageAlt: p.image_alt ?? "", showImage: !!p.show_image, countdown: toLocalInput(p.countdown_at), expiryAction: p.expiry_action ?? "disable_cta",
    expiryMessage: p.expiry_message ?? "This offer has ended.",
    formType: cfg.mode === "none" || fields.length === 0 ? "none" : emailOnly ? "email" : "full", formMode: cfg.mode === "required" ? "required" : "optional",
    fields: emailOnly || fields.length === 0 ? STANDARD_LEAD_FIELDS : fields,
    showPrice: !!p.show_price, priceOriginal: paiseToRupees(p.price_original_paise), priceOffer: paiseToRupees(p.price_offer_paise),
    discountLabel: p.discount_label ?? "", couponCode: p.coupon_code ?? "", couponNote: p.coupon_note ?? "", extras: cfg.extras ?? {}, productId: p.product_id ?? "",
    couponCampaignId: p.coupon_campaign_id ?? "", otpRequired: !!p.otp_required,
  };
}

function formFields(f: PageForm): LeadField[] { return f.formType === "none" ? [] : f.formType === "email" ? EMAIL_ONLY_FIELDS : f.fields; }

function LeadFieldsEditor({ fields, onChange }: { fields: LeadField[]; onChange: (f: LeadField[]) => void }) {
  const standardKeys = STANDARD_LEAD_FIELDS.map((s) => s.key);
  const set = (i: number, patch: Partial<LeadField>) => onChange(fields.map((x, j) => (j === i ? { ...x, ...patch } : x)));
  const toggleStandard = (key: string, on: boolean) => {
    if (on) { const s = STANDARD_LEAD_FIELDS.find((x) => x.key === key)!; onChange([...fields, s]); }
    else onChange(fields.filter((x) => x.key !== key));
  };
  const custom = fields.map((x, i) => ({ x, i })).filter(({ x }) => !standardKeys.includes(x.key));
  return (
    <div className="space-y-2">
      <div className="grid grid-cols-2 gap-2">
        {STANDARD_LEAD_FIELDS.map((s) => { const i = fields.findIndex((x) => x.key === s.key); const on = i >= 0; return (
          <div key={s.key} className="flex items-center justify-between gap-2 rounded-md border border-border px-2 py-1.5 text-xs">
            <label className="flex items-center gap-2"><Switch checked={on} onCheckedChange={(v) => toggleStandard(s.key, v)} /> {s.label}</label>
            {on && <label className="flex items-center gap-1 text-muted-foreground"><input type="checkbox" checked={fields[i]!.required} onChange={(e) => set(i, { required: e.target.checked })} /> Required</label>}
          </div>); })}
      </div>
      {custom.map(({ x, i }) => (
        <div key={i} className="space-y-1.5 rounded-md border border-border p-2">
          <div className="flex gap-2">
            <Input className="h-8 text-xs" placeholder="Question (e.g. Your city)" value={x.label} onChange={(e) => set(i, { label: e.target.value })} />
            <select className="h-8 rounded-md border border-input bg-background px-2 text-xs" value={x.type} onChange={(e) => set(i, { type: e.target.value as LeadField["type"], options: e.target.value === "choice" ? x.options : [] })}>
              <option value="text">Text</option><option value="choice">Dropdown</option>
            </select>
            <Button type="button" size="icon" variant="ghost" className="size-8" aria-label="Remove field" onClick={() => onChange(fields.filter((_, j) => j !== i))}><Trash2 className="size-4" /></Button>
          </div>
          {x.type === "choice" && <Input className="h-8 text-xs" placeholder="Options, comma separated (e.g. Beginner, Intermediate, Expert)" defaultValue={x.options.join(", ")}
            onBlur={(e) => set(i, { options: e.target.value.split(",").map((o) => o.trim()).filter(Boolean).slice(0, 10).map((o) => o.slice(0, 30)) })} />}
          <label className="flex items-center gap-1 text-xs text-muted-foreground"><input type="checkbox" checked={x.required} onChange={(e) => set(i, { required: e.target.checked })} /> Required</label>
        </div>
      ))}
      <Button type="button" size="sm" variant="outline" disabled={fields.length >= 8}
        onClick={() => onChange([...fields, { key: `custom_${Date.now().toString(36).slice(-6)}`, label: "", type: "text", required: false, options: [] }])}>
        <Plus className="size-4" /> Add custom field
      </Button>
      <p className="text-xs text-muted-foreground">Up to 8 fields. Pincode must be 6 digits, phone 10–15 digits.</p>
    </div>
  );
}

/** Where the visitor stopped: completed form, waiting on WhatsApp code, left the form, or only tried to sign in. */
const STAGE_BADGE: Record<string, { label: string; cls: string }> = {
  completed: { label: "Completed", cls: "bg-success/15 text-success" },
  otp_pending: { label: "Dropped at WhatsApp code", cls: "bg-warning/15 text-warning" },
  intent_started: { label: "Left form unsent", cls: "bg-destructive/10 text-destructive" },
  buyer_signin_attempt: { label: "Sign-in attempt", cls: "bg-primary/10 text-primary" },
};

function Pages({ orgId, items, leads, products, campaigns, whatsappOtp, connected, accounts }: { accounts: Data["accounts"]; connected: boolean; orgId: string; items: any[]; products: any[]; campaigns: any[]; whatsappOtp: Data["whatsappOtp"]; leads: Array<{ id: string; delivery_page_id: string; answers: Record<string, string>; created_at: string }> }) {
  const save = useSave(useServerFn(savePage), "Page saved");
  const del = useSave(useServerFn(deleteRevenueItem), "Deleted");
  const [f, setF] = useState<PageForm>(EMPTY_PAGE);
  const [imagePreview, setImagePreview] = useState("");
  const [previewDevice, setPreviewDevice] = useState<"desktop" | "mobile">("desktop");
  const [uploading, setUploading] = useState(false);
  const [leadsFor, setLeadsFor] = useState<string | null>(null);
  const imageInput = useRef<HTMLInputElement>(null);
  const formTop = useRef<HTMLDivElement>(null);
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const creatorKey = `autodm:creator-details:${orgId}`;
  const savedCreator = (): PageExtras | null => { try { return JSON.parse(localStorage.getItem(creatorKey) ?? "null"); } catch { return null; } };
  const connectedSocials = (): SocialLink[] => accounts.flatMap((a) => { const url = connectedAccountUrl(a); return url ? [{ platform: a.platform as SocialLink["platform"], url, label: a.name }] : []; });
  const withCreator = (p: PageForm): PageForm => { const c = savedCreator(); const socials = c?.socials?.length ? c.socials : connectedSocials(); return { ...p, extras: { ...p.extras, ...(c ? { creatorName: c.creatorName, supportEmail: c.supportEmail } : {}), socials } }; };
  useEffect(() => { setF((v) => (v.id ? v : withCreator(v))); }, [orgId]);
  const reset = () => { setF(withCreator(EMPTY_PAGE)); setImagePreview(""); };
  const pickProduct = (id: string) => {
    const pr = products.find((x) => x.id === id);
    if (!pr) { setF({ ...f, productId: "" }); return; }
    setF({ ...f, productId: id, showPrice: true, priceOffer: String(pr.price_paise / 100),
      priceOriginal: pr.original_price_paise ? String(pr.original_price_paise / 100) : f.priceOriginal,
      title: f.title || pr.name, buttonUrl: connected ? f.buttonUrl : pr.manual_url || f.buttonUrl, buttonLabel: f.buttonLabel || "Buy now" });
  };
  const pickCampaign = (id: string) => {
    const c = campaigns.find((x) => x.id === id);
    if (!c) { setF({ ...f, couponCampaignId: "" }); return; }
    setF({ ...f, couponCampaignId: id, showPrice: true, couponCode: c.store_code || c.prefix || f.couponCode, couponNote: c.discount_label || f.couponNote });
  };
  const storeCampaigns = campaigns.filter((c) => c.active && (!c.expires_at || new Date(c.expires_at) > new Date()));
  const startEdit = async (p: any) => {
    setF(pageToForm(p)); setImagePreview("");
    formTop.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    if (p.image_path) { try { setImagePreview(await previewDeliveryImage(p.image_path)); } catch { /* preview only */ } }
  };
  const autoCheckout = connected && !!(f.productId || rupeesToPaise(f.priceOffer));
  const fields = formFields(f);
  const formConfig = { mode: f.formType === "none" ? "none" as const : f.formMode, consent: f.formType === "none" ? "" : CONSENT, fields, extras: cleanExtras(f.extras) };
  const price = f.showPrice ? { originalPaise: f.priceOriginal ? rupeesToPaise(f.priceOriginal) : null, offerPaise: f.priceOffer ? rupeesToPaise(f.priceOffer) : null, label: f.discountLabel || null, couponCode: f.couponCode.trim().toUpperCase() || null, couponNote: f.couponNote || null, charges: null as ReturnType<typeof withCharges> | null } : null;
  if (price?.offerPaise) { const b = withCharges(price.offerPaise, f.extras.charges); price.charges = b.totalPaise === price.offerPaise ? null : b; }
  const badLead = f.formType === "full" && (fields.length === 0 || fields.some((x) => !x.label.trim() || (x.type === "choice" && x.options.length === 0)));
  const submit = () => save.mutate({
    organizationId: orgId, id: f.id ?? undefined, title: f.title, slug: f.slug || slugify(f.title), body: f.body || null,
    buttonLabel: f.buttonLabel || null, buttonUrl: f.buttonUrl || null, active: true, imagePath: f.imagePath || null, showImage: f.showImage,
    imageAlt: f.imageAlt || null, countdownAt: f.countdown ? new Date(f.countdown).toISOString() : null, expiryAction: f.expiryAction, expiryMessage: f.expiryMessage || null,
    formConfig: { ...formConfig, fields: fields.map((x) => ({ ...x, label: x.label.trim() })) },
    showPrice: f.showPrice, priceOriginalPaise: price?.originalPaise ?? null, priceOfferPaise: price?.offerPaise ?? null,
    discountLabel: f.discountLabel || null, couponCode: f.couponCode.trim() || null, couponNote: f.couponNote || null, productId: f.productId || null,
    couponCampaignId: f.couponCampaignId || null, otpRequired: f.otpRequired,
  }, { onSuccess: reset });
  const uploadImage = async (file: File | undefined) => {
    if (!file) return;
    setUploading(true);
    try { const path = await uploadDeliveryImage(orgId, file); setF((v) => ({ ...v, imagePath: path, showImage: true, imageAlt: v.imageAlt || v.title })); setImagePreview(await previewDeliveryImage(path)); toast.success("Product image uploaded"); }
    catch (e) { toast.error(e instanceof Error ? e.message : "Upload failed"); } finally { setUploading(false); if (imageInput.current) imageInput.current.value = ""; }
  };
  const pageLeads = leadsFor ? leads.filter((l) => l.delivery_page_id === leadsFor) : [];
  return (
    <div className="space-y-4">
    <div className="grid gap-4 lg:grid-cols-2">
      <div ref={formTop}>
      <Panel title={f.id ? `Edit page: ${f.title || "Untitled"}` : "New delivery page"}>
        <div className="space-y-2">
          <div>
            <Label className="text-xs">Start from a ready-made design</Label>
            <div className="mt-1 flex flex-wrap gap-1.5">
              {DELIVERY_TEMPLATES.map((t) => (
                <Button key={t.key} type="button" size="sm" variant="outline" title={t.hint}
                  onClick={() => setF({ ...f, title: t.title, slug: f.slug || t.slug, body: t.body, buttonLabel: t.buttonLabel, ...(t.priceOffer ? { showPrice: true, priceOriginal: t.priceOriginal ?? "", priceOffer: t.priceOffer } : {}) })}>
                  {t.name}
                </Button>
              ))}
            </div>
          </div>
          <Input placeholder="Title (e.g. Your free guide)" value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} />
          <Input placeholder="Address (e.g. free-guide)" value={f.slug} onChange={(e) => setF({ ...f, slug: slugify(e.target.value) })} />
          {f.id && f.slug !== f.originalSlug && <p className="text-xs text-destructive">Changing the address breaks links you already sent in DMs ({origin}/p/{f.originalSlug}).</p>}
          <textarea rows={12} className={`${area} font-mono text-xs`} placeholder={"# Big headline\nShort intro line\n\n## Section title\n- Point one\n- Point two\n> Highlighted note\n? Question | Answer"} value={f.body} onChange={(e) => setF({ ...f, body: e.target.value })} />
          <p className="text-xs text-muted-foreground">
            Formatting: <code># Headline</code> · <code>## Section</code> · <code>- point</code> · <code>&gt; note</code> · <code>? Question | Answer</code> · <code>**bold**</code>. Plain text also looks good.
          </p>
          <div className="space-y-2 rounded-lg border border-border p-3">
            <div className="flex items-center justify-between"><Label>Product image</Label><Switch checked={f.showImage} disabled={!f.imagePath} onCheckedChange={(v) => setF({ ...f, showImage: v })} /></div>
            <input ref={imageInput} type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={(e) => void uploadImage(e.target.files?.[0])} />
            <div className="flex flex-wrap gap-2"><Button type="button" size="sm" variant="outline" disabled={uploading} onClick={() => imageInput.current?.click()}>{uploading ? <Loader2 className="size-4 animate-spin" /> : <Upload className="size-4" />} {f.imagePath ? "Replace image" : "Upload image"}</Button>{f.imagePath && <Button type="button" size="sm" variant="ghost" onClick={() => { setF({ ...f, imagePath: "", showImage: false, imageAlt: "" }); setImagePreview(""); }}>Remove</Button>}</div>
            <p className="text-xs text-muted-foreground">Any photo works — it is auto-fitted to 16:9 (best: 1920×1080).</p>
            {f.imagePath && <Input placeholder="Image description for accessibility" value={f.imageAlt} onChange={(e) => setF({ ...f, imageAlt: e.target.value })} />}
          </div>
          <div className="space-y-2 rounded-lg border border-border p-3">
            <div className="flex items-center justify-between"><Label>Price &amp; offer</Label><Switch checked={f.showPrice} onCheckedChange={(v) => setF({ ...f, showPrice: v })} /></div>
            <div>
              <Label className="text-xs">Linked product (from Products tab)</Label>
              <select className={area} value={f.productId} onChange={(e) => pickProduct(e.target.value)}>
                <option value="">No product — fill price manually</option>
                {products.map((pr) => <option key={pr.id} value={pr.id}>{pr.name} · ₹{pr.price_paise / 100}{pr.active ? "" : " (inactive)"}</option>)}
              </select>
              {products.length === 0 && <p className="mt-1 text-xs text-muted-foreground">No products yet — add one in the Products tab to auto-fill the selling price.</p>}
              {f.productId && (() => { const pr = products.find((x) => x.id === f.productId); return pr && f.priceOffer && rupeesToPaise(f.priceOffer) !== pr.price_paise
                ? <p className="mt-1 text-xs text-destructive">Offer price (₹{f.priceOffer}) differs from the product price (₹{pr.price_paise / 100}) that buyers are charged.</p> : null; })()}
            </div>
            {f.showPrice && <>
              <div className="grid grid-cols-2 gap-2">
                <div><Label className="text-xs">Original price ₹ (crossed out)</Label><Input inputMode="decimal" placeholder="1999" value={f.priceOriginal} onChange={(e) => setF({ ...f, priceOriginal: e.target.value.replace(/[^\d.]/g, "") })} /></div>
                <div><Label className="text-xs">Offer price ₹</Label><Input inputMode="decimal" placeholder="999" value={f.priceOffer} onChange={(e) => setF({ ...f, priceOffer: e.target.value.replace(/[^\d.]/g, "") })} /></div>
              </div>
              {(() => { const d = priceDisplay(price?.originalPaise, price?.offerPaise); return d.original ? <p className="text-xs text-muted-foreground">Shows: <strong>{d.offer}</strong> <s>{d.original}</s> · {d.percent}% OFF</p> : f.priceOriginal && f.priceOffer ? <p className="text-xs text-destructive">Offer price must be lower than the original price to show a discount.</p> : null; })()}
              <Input placeholder="Discount label (optional, e.g. Diwali deal) — blank shows % OFF" value={f.discountLabel} onChange={(e) => setF({ ...f, discountLabel: e.target.value.slice(0, 40) })} />
              <Chips items={["Diwali deal", "Launch offer", "Limited time", "Early bird", "Flash sale", "Today only"]} onPick={(v) => setF({ ...f, discountLabel: v })} />
              <div>
                <Label className="text-xs">Coupon from a campaign (Coupons tab)</Label>
                <select className={area} value={f.couponCampaignId} onChange={(e) => pickCampaign(e.target.value)}>
                  <option value="">No campaign — use the static code below</option>
                  {storeCampaigns.map((c) => <option key={c.id} value={c.id}>{c.name} · {c.store_code || `${c.prefix}-…`} · {c.discount_label}</option>)}
                </select>
                {storeCampaigns.length === 0 && <p className="mt-1 text-xs text-muted-foreground">No active coupon campaigns yet — create one in the Coupons tab.</p>}
                {f.couponCampaignId && <p className="mt-1 text-xs text-muted-foreground">The campaign code and discount show on the page automatically and stop when the campaign ends.</p>}
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Input placeholder="Coupon code (e.g. SAVE50)" value={f.couponCode} onChange={(e) => setF({ ...f, couponCode: e.target.value.toUpperCase().replace(/[^A-Z0-9-]/g, "").slice(0, 30) })} />
                <Input placeholder="Coupon note (e.g. Use at checkout)" value={f.couponNote} onChange={(e) => setF({ ...f, couponNote: e.target.value.slice(0, 120) })} />
              </div>
              <p className="text-xs text-muted-foreground">Linked products determine the checkout price.</p>
            </>}
          </div>
          <div className="space-y-2 rounded-lg border border-border p-3">
            <Label>Honest offer countdown (optional)</Label>
            <Input type="datetime-local" value={f.countdown} onChange={(e) => setF({ ...f, countdown: e.target.value })} />
            {f.countdown && <><select className={area} value={f.expiryAction} onChange={(e) => setF({ ...f, expiryAction: e.target.value as typeof f.expiryAction })}><option value="disable_cta">Disable button when ended</option><option value="hide_cta">Hide button when ended</option></select><Input placeholder="Message after expiry" value={f.expiryMessage} onChange={(e) => setF({ ...f, expiryMessage: e.target.value })} /></>}
            <p className="text-xs text-muted-foreground">Uses one fixed deadline. It never restarts for each visitor.</p>
          </div>
          <ExtrasEditor accounts={accounts} value={f.extras} onChange={(extras) => setF({ ...f, extras })} onSaveCreator={() => { localStorage.setItem(creatorKey, JSON.stringify({ creatorName: f.extras.creatorName?.trim() ?? "", supportEmail: f.extras.supportEmail?.trim() ?? "", socials: cleanSocials(f.extras.socials) })); toast.success("Saved — new pages will be filled automatically"); }} />
          <div className="space-y-2 rounded-lg border border-border p-3">
            <Label>Lead form</Label>
            <div className="grid grid-cols-2 gap-2">
              <select className={area} value={f.formType} onChange={(e) => setF({ ...f, formType: e.target.value as PageForm["formType"] })}>
                <option value="none">No form — fastest purchase</option><option value="email">Email only</option><option value="full">Full lead form</option>
              </select>
              {f.formType !== "none" && <select className={area} value={f.formMode} onChange={(e) => setF({ ...f, formMode: e.target.value as PageForm["formMode"] })}>
                <option value="optional">Optional to fill</option><option value="required">Must fill to continue</option>
              </select>}
            </div>
            {f.formType === "full" && <LeadFieldsEditor fields={f.fields} onChange={(fields) => setF({ ...f, fields })} />}
            {f.formType !== "none" && fields.some((x) => x.type === "phone") && (
              <div className="flex items-center justify-between gap-2 rounded-md border border-border px-2 py-1.5">
                <Label className="text-xs">Verify phone by WhatsApp OTP</Label>
                <Switch checked={f.otpRequired} disabled={!whatsappOtp} onCheckedChange={(v) => setF({ ...f, otpRequired: v })} />
              </div>
            )}
            {f.formType !== "none" && fields.some((x) => x.type === "phone") && !whatsappOtp && (
              <p className="text-xs text-muted-foreground">WhatsApp OTP verification ke liye pehle Payments setup tab mein apna WhatsApp (Meta API) connect karo.</p>
            )}
            {badLead && <p className="text-xs text-destructive">Give every field a question, and every dropdown at least one option.</p>}
            <p className="text-xs text-muted-foreground">Best default: two quick questions in DM, then an optional detailed form after the offer.</p>
          </div>
          <div className="space-y-2 rounded-lg border border-border p-3">
          <Label>{autoCheckout ? "Automatic checkout" : "Main button — where buyers go"}</Label>
          <p className="text-xs text-muted-foreground">{autoCheckout ? "Razorpay connected — no manual payment link needed." : "Use an external payment link, or a download link for a free resource."}</p>
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
              <ContentFileField orgId={orgId} placeholder={autoCheckout ? "Content / deliverable link (optional page override)" : "Payment or download link (https://…)"} value={f.buttonUrl} onChange={(v) => setF({ ...f, buttonUrl: v })} />
              <FieldInfo
                title={autoCheckout ? "Deliverable link" : "Button link"}
                how={autoCheckout ? "Payment ke baad buyer ko ye content milega. Blank rakhen to linked product ka content use hoga." : "Button dabane par ye address khulega. https:// se shuru karein."}
                why="Button isi link par le jaata hai — galat ya adhoora link daala to visitor blank page par pahunchega."
                example={`https://yoursite.com/your-guide ya apna delivery page: ${origin}/p/free-guide`}
              />
            </div>
          </div>
          </div>
          <div className="flex gap-2">
            <Button onClick={submit} disabled={save.isPending || badLead}>{f.id ? "Update page" : "Save page"}</Button>
            {f.id && <Button variant="outline" onClick={reset}>Cancel</Button>}
          </div>
          <p className="text-xs text-muted-foreground">Put the page link in any DM button. Views and button clicks show in the Sales report.</p>
        </div>
      </Panel>
      </div>
      <Panel title="Your pages">
        {items.length === 0 ? <p className="text-sm text-muted-foreground">No pages yet.</p> : items.map((p) => { const n = leads.filter((l) => l.delivery_page_id === p.id).length; return (
          <div key={p.id} className={`mb-2 flex items-center justify-between gap-2 rounded-lg border p-3 text-sm ${f.id === p.id ? "border-primary" : "border-border"}`}>
            <div className="min-w-0"><p className="font-medium">{p.title}</p><p className="truncate text-muted-foreground">{origin}/p/{p.slug} · {p.views} views{n ? ` · ${n} leads` : ""}</p></div>
            <div className="flex">
              {<Button size="icon" variant="ghost" aria-label="View leads" title={`View leads (${n})`} onClick={() => setLeadsFor(leadsFor === p.id ? null : p.id)}><Users className="size-4" /></Button>}
              <Button size="icon" variant="ghost" aria-label="Edit page" onClick={() => void startEdit(p)}><Pencil className="size-4" /></Button>
              <Button size="icon" variant="ghost" aria-label="Copy link" onClick={() => { navigator.clipboard.writeText(`${origin}/p/${p.slug}`); toast.success("Link copied"); }}><Copy className="size-4" /></Button>
              <Button size="icon" variant="ghost" aria-label="Delete" onClick={() => { if (f.id === p.id) reset(); del.mutate({ organizationId: orgId, id: p.id, table: "delivery_pages" }); }}><Trash2 className="size-4" /></Button>
            </div>
          </div>); })}
        {leadsFor && <div className="mt-3 max-h-72 space-y-2 overflow-auto rounded-lg border border-border p-3">{pageLeads.length === 0 && <p className="text-xs text-muted-foreground">No leads on this page yet. Leads also show in Contacts → Delivery page leads.</p>}
          <p className="text-sm font-medium">Leads ({pageLeads.length})</p>
          {pageLeads.map((l) => { const st = STAGE_BADGE[l.answers["_stage"] ?? "completed"] ?? STAGE_BADGE["completed"]!; return <div key={l.id} className="rounded-md bg-muted p-2 text-xs"><div className="flex items-center justify-between gap-2"><p className="text-muted-foreground">{new Date(l.answers["_updated_at"] ?? l.created_at).toLocaleString()}</p><span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${st.cls}`}>{st.label}</span></div>{Object.entries(l.answers).filter(([k]) => !k.startsWith("_")).map(([k, v]) => <p key={k}><span className="text-muted-foreground">{k}:</span> {v}</p>)}</div>; })}
        </div>}
      </Panel>
    </div>
      <Panel title="Live preview">
        <div className="mb-3 inline-flex rounded-lg border border-border p-1">{(["desktop", "mobile"] as const).map((v) => <Button key={v} type="button" size="sm" variant={previewDevice === v ? "default" : "ghost"} onClick={() => setPreviewDevice(v)}>{v === "desktop" ? "Computer" : "Mobile"}</Button>)}</div>
        <div className={`mx-auto max-h-[720px] overflow-auto rounded-xl border border-border ${previewDevice === "mobile" ? "max-w-[390px] rounded-[2rem] border-4" : "w-full"}`}>
          <DeliveryPageView title={f.title || "Your page title"} body={f.body.trim() ? f.body : SAMPLE_BODY} buttonLabel={f.buttonLabel || "Get access"} buttonHref="#"
            imageUrl={f.showImage ? imagePreview : null} imagePlaceholder={!(f.showImage && imagePreview)} imageAlt={f.imageAlt} countdownAt={f.countdown ? new Date(f.countdown).toISOString() : null} expiryAction={f.expiryAction} expiryMessage={f.expiryMessage} price={price} key={JSON.stringify(fields)} leadForm={{ preview: true, config: formConfig }} buyerSlug={f.slug || slugify(f.title) || "preview"} />
        </div>
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
            <p>Razorpay connected · Automatic checkout active</p>
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
      <WhatsappOtpPanel orgId={orgId} d={d} />
    </div>
  );
}

function WhatsappOtpPanel({ orgId, d }: { orgId: string; d: Data }) {
  const saveOtp = useSave(useServerFn(saveWhatsappOtpSettings), "WhatsApp OTP connected");
  const removeOtp = useSave(useServerFn(removeWhatsappOtpSettings), "WhatsApp OTP removed");
  const [w, setW] = useState({ phoneNumberId: "", accessToken: "", templateName: "", templateLanguage: "en" });
  return (
    <Panel title="WhatsApp OTP (phone verification)">
      {d.whatsappOtp ? (
        <div className="space-y-3 text-sm">
          <p>Connected — template <span className="font-mono">{d.whatsappOtp.templateName}</span>. Delivery pages can now verify lead phone numbers with a WhatsApp code.</p>
          <Button variant="outline" onClick={() => removeOtp.mutate({ organizationId: orgId })}>Disconnect</Button>
        </div>
      ) : (
        <div className="space-y-2">
          <p className="text-sm text-muted-foreground">Apne WhatsApp Business (Meta Cloud API) se delivery page ke phone numbers verify karo. Meta Business Suite → WhatsApp → API setup se ye details milengi. Token sirf server par encrypted rehta hai — kabhi browser mein nahi aata.</p>
          <Input placeholder="Phone number ID (digits only)" inputMode="numeric" value={w.phoneNumberId} onChange={(e) => setW({ ...w, phoneNumberId: e.target.value.replace(/\D/g, "") })} />
          <Input type="password" placeholder="Permanent access token" value={w.accessToken} onChange={(e) => setW({ ...w, accessToken: e.target.value })} />
          <div className="grid grid-cols-2 gap-2">
            <Input placeholder="Authentication template name" value={w.templateName} onChange={(e) => setW({ ...w, templateName: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, "") })} />
            <Input placeholder="Language (e.g. en or en_US)" value={w.templateLanguage} onChange={(e) => setW({ ...w, templateLanguage: e.target.value })} />
          </div>
          <Button disabled={saveOtp.isPending || !w.phoneNumberId || !w.accessToken || !w.templateName}
            onClick={() => saveOtp.mutate({ organizationId: orgId, ...w }, { onSuccess: () => setW({ phoneNumberId: "", accessToken: "", templateName: "", templateLanguage: "en" }) })}>Connect WhatsApp OTP</Button>
          <p className="text-xs text-muted-foreground">Template ka body variable {"{{1}}"} Meta apne aap OTP se badal deta hai — code kabhi browser tak nahi pahunchta. Ek number par 1 ghante mein max 3 codes, har code 5 minute valid.</p>
        </div>
      )}
    </Panel>
  );
}

function FieldInfo({ title, how, why, example }: { title: string; how: string; why: string; example?: string }) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button type="button" size="icon" variant="ghost" className="size-8 shrink-0 text-muted-foreground" aria-label={`About ${title}`}>
          <Info className="size-4" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 max-w-[calc(100vw-2rem)]">
        <p className="text-sm font-semibold">{title}</p>
        <div className="mt-3 space-y-3 text-sm">
          <div>
            <p className="font-medium">How it works</p>
            <p className="mt-1 text-muted-foreground">{how}</p>
          </div>
          <div>
            <p className="font-medium">Why it matters</p>
            <p className="mt-1 text-muted-foreground">{why}</p>
          </div>
          {example ? (
            <div>
              <p className="font-medium">Example</p>
              <p className="mt-1 break-words font-mono text-xs text-muted-foreground">{example}</p>
            </div>
          ) : null}
        </div>
      </PopoverContent>
    </Popover>
  );
}

function cleanExtras(x: PageExtras): PageExtras {
  const t = (v?: string) => (v ?? "").trim() || undefined;
  return {
    creatorName: t(x.creatorName), supportEmail: t(x.supportEmail), disclaimer: t(x.disclaimer),
    deliverables: { count: t(x.deliverables?.count), format: t(x.deliverables?.format), size: t(x.deliverables?.size) },
    policies: { refund: t(x.policies?.refund), fulfilment: t(x.policies?.fulfilment), privacy: t(x.policies?.privacy), terms: t(x.policies?.terms) },
    charges: { gstPercent: x.charges?.gstPercent || undefined, passFee: x.charges?.passFee || undefined },
    socials: cleanSocials(x.socials),
  };
}

function SocialsEditor({ accounts, value, onChange }: { accounts: Data["accounts"]; value: SocialLink[]; onChange: (v: SocialLink[]) => void }) {
  const has = (url: string) => value.some((s) => s.url === url);
  const manual = (p: SocialLink["platform"]) => value.find((s) => s.platform === p && !accounts.some((a) => connectedAccountUrl(a) === s.url))?.url ?? "";
  const setManual = (p: SocialLink["platform"], input: string) => {
    const rest = value.filter((s) => !(s.platform === p && !accounts.some((a) => connectedAccountUrl(a) === s.url)));
    onChange(input.trim() ? [...rest, { platform: p, url: input.trim() }] : rest);
  };
  return (
    <div className="space-y-2">
      <Label>Social links (shown as icons in page header & footer)</Label>
      {accounts.length > 0 && <div className="space-y-1.5">
        <p className="text-xs text-muted-foreground">Connected accounts — tick the ones to show:</p>
        {accounts.map((a) => { const url = connectedAccountUrl(a); if (!url) return null; return (
          <label key={a.id} className="flex items-center gap-2 text-sm"><input type="checkbox" checked={has(url)} onChange={(e) => onChange(e.target.checked ? [...value, { platform: a.platform as SocialLink["platform"], url, label: a.name }] : value.filter((s) => s.url !== url))} />
            <SocialIcon platform={a.platform as SocialLink["platform"]} className="size-4" /> {a.name}{a.handle ? ` (@${a.handle.replace(/^@/, "")})` : ""}</label>
        ); })}
      </div>}
      <div className="grid gap-2 sm:grid-cols-2">
        {SOCIAL_PLATFORMS.map((p) => (
          <div key={p} className="flex items-center gap-2"><SocialIcon platform={p} className="size-4 shrink-0 text-muted-foreground" />
            <Input placeholder={`${SOCIAL_LABELS[p]} link or @handle`} maxLength={300} value={manual(p)} onChange={(e) => setManual(p, e.target.value)} onBlur={(e) => { const n = normalizeSocialUrl(p, e.target.value); if (e.target.value && !n) toast.error(`Enter a valid ${SOCIAL_LABELS[p]} link`); setManual(p, n); }} /></div>
        ))}
      </div>
      <p className="text-xs text-muted-foreground">Use "Save for next pages" below to keep these for every new page.</p>
    </div>
  );
}

const POLICY_LABELS = [["refund", "Refund policy"], ["fulfilment", "Fulfilment policy"], ["privacy", "Privacy policy"], ["terms", "Terms & conditions"]] as const;

function ExtrasEditor({ value, onChange, onSaveCreator, accounts }: { accounts: Data["accounts"]; value: PageExtras; onChange: (v: PageExtras) => void; onSaveCreator: () => void }) {
  const d = value.deliverables ?? {}; const pol = value.policies ?? {};
  return (
    <div className="space-y-4 rounded-lg border border-border p-3">
      <div className="space-y-2">
        <Label>GST & processing fee (added on top of selling price)</Label>
        <div className="flex flex-wrap items-center gap-2">
          {[0, 5, 12, 18, 28].map((g) => (
            <Button key={g} type="button" size="sm" variant={(value.charges?.gstPercent ?? 0) === g ? "default" : "outline"} onClick={() => onChange({ ...value, charges: { ...value.charges, gstPercent: g } })}>{g === 0 ? "No GST" : `GST ${g}%`}</Button>
          ))}
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={!!value.charges?.passFee} onChange={(e) => onChange({ ...value, charges: { ...value.charges, passFee: e.target.checked } })} />
          Buyer pays Razorpay processing fee (2% + 18% GST on fee = 2.36%)
        </label>
        <p className="text-xs text-muted-foreground">Calculated automatically from the product's selling price and shown to buyers as a price breakdown.</p>
      </div>
      <SocialsEditor accounts={accounts} value={value.socials ?? []} onChange={(socials) => onChange({ ...value, socials })} />
      <div className="space-y-2">
        <div className="flex items-center justify-between gap-2"><Label>Creator & support (optional)</Label>
          <Button type="button" size="sm" variant="outline" disabled={!value.creatorName?.trim() && !value.supportEmail?.trim() && !value.socials?.length} onClick={onSaveCreator}>Save for next pages</Button></div>
        <div className="grid gap-2 sm:grid-cols-2">
          <Input placeholder="Creator name (e.g. Techaasvik)" maxLength={80} value={value.creatorName ?? ""} onChange={(e) => onChange({ ...value, creatorName: e.target.value })} />
          <Input type="email" placeholder="Support email" maxLength={120} value={value.supportEmail ?? ""} onChange={(e) => onChange({ ...value, supportEmail: e.target.value })} />
        </div>
      </div>
      <div className="space-y-2">
        <Label>"What you'll get" box (optional)</Label>
        <Chips label="Quick fill" items={DELIVERABLE_PRESETS.map((x) => x[0])} onPick={(v) => { const x = DELIVERABLE_PRESETS.find((y) => y[0] === v)!; onChange({ ...value, deliverables: { count: x[1], format: x[2], size: x[3] } }); }} />
        <div className="grid gap-2 sm:grid-cols-3">
          <Input placeholder="Items (e.g. 2 resources)" maxLength={40} value={d.count ?? ""} onChange={(e) => onChange({ ...value, deliverables: { ...d, count: e.target.value } })} />
          <Input placeholder="Format (e.g. PDF, Video)" maxLength={40} value={d.format ?? ""} onChange={(e) => onChange({ ...value, deliverables: { ...d, format: e.target.value } })} />
          <Input placeholder="Size (e.g. 21 MB)" maxLength={40} value={d.size ?? ""} onChange={(e) => onChange({ ...value, deliverables: { ...d, size: e.target.value } })} />
        </div>
        <Chips label="Items" items={["1 resource", "2 resources", "5 resources", "12 lessons", "50+ templates"]} onPick={(v) => onChange({ ...value, deliverables: { ...d, count: v } })} />
        <Chips label="Format" items={["PDF", "MP4 Video", "Canva link", "Audio", "ZIP file", "Google Meet"]} onPick={(v) => onChange({ ...value, deliverables: { ...d, format: v } })} />
        <Chips label="Size" items={["Instant access", "5 MB", "15 MB", "250 MB", "1.5 GB", "30 mins"]} onPick={(v) => onChange({ ...value, deliverables: { ...d, size: v } })} />
      </div>
      <div className="space-y-2">
        <div className="flex items-center justify-between gap-2">
          <Label>Policies & compliance (optional)</Label>
          <Button type="button" size="sm" variant="outline" onClick={() => onChange({ ...value, policies: { ...DEFAULT_POLICIES, ...Object.fromEntries(Object.entries(pol).filter(([, v]) => v)) }, disclaimer: value.disclaimer || DEFAULT_DISCLAIMER })}>Fill standard text</Button>
        </div>
        {POLICY_LABELS.map(([k, label]) => (
          <div key={k} className="space-y-1">
            <p className="text-xs text-muted-foreground">{label}</p>
            <textarea className="min-h-16 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" maxLength={1500} value={pol[k] ?? ""} onChange={(e) => onChange({ ...value, policies: { ...pol, [k]: e.target.value } })} />
          </div>
        ))}
        <p className="text-xs text-muted-foreground">Disclaimer (shown at the bottom)</p>
        <textarea className="min-h-16 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" maxLength={1500} value={value.disclaimer ?? ""} onChange={(e) => onChange({ ...value, disclaimer: e.target.value })} />
        <p className="text-xs text-muted-foreground">Blank items are hidden on the page. Review the standard text so it matches how you really sell.</p>
      </div>
    </div>
  );
}

const DELIVERABLE_PRESETS: [string, string, string, string][] = [
  ["E-book & checklist", "2 resources", "PDF", "15 MB"],
  ["Video masterclass", "12 HD lessons", "MP4 Video", "2.4 GB"],
  ["Canva templates", "50+ templates", "Canva link", "Instant access"],
  ["1:1 consultation", "1 session", "Google Meet", "30 mins"],
  ["Prompts pack", "100+ prompts", "PDF / Notion", "5 MB"],
];

const PRODUCT_PRESETS = [
  { name: "E-book / PDF guide", price: "199", mrp: "499", desc: "Instant PDF download" },
  { name: "Online course", price: "999", mrp: "2999", desc: "Lifetime access to all lessons" },
  { name: "1:1 Consultation (30 min)", price: "1499", mrp: "2499", desc: "Personal video call" },
  { name: "Presets bundle", price: "499", mrp: "1499", desc: "Ready-to-use presets pack" },
  { name: "Community access", price: "499", mrp: "999", desc: "Private group membership" },
];

function Chips({ items, onPick, label = "Samples" }: { items: string[]; onPick: (v: string) => void; label?: string }) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span className="text-[11px] text-muted-foreground">{label}:</span>
      {items.map((v) => <button key={v} type="button" onClick={() => onPick(v)} className="rounded-full border border-border bg-muted px-2.5 py-0.5 text-xs text-muted-foreground hover:border-primary hover:text-primary">+ {v}</button>)}
    </div>
  );
}
