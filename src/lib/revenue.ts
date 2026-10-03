/** Phase E revenue: pure helpers (client-safe). */

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
