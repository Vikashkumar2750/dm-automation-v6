import { describe, it, expect, vi } from "vitest";
import { clampTakeoverMinutes, takeoverActive, takeoverUntil, startsTakeover, DEFAULT_TAKEOVER_MINUTES } from "@/lib/human-takeover";
import { isQuotaReason, quotaBackoffUntil, inQuotaBackoff, MAX_BACKOFF_MS } from "@/lib/youtube-quota";
import { assessJob, assessScheduler, nextFailureStreak, SCHEDULER_JOBS } from "@/lib/scheduler-health";

const now = new Date("2026-10-05T10:00:00Z");

describe("human takeover rules", () => {
  it("manual team-member outbound reply starts takeover", () => {
    expect(startsTakeover({ direction: "outbound", sent_by: "user-1" })).toBe(true);
  });
  it("bot / flow / AI outbound (no sent_by) does not start takeover", () => {
    expect(startsTakeover({ direction: "outbound", sent_by: null })).toBe(false);
    expect(startsTakeover({ direction: "outbound" })).toBe(false);
  });
  it("customer inbound does not start takeover", () => {
    expect(startsTakeover({ direction: "inbound", sent_by: "user-1" })).toBe(false);
  });
  it("default duration is 60 minutes and is clamped to 5..10080", () => {
    expect(clampTakeoverMinutes(undefined)).toBe(DEFAULT_TAKEOVER_MINUTES);
    expect(clampTakeoverMinutes(1)).toBe(5);
    expect(clampTakeoverMinutes(99999)).toBe(10080);
    expect(takeoverUntil(now, 60)).toBe("2026-10-05T11:00:00.000Z");
  });
  it("active before expiry, eligible again after expiry", () => {
    const conv = { bot_paused_until: "2026-10-05T11:00:00Z" };
    expect(takeoverActive(conv, now)).toBe(true);
    expect(takeoverActive(conv, new Date("2026-10-05T11:00:01Z"))).toBe(false);
    expect(takeoverActive({ bot_paused_until: null }, now)).toBe(false);
  });
});

function fakeAdmin(pausedUntil: string | null) {
  const chain: Record<string, unknown> = {};
  const self = () => chain;
  Object.assign(chain, {
    select: self, eq: self, gte: self, not: self, limit: self, order: self,
    maybeSingle: async () => ({ data: { bot_paused_until: pausedUntil, global_send_paused: false } }),
    then: (r: (v: unknown) => void) => r({ count: 0, data: [] }),
  });
  return { from: vi.fn(() => chain) } as never;
}

describe("takeover blocks every automated path (shared safety gate)", () => {
  it("flows / AI / nudges / reminders / broadcasts gate returns human_takeover", async () => {
    const { safetyBlockFor } = await import("@/lib/flows-runner.server");
    const future = new Date(Date.now() + 3600_000).toISOString();
    expect(await safetyBlockFor(fakeAdmin(future), { organizationId: "o", conversationId: "c", body: "hi" })).toBe("human_takeover");
  });
  it("in-flight job re-reads the DB right before sending (takeover started mid-processing)", async () => {
    const { conversationInTakeover } = await import("@/lib/human-takeover.server");
    expect(await conversationInTakeover(fakeAdmin(null), "c")).toBe(false);
    expect(await conversationInTakeover(fakeAdmin(new Date(Date.now() + 60_000).toISOString()), "c")).toBe(true);
  });
  it("expired takeover no longer blocks", async () => {
    const { conversationInTakeover } = await import("@/lib/human-takeover.server");
    expect(await conversationInTakeover(fakeAdmin(new Date(Date.now() - 1000).toISOString()), "c")).toBe(false);
  });
});

describe("youtube quota backoff", () => {
  it("recognises quota reasons only", () => {
    expect(isQuotaReason("quotaExceeded")).toBe(true);
    expect(isQuotaReason("commentsDisabled")).toBe(false);
  });
  it("backs off 30m, 1h, 2h and caps at 24h", () => {
    const t = now.getTime();
    expect(quotaBackoffUntil(t, 0) - t).toBe(30 * 60_000);
    expect(quotaBackoffUntil(t, 1) - t).toBe(60 * 60_000);
    expect(quotaBackoffUntil(t, 2) - t).toBe(120 * 60_000);
    expect(quotaBackoffUntil(t, 10) - t).toBe(MAX_BACKOFF_MS);
  });
  it("skips polling inside the window, resumes after", () => {
    const t = now.getTime();
    expect(inQuotaBackoff({ youtube_quota_until: t + 1 }, t)).toBe(true);
    expect(inQuotaBackoff({ youtube_quota_until: t - 1 }, t)).toBe(false);
    expect(inQuotaBackoff(null, t)).toBe(false);
  });
});

describe("scheduler health", () => {
  const t = now.getTime();
  const hb = (o: Partial<{ last_run_at: string; consecutive_failures: number; last_duration_ms: number }>) => ({
    job: "flows", last_run_at: new Date(t - 30_000).toISOString(), last_status: 200, last_duration_ms: 100, consecutive_failures: 0, ...o,
  });
  it("detects stopped scheduler (>5 min without a run)", () => {
    expect(assessJob("flows", hb({ last_run_at: new Date(t - 6 * 60_000).toISOString() }), t).state).toBe("stale");
  });
  it("detects 3 failures in a row", () => {
    expect(assessJob("flows", hb({ consecutive_failures: 3 }), t).state).toBe("failing");
  });
  it("detects abnormal delay", () => {
    expect(assessJob("flows", hb({ last_duration_ms: 50_000 }), t).state).toBe("slow");
  });
  it("missing jobs make the scheduler unhealthy", () => {
    expect(assessScheduler([], t).healthy).toBe(false);
    expect(assessScheduler(SCHEDULER_JOBS.map((job) => ({ ...hb({}), job })), t).healthy).toBe(true);
  });
  it("failure streak resets on success", () => {
    expect(nextFailureStreak(2, false)).toBe(3);
    expect(nextFailureStreak(5, true)).toBe(0);
  });
});
