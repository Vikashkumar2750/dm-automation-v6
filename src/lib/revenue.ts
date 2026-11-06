/** Phase E revenue: pure helpers (client-safe). */

/** A linked product is authoritative; inactive products cannot be sold. */
export function checkoutAmount(pageAmount: number | null, product: { price_paise: number; active: boolean } | null, linked: boolean): number | null {
  const amount = linked ? (product?.active ? product.price_paise : null) : pageAmount;
  return amount !== null && Number.isInteger(amount) && amount >= 100 ? amount : null;
}

/** Razorpay standard domestic fee: 2% + 18% GST on that fee = 2.36% of the charged amount. */
export const RAZORPAY_FEE_RATE = 0.0236;
export type PageCharges = { gstPercent?: number | undefined; passFee?: boolean | undefined };
export type ChargeBreakdown = { basePaise: number; gstPaise: number; feePaise: number; totalPaise: number };

/** GST is added on the selling price; the processing fee is grossed up so the creator still nets price + GST. */
export function withCharges(basePaise: number, c?: PageCharges | null): ChargeBreakdown {
  const pct = Math.min(Math.max(Number(c?.gstPercent) || 0, 0), 28);
  const gstPaise = Math.round((basePaise * pct) / 100);
  const subtotal = basePaise + gstPaise;
  const totalPaise = c?.passFee ? Math.ceil(subtotal / (1 - RAZORPAY_FEE_RATE)) : subtotal;
  return { basePaise, gstPaise, feePaise: totalPaise - subtotal, totalPaise };
}

export function automaticCheckout(connected: boolean, amount: number | null): boolean {
  return connected && amount !== null && amount >= 100;
}

export function formatInr(paise: number): string {
  return `₹${(paise / 100).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
}

/** Rupees typed by the user → paise. Returns null below Razorpay's ₹1 minimum. */
export function rupeesToPaise(v: string | number): number | null {
  const n = Math.round(Number(v) * 100);
  return Number.isFinite(n) && n >= 100 ? n : null;
}

const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no 0/O/1/I confusion

export function makeCouponCode(prefix: string, random: () => number = Math.random): string {
  let tail = "";
  for (let i = 0; i < 6; i++) tail += ALPHABET[Math.floor(random() * ALPHABET.length)];
  return `${prefix.toUpperCase()}-${tail}`;
}

export function slugify(t: string): string {
  return t.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60);
}

export type FunnelInput = {
  dmsSent: number;
  pageViews: number;
  pageClicks: number;
  paymentLinks: number;
  paid: number;
  revenuePaise: number;
};

export type FunnelStep = { label: string; value: number; rate: number | null };

/** Comment → DM → page → click → payment link → paid, with step-to-step conversion %. */
export function buildFunnel(f: FunnelInput): FunnelStep[] {
  const raw: [string, number][] = [
    ["DMs sent", f.dmsSent],
    ["Page views", f.pageViews],
    ["Button clicks", f.pageClicks],
    ["Payment links sent", f.paymentLinks],
    ["Paid", f.paid],
  ];
  return raw.map(([label, value], i) => {
    const prev = i === 0 ? null : raw[i - 1]![1];
    return { label, value, rate: prev ? Math.round((value / prev) * 1000) / 10 : null };
  });
}

/** True when a payment link should get its one reminder now (inside Meta's 24h window). */
export function nudgeDue(
  link: { status: string; nudged_at: string | null; created_at: string },
  lastInboundAt: string | null,
  delayMinutes: number,
  now = Date.now(),
): boolean {
  if (link.status !== "created" || link.nudged_at) return false;
  const created = new Date(link.created_at).getTime();
  if (now - created < delayMinutes * 60_000) return false;
  if (!lastInboundAt) return false;
  // Keep a 30-minute safety margin before Meta's 24-hour window closes.
  return now - new Date(lastInboundAt).getTime() < 23.5 * 3600_000;
}

export type CouponDiscount = { type: "percent"; value: number } | { type: "flat"; paise: number };

/** "20% off", "20%", "₹100 off", "Rs 100", "100 OFF" → discount. Unknown → null. */
export function parseDiscount(label: string | null | undefined): CouponDiscount | null {
  const s = (label ?? "").replace(/,/g, "");
  const pct = s.match(/(\d+(?:\.\d+)?)\s*%/);
  if (pct) { const v = Number(pct[1]); return v > 0 && v <= 100 ? { type: "percent", value: v } : null; }
  const flat = s.match(/(\d+(?:\.\d+)?)/);
  if (flat) { const p = Math.round(Number(flat[1]) * 100); return p > 0 ? { type: "flat", paise: p } : null; }
  return null;
}

/** Coupons are taken off the maximum price (MRP); without an MRP the selling price is the base. Never below ₹1. */
export function couponPrice(mrpPaise: number | null, sellingPaise: number, d: CouponDiscount): { basePaise: number; discountPaise: number; pricePaise: number } {
  const base = mrpPaise && mrpPaise > sellingPaise ? mrpPaise : sellingPaise;
  const raw = d.type === "percent" ? Math.round((base * d.value) / 100) : d.paise;
  const pricePaise = Math.max(100, base - raw);
  return { basePaise: base, discountPaise: base - pricePaise, pricePaise };
}
