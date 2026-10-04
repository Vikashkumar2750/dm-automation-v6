import { GUARD_PAUSE_MINUTES, isRateLimitError, predictRateRisk } from "./trust-safety";

/**
 * Predictive rate-limit guard: when Meta starts rejecting a workspace's messages for speed,
 * set the existing auto-pause (auto_paused_until) for a short cooldown. The locked engine already
 * honours auto-pause, so no delivery code changes.
 */
export async function runPredictiveGuard(admin: any) {
  const { data: ps } = await admin.from("platform_settings").select("feature_flags").eq("id", true).maybeSingle();
  if ((ps?.feature_flags as Record<string, unknown> | null)?.["predictive_guard_enabled"] === false) return { skipped: "disabled" };
  const since = new Date(Date.now() - 15 * 60_000).toISOString();
  const { data: failed } = await admin
    .from("automation_runs")
    .select("organization_id, detail")
    .eq("status", "failed")
    .gte("created_at", since)
    .limit(2000);
  const counts: Record<string, number> = {};
  for (const r of failed ?? []) if (isRateLimitError(r.detail)) counts[r.organization_id] = (counts[r.organization_id] ?? 0) + 1;
  const paused: string[] = [];
  for (const [orgId, n] of Object.entries(counts)) {
    const risk = predictRateRisk({ sentLast10m: 0, sentLastHour: 0, hourlyLimit: 1_000_000, rateLimitErrors15m: n });
    if (risk.level !== "slow_down") continue;
    const [{ data: ts }, { data: st }] = await Promise.all([
      admin.from("trust_settings").select("predictive_guard").eq("organization_id", orgId).maybeSingle(),
      admin.from("automation_settings").select("auto_paused_until").eq("organization_id", orgId).maybeSingle(),
    ]);
    if (ts && ts.predictive_guard === false) continue;
    if (st?.auto_paused_until && new Date(st.auto_paused_until).getTime() > Date.now()) continue;
    const until = new Date(Date.now() + GUARD_PAUSE_MINUTES * 60_000).toISOString();
    await admin.from("automation_settings").upsert(
      { organization_id: orgId, auto_paused_until: until, auto_pause_reason: `Predictive guard: Meta rate-limit (${n} in 15 min)` },
      { onConflict: "organization_id" },
    );
    await admin.from("trust_settings").upsert({ organization_id: orgId, last_guard_action_at: new Date().toISOString() }, { onConflict: "organization_id" });
    paused.push(orgId);
  }
  return { checked: Object.keys(counts).length, paused: paused.length };
}
