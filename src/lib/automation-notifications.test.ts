import { describe, expect, it } from "vitest";
import { notificationRuns, notificationStorageKey, notificationSource, workspaceAttention } from "./automation-notifications";
import type { AutomationRun } from "./automations.functions";
const now = Date.parse("2026-10-12T19:00:00Z");
const run = (id: string, status: AutomationRun["status"], age = 1000): AutomationRun => ({ id, status, rule_id: "r", detail: "cooldown", conversation_id: null, created_at: new Date(now - age).toISOString() });
describe("automation notifications", () => {
  it("routes workspace attention to accounts, inbox and publishing", () => {
    expect(workspaceAttention({ accounts: [{ id: "a", status: "attention" }], unread: 12, posts: [{ id: "p", status: "failed" }], postsVisible: true }).map(({ kind, count, to }) => ({ kind, count, to }))).toEqual([
      { kind: "accounts", count: 1, to: "/social-accounts" },
      { kind: "messages", count: 12, to: "/inbox" },
      { kind: "posts", count: 1, to: "/create-post" },
    ]);
  });
  it("does not invent attention from unavailable reads or hidden publishing", () => {
    expect(workspaceAttention({ postsVisible: true })).toEqual([]);
    expect(workspaceAttention({ accounts: [{ id: "a", status: "connected" }], unread: 0, posts: [{ id: "p", status: "failed" }], postsVisible: false })).toEqual([]);
  });
  it("only prompts first connection after a confirmed empty account read", () => {
    expect(workspaceAttention({ accounts: [], postsVisible: false })).toEqual([{ id: "attention:accounts:empty", kind: "accounts", count: 0, to: "/social-accounts" }]);
  });
  it("changes the read identity when affected records change, independent of ordering", () => {
    const attention = (ids: string[]) => workspaceAttention({ posts: ids.map((id) => ({ id, status: "failed" })), postsVisible: true })[0]?.id;
    expect(attention(["a", "b"])).toBe(attention(["b", "a"]));
    expect(attention(["a"])).not.toBe(attention(["b"]));
  });
  it("includes skipped rules", () => { expect(notificationRuns([run("skip", "skipped"), run("sent", "sent")], now).map((r) => r.id)).toEqual(["skip"]); });
  it("includes failed rules", () => { expect(notificationRuns([run("fail", "failed"), run("match", "matched")], now).map((r) => r.id)).toEqual(["fail"]); });
  it("keeps read state separate for each workspace and user", () => {
    expect(new Set([notificationStorageKey("u1", "o1"), notificationStorageKey("u1", "o2"), notificationStorageKey("u2", "o1")]).size).toBe(3);
  });
  it("limits recent alerts to 24 hours", () => { expect(notificationRuns([run("old", "skipped", 86400001), run("recent", "skipped", 86400000)], now).map((r) => r.id)).toEqual(["recent"]); });
  it("links flow and safety alerts to their own activity source", () => {
    expect(notificationSource({ rule_id: null, detail: "flow:Welcome:send_dm" })).toBe("flows");
    expect(notificationSource({ rule_id: null, detail: "paused" })).toBe("system");
    expect(notificationSource({ rule_id: "r", detail: "cooldown" })).toBe("rules");
  });
});