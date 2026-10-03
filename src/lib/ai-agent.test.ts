import { describe, expect, it } from "vitest";
import { agentDecision, buildKnowledgeText, parseAgentVerdict, sanitizeAgentConfig } from "./ai-agent";
import { agentFlagActive } from "./ai-agent.server";

const org = "00000000-0000-0000-0000-000000000001";

describe("phase C ai agent", () => {
  it("is on by default, off only when switched off", () => {
    expect(agentFlagActive({}, org)).toBe(true);
    expect(agentFlagActive({ ai_agent_enabled: false }, org)).toBe(false);
    expect(sanitizeAgentConfig({}).enabled).toBe(false);
  });
  it("parses model JSON defensively", () => {
    const v = parseAgentVerdict('Sure: {"reply":"₹499","confidence":"90","intent":"price","sentiment":"positive","lead_score":80}');
    expect(v).toEqual({ reply: "₹499", confidence: 90, intent: "price", sentiment: "positive", leadScore: 80 });
    expect(parseAgentVerdict("no json")).toBeNull();
    expect(parseAgentVerdict('{"intent":"hack","confidence":500}')!.intent).toBe("other");
  });
  it("hands off when unsure, ignores spam, respects analyse-only", () => {
    const cfg = sanitizeAgentConfig({ enabled: true, confidenceThreshold: 70 });
    const base = { reply: "hi", confidence: 90, intent: "info", sentiment: "neutral", leadScore: 10 } as const;
    expect(agentDecision(cfg, base)).toBe("reply");
    expect(agentDecision(cfg, { ...base, confidence: 50 })).toBe("handoff");
    expect(agentDecision(cfg, null)).toBe("handoff");
    expect(agentDecision(cfg, { ...base, intent: "spam" })).toBe("ignore");
    expect(agentDecision({ ...cfg, autoReply: false }, base)).toBe("analyse_only");
  });
  it("caps knowledge size", () => {
    const cfg = sanitizeAgentConfig({ knowledge: [{ title: "A", content: "x".repeat(2000) }, { title: "B", content: "y".repeat(2000) }] });
    expect(buildKnowledgeText(cfg, 2100)).toContain("## A");
    expect(buildKnowledgeText(cfg, 2100)).not.toContain("## B");
  });
});
