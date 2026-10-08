import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Copy, IndianRupee, Info, Loader2, Pencil, Plus, Trash2, Upload, Users } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { AppShell } from "@/components/app/AppShell";
import { GuideButton } from "@/components/app/GuideButton";
import { EmptyState, PageHeader, Panel, StatusBadge } from "@/components/app/primitives";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useTenant } from "@/hooks/useTenant";
import { buildFunnel, formatInr, rupeesToPaise, slugify } from "@/lib/revenue";
import { DeliveryPageView } from "@/components/app/DeliveryPageView";
import { DELIVERY_TEMPLATES, EMAIL_ONLY_FIELDS, STANDARD_LEAD_FIELDS, priceDisplay, type LeadField } from "@/lib/delivery-page";
import { DeliveryLeadForm } from "@/components/app/DeliveryLeadForm";
import { previewDeliveryImage, uploadDeliveryImage } from "@/lib/delivery-media";
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
          <TabsContent value="pages"><Pages orgId={orgId!} items={d.pages} leads={d.leads} /></TabsContent>
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

type PageForm = {
  id: string | null; title: string; slug: string; originalSlug: string; body: string; buttonLabel: string; buttonUrl: string; imagePath: string; imageAlt: string; showImage: boolean;
  countdown: string; expiryAction: "disable_cta" | "hide_cta"; expiryMessage: string;
  formType: "none" | "email" | "full"; formMode: "optional" | "required"; fields: LeadField[];
  showPrice: boolean; priceOriginal: string; priceOffer: string; discountLabel: string; couponCode: string; couponNote: string;
};
const EMPTY_PAGE: PageForm = {
  id: null, title: "", slug: "", originalSlug: "", body: "", buttonLabel: "", buttonUrl: "", imagePath: "", imageAlt: "", showImage: false, countdown: "", expiryAction: "disable_cta",
  expiryMessage: "This offer has ended.", formType: "none", formMode: "optional", fields: STANDARD_LEAD_FIELDS,
  showPrice: false, priceOriginal: "", priceOffer: "", discountLabel: "", couponCode: "", couponNote: "",
};
const CONSENT = "I agree that my details may be used to fulfil this request and follow up about this offer.";
const toLocalInput = (iso: string | null) => { if (!iso) return ""; const d = new Date(iso); return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16); };
const paiseToRupees = (p: number | null) => (p ? String(p / 100) : "");

function pageToForm(p: any): PageForm {
  const cfg = (p.form_config ?? { mode: "none", fields: [] }) as { mode: string; fields?: LeadField[] };
  const fields = cfg.fields ?? [];
  const emailOnly = fields.length === 1 && fields[0]?.type === "email";
  return {
    ...EMPTY_PAGE, id: p.id, title: p.title ?? "", slug: p.slug ?? "", originalSlug: p.slug ?? "", body: p.body ?? "", buttonLabel: p.button_label ?? "", buttonUrl: p.button_url ?? "",
    imagePath: p.image_path ?? "", imageAlt: p.image_alt ?? "", showImage: !!p.show_image, countdown: toLocalInput(p.countdown_at), expiryAction: p.expiry_action ?? "disable_cta",
    expiryMessage: p.expiry_message ?? "This offer has ended.",
    formType: cfg.mode === "none" || fields.length === 0 ? "none" : emailOnly ? "email" : "full", formMode: cfg.mode === "required" ? "required" : "optional",
    fields: emailOnly || fields.length === 0 ? STANDARD_LEAD_FIELDS : fields,
    showPrice: !!p.show_price, priceOriginal: paiseToRupees(p.price_original_paise), priceOffer: paiseToRupees(p.price_offer_paise),
    discountLabel: p.discount_label ?? "", couponCode: p.coupon_code ?? "", couponNote: p.coupon_note ?? "",
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

function Pages({ orgId, items, leads }: { orgId: string; items: any[]; leads: Array<{ id: string; delivery_page_id: string; answers: Record<string, string>; created_at: string }> }) {
  const save = useSave(useServerFn(savePage), "Page saved");
  const del = useSave(useServerFn(deleteRevenueItem), "Deleted");
  const [f, setF] = useState<PageForm>(EMPTY_PAGE);
  const [imagePreview, setImagePreview] = useState("");
  const [uploading, setUploading] = useState(false);
  const [leadsFor, setLeadsFor] = useState<string | null>(null);
  const imageInput = useRef<HTMLInputElement>(null);
  const formTop = useRef<HTMLDivElement>(null);
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const reset = () => { setF(EMPTY_PAGE); setImagePreview(""); };
  const startEdit = async (p: any) => {
    setF(pageToForm(p)); setImagePreview("");
    formTop.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    if (p.image_path) { try { setImagePreview(await previewDeliveryImage(p.image_path)); } catch { /* preview only */ } }
  };
  const fields = formFields(f);
  const formConfig = { mode: f.formType === "none" ? "none" as const : f.formMode, consent: f.formType === "none" ? "" : CONSENT, fields };
  const price = f.showPrice ? { originalPaise: f.priceOriginal ? rupeesToPaise(f.priceOriginal) : null, offerPaise: f.priceOffer ? rupeesToPaise(f.priceOffer) : null, label: f.discountLabel || null, couponCode: f.couponCode.trim().toUpperCase() || null, couponNote: f.couponNote || null } : null;
  const badLead = f.formType === "full" && (fields.length === 0 || fields.some((x) => !x.label.trim() || (x.type === "choice" && x.options.length === 0)));
  const submit = () => save.mutate({
    organizationId: orgId, id: f.id ?? undefined, title: f.title, slug: f.slug || slugify(f.title), body: f.body || null,
    buttonLabel: f.buttonLabel || null, buttonUrl: f.buttonUrl || null, active: true, imagePath: f.imagePath || null, showImage: f.showImage,
    imageAlt: f.imageAlt || null, countdownAt: f.countdown ? new Date(f.countdown).toISOString() : null, expiryAction: f.expiryAction, expiryMessage: f.expiryMessage || null,
    formConfig: { ...formConfig, fields: fields.map((x) => ({ ...x, label: x.label.trim() })) },
    showPrice: f.showPrice, priceOriginalPaise: price?.originalPaise ?? null, priceOfferPaise: price?.offerPaise ?? null,
    discountLabel: f.discountLabel || null, couponCode: f.couponCode.trim() || null, couponNote: f.couponNote || null,
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
                  onClick={() => setF({ ...f, title: t.title, slug: f.slug || t.slug, body: t.body, buttonLabel: f.buttonLabel || t.buttonLabel })}>
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
            <input ref={imageInput} type="file" accept="image/*" className="hidden" onChange={(e) => void uploadImage(e.target.files?.[0])} />
            <div className="flex flex-wrap gap-2"><Button type="button" size="sm" variant="outline" disabled={uploading} onClick={() => imageInput.current?.click()}>{uploading ? <Loader2 className="size-4 animate-spin" /> : <Upload className="size-4" />} {f.imagePath ? "Replace image" : "Upload image"}</Button>{f.imagePath && <Button type="button" size="sm" variant="ghost" onClick={() => { setF({ ...f, imagePath: "", showImage: false, imageAlt: "" }); setImagePreview(""); }}>Remove</Button>}</div>
            {f.imagePath && <Input placeholder="Image description for accessibility" value={f.imageAlt} onChange={(e) => setF({ ...f, imageAlt: e.target.value })} />}
          </div>
          <div className="space-y-2 rounded-lg border border-border p-3">
            <div className="flex items-center justify-between"><Label>Price &amp; offer</Label><Switch checked={f.showPrice} onCheckedChange={(v) => setF({ ...f, showPrice: v })} /></div>
            {f.showPrice && <>
              <div className="grid grid-cols-2 gap-2">
                <div><Label className="text-xs">Original price ₹ (crossed out)</Label><Input inputMode="decimal" placeholder="1999" value={f.priceOriginal} onChange={(e) => setF({ ...f, priceOriginal: e.target.value.replace(/[^\d.]/g, "") })} /></div>
                <div><Label className="text-xs">Offer price ₹</Label><Input inputMode="decimal" placeholder="999" value={f.priceOffer} onChange={(e) => setF({ ...f, priceOffer: e.target.value.replace(/[^\d.]/g, "") })} /></div>
              </div>
              {(() => { const d = priceDisplay(price?.originalPaise, price?.offerPaise); return d.original ? <p className="text-xs text-muted-foreground">Shows: <strong>{d.offer}</strong> <s>{d.original}</s> · {d.percent}% OFF</p> : f.priceOriginal && f.priceOffer ? <p className="text-xs text-destructive">Offer price must be lower than the original price to show a discount.</p> : null; })()}
              <Input placeholder="Discount label (optional, e.g. Diwali deal) — blank shows % OFF" value={f.discountLabel} onChange={(e) => setF({ ...f, discountLabel: e.target.value.slice(0, 40) })} />
              <div className="grid grid-cols-2 gap-2">
                <Input placeholder="Coupon code (e.g. SAVE50)" value={f.couponCode} onChange={(e) => setF({ ...f, couponCode: e.target.value.toUpperCase().replace(/[^A-Z0-9-]/g, "").slice(0, 30) })} />
                <Input placeholder="Coupon note (e.g. Use at checkout)" value={f.couponNote} onChange={(e) => setF({ ...f, couponNote: e.target.value.slice(0, 120) })} />
              </div>
              <p className="text-xs text-muted-foreground">Display only. The amount charged is your product price in the payment link — keep them the same.</p>
            </>}
          </div>
          <div className="space-y-2 rounded-lg border border-border p-3">
            <Label>Honest offer countdown (optional)</Label>
            <Input type="datetime-local" value={f.countdown} onChange={(e) => setF({ ...f, countdown: e.target.value })} />
            {f.countdown && <><select className={area} value={f.expiryAction} onChange={(e) => setF({ ...f, expiryAction: e.target.value as typeof f.expiryAction })}><option value="disable_cta">Disable button when ended</option><option value="hide_cta">Hide button when ended</option></select><Input placeholder="Message after expiry" value={f.expiryMessage} onChange={(e) => setF({ ...f, expiryMessage: e.target.value })} /></>}
            <p className="text-xs text-muted-foreground">Uses one fixed deadline. It never restarts for each visitor.</p>
          </div>
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
            {badLead && <p className="text-xs text-destructive">Give every field a question, and every dropdown at least one option.</p>}
            <p className="text-xs text-muted-foreground">Best default: two quick questions in DM, then an optional detailed form after the offer.</p>
          </div>
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
                example={`https://yoursite.com/your-guide ya apna delivery page: ${origin}/p/free-guide`}
              />
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
              {n > 0 && <Button size="icon" variant="ghost" aria-label="View leads" onClick={() => setLeadsFor(leadsFor === p.id ? null : p.id)}><Users className="size-4" /></Button>}
              <Button size="icon" variant="ghost" aria-label="Edit page" onClick={() => void startEdit(p)}><Pencil className="size-4" /></Button>
              <Button size="icon" variant="ghost" aria-label="Copy link" onClick={() => { navigator.clipboard.writeText(`${origin}/p/${p.slug}`); toast.success("Link copied"); }}><Copy className="size-4" /></Button>
              <Button size="icon" variant="ghost" aria-label="Delete" onClick={() => { if (f.id === p.id) reset(); del.mutate({ organizationId: orgId, id: p.id, table: "delivery_pages" }); }}><Trash2 className="size-4" /></Button>
            </div>
          </div>); })}
        {leadsFor && <div className="mt-3 max-h-72 space-y-2 overflow-auto rounded-lg border border-border p-3">
          <p className="text-sm font-medium">Leads ({pageLeads.length})</p>
          {pageLeads.map((l) => <div key={l.id} className="rounded-md bg-muted p-2 text-xs"><p className="text-muted-foreground">{new Date(l.created_at).toLocaleString()}</p>{Object.entries(l.answers).map(([k, v]) => <p key={k}><span className="text-muted-foreground">{k}:</span> {v}</p>)}</div>)}
        </div>}
      </Panel>
    </div>
      <Panel title="Live preview">
        <div className="max-h-[640px] overflow-auto rounded-xl border border-border">
          <DeliveryPageView title={f.title || "Your page title"} body={f.body} buttonLabel={f.buttonLabel} buttonHref={f.buttonUrl ? "#" : null}
            imageUrl={f.showImage ? imagePreview : null} imageAlt={f.imageAlt} countdownAt={f.countdown ? new Date(f.countdown).toISOString() : null} expiryAction={f.expiryAction} expiryMessage={f.expiryMessage} price={price} />
          {formConfig.mode !== "none" && fields.length > 0 && <div className="mx-auto max-w-2xl px-6 pb-10"><DeliveryLeadForm key={JSON.stringify(fields)} preview config={formConfig} /></div>}
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
