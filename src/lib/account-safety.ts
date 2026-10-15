/** Per-account safety limits, capped by Super Admin maximums. Pure helpers (shared by server and UI). */

export type SafetyCaps = { hourly: number; daily: number; perContact: number };
export type AccountLimit = { hourly?: number | null; daily?: number | null; perContact?: number | null };

/** Never exceeded, even by a Super Admin override (stays below Meta's ~200 automated DMs/hour/account). */
export const HARD_HOURLY_CEILING = 200;
export const DEFAULT_SAFETY_CAPS: SafetyCaps = { hourly: 150, daily: 1500, perContact: 5 };

const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) && v > 0 ? Math.floor(v) : undefined);

/** Effective max values: per-workspace override > global > defaults; hourly never above the hard ceiling. */
export function resolveCaps(flags: Record<string, unknown> | null | undefined, orgId: string): SafetyCaps {
  const g = (flags?.["safety_caps"] ?? {}) as Partial<SafetyCaps>;
  const o = (flags?.[`safety_caps_${orgId}`] ?? {}) as Partial<SafetyCaps>;
  const pick = (k: keyof SafetyCaps) => num(o[k]) ?? num(g[k]) ?? DEFAULT_SAFETY_CAPS[k];
  return { hourly: Math.min(pick("hourly"), HARD_HOURLY_CEILING), daily: pick("daily"), perContact: pick("perContact") };
}

/** Limits that apply to one account: its own override or the workspace value, clamped to the caps. */
export function effectiveAccountLimits(
  workspace: { hourly: number; daily: number; perContact: number },
  override: AccountLimit | null | undefined,
  caps: SafetyCaps,
) {
  return {
    hourly: Math.min(num(override?.hourly) ?? workspace.hourly, caps.hourly),
    daily: Math.min(num(override?.daily) ?? workspace.daily, caps.daily),
    perContact: Math.min(num(override?.perContact) ?? workspace.perContact, caps.perContact),
  };
}
