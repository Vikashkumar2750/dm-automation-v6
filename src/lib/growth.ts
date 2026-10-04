/** Phase I — growth intelligence pure helpers (no I/O). */

export const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;
/** India time offset used for hour buckets (creators are IST-first). */
export const IST_OFFSET_MIN = 330;

export function istBucket(iso: string): { day: number; hour: number } {
  const d = new Date(Date.parse(iso) + IST_OFFSET_MIN * 60_000);
  return { day: d.getUTCDay(), hour: d.getUTCHours() };
}

/** 7×24 grid of engagement counts (IST). */
export function engagementGrid(timestamps: string[]): number[][] {
  const grid = Array.from({ length: 7 }, () => Array<number>(24).fill(0));
  for (const t of timestamps) {
    if (!Number.isFinite(Date.parse(t))) continue;
    const { day, hour } = istBucket(t);
    grid[day]![hour]! += 1;
  }
  return grid;
}

export type BestSlot = { day: number; hour: number; count: number; label: string };

/** Top slots by engagement; needs at least `minEvents` data points, else []. */
export function bestTimes(grid: number[][], top = 3, minEvents = 10): BestSlot[] {
  const total = grid.flat().reduce((a, b) => a + b, 0);
  if (total < minEvents) return [];
  const slots: BestSlot[] = [];
  grid.forEach((row, day) => row.forEach((count, hour) => {
    if (count > 0) slots.push({ day, hour, count, label: `${WEEKDAYS[day]} ${hourLabel(hour)}` });
  }));
  return slots.sort((a, b) => b.count - a.count || a.day - b.day || a.hour - b.hour).slice(0, top);
}

export function hourLabel(h: number): string {
  const ampm = h < 12 ? "AM" : "PM";
  const v = h % 12 === 0 ? 12 : h % 12;
  return `${v} ${ampm}`;
}

export type FunnelStage = "triggered" | "dm_sent" | "page_open" | "click" | "sale";
export const FUNNEL_STAGES: { key: FunnelStage; label: string }[] = [
  { key: "triggered", label: "Comment / DM" },
  { key: "dm_sent", label: "DM sent" },
  { key: "page_open", label: "Page opened" },
  { key: "click", label: "Link clicked" },
  { key: "sale", label: "Sale" },
];

/** Funnel heatmap: stage × weekday counts plus stage-to-stage conversion %. */
export function funnelHeatmap(events: { stage: FunnelStage; at: string }[]) {
  const rows = Object.fromEntries(FUNNEL_STAGES.map((s) => [s.key, Array<number>(7).fill(0)])) as Record<FunnelStage, number[]>;
  for (const e of events) {
    if (!rows[e.stage] || !Number.isFinite(Date.parse(e.at))) continue;
    rows[e.stage][istBucket(e.at).day]! += 1;
  }
  const totals = FUNNEL_STAGES.map((s) => rows[s.key].reduce((a, b) => a + b, 0));
  const conversion = totals.map((t, i) => (i === 0 ? 100 : totals[i - 1]! > 0 ? Math.round((t / totals[i - 1]!) * 100) : 0));
  const max = Math.max(1, ...Object.values(rows).flat());
  return { rows, totals, conversion, max };
}

export type Anomaly = { metric: string; severity: "warning" | "danger"; message: string; today: number; baseline: number };

/**
 * Compare the last 24h against the previous 7-day daily average.
 * `drop` metrics alert when they fall; `spike` metrics alert when they rise.
 */
export function detectAnomalies(
  metrics: { key: string; label: string; last24h: number; prev7d: number; kind: "drop" | "spike" }[],
): Anomaly[] {
  const out: Anomaly[] = [];
  for (const m of metrics) {
    const baseline = m.prev7d / 7;
    if (m.kind === "drop") {
      if (baseline < 5) continue; // too little history to judge
      const ratio = m.last24h / baseline;
      if (ratio <= 0.5) out.push({ metric: m.key, today: m.last24h, baseline: round(baseline), severity: ratio <= 0.2 ? "danger" : "warning", message: `${m.label} fell to ${m.last24h} in the last 24h (usual ~${round(baseline)}/day).` });
    } else {
      const floor = Math.max(baseline * 2, baseline + 5);
      if (m.last24h >= floor && m.last24h >= 5) out.push({ metric: m.key, today: m.last24h, baseline: round(baseline), severity: m.last24h >= Math.max(baseline * 4, 20) ? "danger" : "warning", message: `${m.label} jumped to ${m.last24h} in the last 24h (usual ~${round(baseline)}/day).` });
    }
  }
  return out;
}

const round = (n: number) => Math.round(n * 10) / 10;

export type Benchmark = { name: string; followers: number; postsPerWeek: number; avgComments: number; engagementRate: number; isYou?: boolean };

/** Engagement rate % = avg comments per post / followers × 100. */
export function engagementRate(followers: number, avgComments: number): number {
  if (followers <= 0) return 0;
  return Math.round((avgComments / followers) * 10000) / 100;
}

/** Short tips comparing you with the competitor average. */
export function benchmarkTips(you: Benchmark, others: Benchmark[]): string[] {
  if (!others.length) return [];
  const avg = (f: (b: Benchmark) => number) => others.reduce((a, b) => a + f(b), 0) / others.length;
  const tips: string[] = [];
  const ppw = avg((b) => b.postsPerWeek);
  if (you.postsPerWeek < ppw * 0.7) tips.push(`Competitors post ~${round(ppw)} times a week; you post ${round(you.postsPerWeek)}. Posting more often usually brings more comments.`);
  const er = avg((b) => b.engagementRate);
  if (you.engagementRate < er * 0.7) tips.push(`Your engagement rate (${you.engagementRate}%) is below the competitor average (${round(er)}%). Try questions or "comment a keyword" calls to action.`);
  else if (you.engagementRate > er) tips.push(`Your engagement rate beats the competitor average (${round(er)}%). Keep the same content style.`);
  return tips;
}
