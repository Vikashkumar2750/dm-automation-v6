/** Phase C AI agent: config model + pure helpers. Client-safe. */
export type KnowledgeItem = { id: string; title: string; content: string };
export type AiAgentConfig = {
  enabled: boolean;
  persona: string;
  knowledge: KnowledgeItem[];
  /** 0–100. Below this the agent hands over to a person. */
  confidenceThreshold: number;
  handoffMessage: string;
  /** false = analyse only (intent, sentiment, lead score), never reply. */
  autoReply: boolean;
};

export const MAX_KNOWLEDGE = 30;
export const INTENTS = ["price", "buy", "support", "booking", "info", "complaint", "spam", "other"] as const;
export const SENTIMENTS = ["positive", "neutral", "negative"] as const;

export const DEFAULT_AGENT: AiAgentConfig = {
  enabled: false,
  persona: "Friendly, short and helpful. Reply in the same language as the customer.",
  knowledge: [],
  confidenceThreshold: 70,
  handoffMessage: "Thanks for your message! A team member will reply to you shortly.",
  autoReply: true,
};

const t = (v: unknown, n: number) => String(v ?? "").trim().slice(0, n);

export function sanitizeAgentConfig(raw: unknown): AiAgentConfig {
  const r = (raw ?? {}) as Partial<AiAgentConfig>;
  const knowledge = (Array.isArray(r.knowledge) ? r.knowledge : []).slice(0, MAX_KNOWLEDGE).flatMap((k): KnowledgeItem[] => {
    const x = k as Partial<KnowledgeItem>;
    const content = t(x.content, 2000);
    if (!content) return [];
    return [{ id: t(x.id, 20) || Math.random().toString(36).slice(2, 10), title: t(x.title, 100) || "Untitled", content }];
  });
  const thr = Math.round(Number(r.confidenceThreshold));
  return {
    enabled: r.enabled === true,
    persona: t(r.persona, 500) || DEFAULT_AGENT.persona,
    knowledge,
    confidenceThreshold: Number.isFinite(thr) ? Math.min(100, Math.max(0, thr)) : 70,
    handoffMessage: t(r.handoffMessage, 500),
    autoReply: r.autoReply !== false,
  };
}

export type AgentVerdict = {
  reply: string;
  confidence: number;
  intent: (typeof INTENTS)[number];
  sentiment: (typeof SENTIMENTS)[number];
  leadScore: number;
};

/** Parse the model's JSON answer defensively. Returns null when unusable. */
export function parseAgentVerdict(text: string | null): AgentVerdict | null {
  if (!text) return null;
  const m = text.match(/\{[\s\S]*\}/);
  if (!m) return null;
  try {
    const j = JSON.parse(m[0]) as Record<string, unknown>;
    const n = (v: unknown) => Math.min(100, Math.max(0, Math.round(Number(v) || 0)));
    const intent = INTENTS.includes(j["intent"] as never) ? (j["intent"] as AgentVerdict["intent"]) : "other";
    const sentiment = SENTIMENTS.includes(j["sentiment"] as never) ? (j["sentiment"] as AgentVerdict["sentiment"]) : "neutral";
    return { reply: t(j["reply"], 900), confidence: n(j["confidence"]), intent, sentiment, leadScore: n(j["lead_score"]) };
  } catch {
    return null;
  }
}

/** Decide what to do with a verdict. */
export function agentDecision(cfg: AiAgentConfig, v: AgentVerdict | null): "reply" | "handoff" | "analyse_only" | "ignore" {
  if (!v) return "handoff";
  if (v.intent === "spam") return "ignore";
  if (!cfg.autoReply) return "analyse_only";
  if (!v.reply || v.confidence < cfg.confidenceThreshold) return "handoff";
  return "reply";
}

export function buildKnowledgeText(cfg: AiAgentConfig, limit = 6000) {
  let out = "";
  for (const k of cfg.knowledge) {
    const chunk = `## ${k.title}\n${k.content}\n\n`;
    if (out.length + chunk.length > limit) break;
    out += chunk;
  }
  return out.trim();
}
