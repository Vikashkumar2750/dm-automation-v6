import { describe, expect, it } from "vitest";

import { benchmarkTips, bestTimes, detectAnomalies, engagementGrid, engagementRate, funnelHeatmap, istBucket } from "./growth";

describe("growth intelligence", () => {
  it("buckets times in India time", () => {
    // 2026-10-04 is a Sunday; 14:00 UTC = 19:30 IST
    expect(istBucket("2026-10-04T14:00:00Z")).toEqual({ day: 0, hour: 19 });
    // 20:00 UTC Sunday = 01:30 IST Monday
    expect(istBucket("2026-10-04T20:00:00Z")).toEqual({ day: 1, hour: 1 });
  });

  it("needs at least 10 events before suggesting best times", () => {
    const few = engagementGrid(Array(9).fill("2026-10-04T14:00:00Z"));
    expect(bestTimes(few)).toEqual([]);
  });

  it("ranks the busiest slot first", () => {
    const grid = engagementGrid([...Array(8).fill("2026-10-04T14:00:00Z"), ...Array(3).fill("2026-10-05T03:00:00Z")]);
    const best = bestTimes(grid);
    expect(best[0]).toMatchObject({ day: 0, hour: 19, count: 8, label: "Sun 7 PM" });
    expect(best[1]).toMatchObject({ day: 1, hour: 8, count: 3 });
  });

  it("computes funnel conversion between stages", () => {
    const at = "2026-10-04T14:00:00Z";
    const f = funnelHeatmap([
      ...Array(10).fill({ stage: "triggered", at }),
      ...Array(8).fill({ stage: "dm_sent", at }),
      ...Array(4).fill({ stage: "page_open", at }),
      ...Array(2).fill({ stage: "click", at }),
      { stage: "sale", at },
    ]);
    expect(f.totals).toEqual([10, 8, 4, 2, 1]);
    expect(f.conversion).toEqual([100, 80, 50, 50, 50]);
    expect(f.rows.triggered[0]).toBe(10);
  });

  it("alerts when DMs drop to half the usual daily level", () => {
    const a = detectAnomalies([{ key: "sent", label: "DMs sent", last24h: 5, prev7d: 70, kind: "drop" }]);
    expect(a).toHaveLength(1);
    expect(a[0]!.severity).toBe("warning");
    expect(detectAnomalies([{ key: "sent", label: "DMs sent", last24h: 6, prev7d: 70, kind: "drop" }])).toHaveLength(0);
  });

  it("marks a drop to 20% or less as danger", () => {
    expect(detectAnomalies([{ key: "sent", label: "DMs", last24h: 2, prev7d: 70, kind: "drop" }])[0]!.severity).toBe("danger");
  });

  it("ignores drops when history is under 5 per day", () => {
    expect(detectAnomalies([{ key: "sent", label: "DMs", last24h: 0, prev7d: 28, kind: "drop" }])).toEqual([]);
  });

  it("alerts when failures spike to double the usual", () => {
    expect(detectAnomalies([{ key: "failed", label: "Failed", last24h: 12, prev7d: 35, kind: "spike" }])).toHaveLength(1);
    expect(detectAnomalies([{ key: "failed", label: "Failed", last24h: 4, prev7d: 0, kind: "spike" }])).toHaveLength(0);
  });

  it("computes engagement rate and benchmark tips", () => {
    expect(engagementRate(10000, 50)).toBe(0.5);
    expect(engagementRate(0, 50)).toBe(0);
    const tips = benchmarkTips(
      { name: "You", followers: 1000, postsPerWeek: 1, avgComments: 2, engagementRate: 0.2 },
      [{ name: "A", followers: 1000, postsPerWeek: 5, avgComments: 10, engagementRate: 1 }],
    );
    expect(tips).toHaveLength(2);
  });
});
