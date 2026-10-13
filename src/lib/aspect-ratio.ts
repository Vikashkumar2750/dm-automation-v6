// Platform aspect-ratio rules for post photos. Pure — shared by the composer
// warning and the auto-fit step that runs before publishing.

export type RatioRange = { min: number; max: number; label: string; target: number };

/** Allowed width/height range for a photo, or null when any ratio is fine. */
export function ratioRule(platform: string, format: string): RatioRange | null {
  if (format === "story" || format === "reel" || format === "trial_reel") {
    return { min: 0.5, max: 0.6, label: "9:16", target: 9 / 16 };
  }
  if (platform === "instagram") {
    return { min: 0.8, max: 1.91, label: "4:5 to 1.91:1", target: 0.8 };
  }
  if (platform === "facebook") {
    return { min: 0.5625, max: 1.91, label: "9:16 to 1.91:1", target: 1 };
  }
  return null;
}

/** Strictest combined range across every selected platform. */
export function combinedRule(platforms: string[], format: string): RatioRange | null {
  let out: RatioRange | null = null;
  for (const p of new Set(platforms)) {
    const r = ratioRule(p, format);
    if (!r) continue;
    out = out
      ? { min: Math.max(out.min, r.min), max: Math.min(out.max, r.max), label: r.min > out.min || r.max < out.max ? r.label : out.label, target: r.min >= out.min ? r.target : out.target }
      : r;
  }
  return out;
}

export function ratioFits(ratio: number, rule: RatioRange | null): boolean {
  if (!rule) return true;
  return ratio >= rule.min - 0.01 && ratio <= rule.max + 0.01;
}

/** The ratio a photo is padded to: nearest edge of the allowed range. */
export function fitTarget(ratio: number, rule: RatioRange): number {
  if (ratio < rule.min) return rule.min;
  if (ratio > rule.max) return rule.max;
  return ratio;
}

/** Canvas size that contains the whole photo at `target` ratio — never stretched. */
export function paddedCanvas(width: number, height: number, target: number) {
  const ratio = width / height;
  if (ratio < target) return { width: Math.round(height * target), height };
  return { width, height: Math.round(width / target) };
}

export function describeRatio(width: number, height: number): string {
  const r = width / height;
  const known: [number, string][] = [[9 / 16, "9:16"], [4 / 5, "4:5"], [1, "1:1"], [16 / 9, "16:9"], [1.91, "1.91:1"], [3 / 4, "3:4"], [4 / 3, "4:3"]];
  const hit = known.find(([v]) => Math.abs(v - r) < 0.02);
  return hit ? hit[1] : `${r.toFixed(2)}:1`;
}
