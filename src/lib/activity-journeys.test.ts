import { describe, expect, it } from "vitest";
import { activityJourneys, filterActivityJourneys } from "./activity-journeys";
import type { AutomationRun } from "./automations.functions";

const row = (id: string, run: string, detail: string, time: number, conversation = "vikas", rule = "arth", status: AutomationRun["status"] = "sent"): AutomationRun => ({ id, run_key: run, detail, created_at: new Date(time * 1000).toISOString(), conversation_id: conversation, rule_id: rule, status });
const example = [
  row("a", "comment", "comment_reply", 1), row("b", "comment", "post_reply:post-id", 2, "vikas", "arth", "matched"), row("c", "comment", "tap_prompt", 3),
  row("d", "tap", "gate_follow_prompt_pending", 4, "vikas", "arth", "matched"), row("e", "tap", "follow_status_unavailable", 5),
  row("f", "follow", "gate_verified_follower", 6, "vikas", "arth", "matched"), row("g", "follow", "reply_dm", 7),
  row("h", "click", "click:link", 8, "vikas", "arth", "matched"),
];

describe("activity journey boundaries", () => {
  it("keeps the user's 4 main entries and 3/2/2/1 substeps within one START/END pair", () => {
    const journeys = activityJourneys([...example].reverse());
    expect(journeys).toHaveLength(1);
    expect(journeys[0]?.groups.map((g) => g.steps.length)).toEqual([3, 2, 2, 1]);
    expect(journeys[0]?.startKey).toBe("comment");
    expect(journeys[0]?.endKey).toBe("click");
  });
  it("does not end at the follow prompt or final delivery while waiting for a link click", () => {
    expect(activityJourneys(example.slice(0, 7))[0]?.endKey).toBeNull();
  });
  it("keeps interleaved people separate even with the same rule", () => {
    const journeys = activityJourneys([...example, row("other", "other-comment", "tap_prompt", 4, "other-person")]);
    expect(journeys).toHaveLength(2);
    expect(journeys.find((j) => j.key === "comment")?.groups).toHaveLength(4);
    expect(journeys.find((j) => j.key === "other-comment")?.endKey).toBeNull();
  });
  it("starts a new journey for another comment by the same person", () => {
    expect(activityJourneys([...example, row("new", "new-comment", "tap_prompt", 10)])).toHaveLength(2);
  });
  it("never combines two different rules", () => {
    expect(activityJourneys([...example, row("other", "other-rule", "gate_verified_follower", 4, "vikas", "different")])).toHaveLength(2);
  });
  it("does not invent a start when the loaded window contains only callbacks", () => {
    expect(activityJourneys(example.slice(3))[0]?.startKey).toBeNull();
    expect(activityJourneys(example.slice(3))[0]?.endKey).toBe("click");
  });
  it("status filters do not move END to final delivery when link-open is hidden", () => {
    const filtered = filterActivityJourneys(activityJourneys(example), "sent");
    expect(filtered[0]?.groups.map((g) => g.key)).toEqual(["comment", "tap", "follow"]);
    expect(filtered[0]?.endKey).toBe("click");
  });
  it("standalone replies complete without waiting for a nonexistent follow gate", () => {
    expect(activityJourneys([row("direct", "direct", "reply_dm", 1)])[0]?.endKey).toBe("direct");
  });
  it("an unrelated skipped repeat does not break the active follow journey", () => {
    const journeys = activityJourneys([...example, row("skip", "skip", "cooldown", 4, "vikas", "arth", "skipped")]);
    expect(journeys.find((j) => j.key === "comment")?.groups.map((g) => g.key)).toEqual(["comment", "tap", "follow", "click"]);
  });
  it("an expired gate is a terminal entry", () => {
    const journeys = activityJourneys([...example.slice(0, 3), row("expired", "expiry", "follow_gate_expired", 9, "vikas", "arth", "skipped")]);
    expect(journeys[0]?.endKey).toBe("expiry");
  });
});