import { describe, expect, it } from "vitest";
import { groupRuns } from "./activity-groups";

const row = (id: string, run_key: string | null, status: "sent" | "skipped" | "failed" | "matched", t: number, detail = "flow:x:send_dm") =>
  ({ id, run_key, status, detail, rule_id: null, conversation_id: "c", created_at: new Date(t * 1000).toISOString() });

describe("groupRuns", () => {
  it("one run with 3 steps becomes one entry", () => {
    const g = groupRuns([row("a", "r1", "sent", 1), row("b", "r1", "sent", 2), row("c", "r1", "sent", 3)]);
    expect(g).toHaveLength(1);
    expect(g[0]!.sent).toBe(3);
    expect(g[0]!.steps.map((s) => s.id)).toEqual(["a", "b", "c"]);
  });
  it("same automation on two posts = two separate runs", () => {
    expect(groupRuns([row("a", "r1", "sent", 1), row("b", "r2", "sent", 2)])).toHaveLength(2);
  });
  it("old rows without run key stay separate", () => {
    expect(groupRuns([row("a", null, "sent", 1), row("b", null, "sent", 2)])).toHaveLength(2);
  });
  it("a failed step marks the run failed; a wait marks it in progress", () => {
    expect(groupRuns([row("a", "r", "sent", 1), row("b", "r", "failed", 2)])[0]!.status).toBe("failed");
    expect(groupRuns([row("a", "r", "sent", 1), row("b", "r", "matched", 2, "flow:x:waiting_60m")])[0]!.status).toBe("in_progress");
  });
});
