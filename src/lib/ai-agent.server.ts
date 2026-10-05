/**
 * Phase C AI agent for DMs. Runs after keyword rules and flows, only when
 * the Super Admin flag AND the workspace switch are on, and only when nothing
 * else replied to this message. Never throws into the webhook.
 */
import { agentDecision, buildKnowledgeText, parseAgentVerdict, sanitizeAgentConfig } from "@/lib/ai-agent";

type AdminClient = import("@supabase/supabase-js").SupabaseClient;

export function agentFlagActive(flags: Record<string, unknown>, orgId: string) {
  if (flags["ai_agent_enabled"] === false) return false;
  const orgs = Array.isArray(flags["ai_agent_orgs"]) ? (flags["ai_agent_orgs"] as string[]) : [];
  return orgs.length === 0 || orgs.includes(orgId);
}

export const agentKey = (orgId: string) => `ai_agent_cfg_${orgId}`;

const SYSTEM = `You are a customer messaging assistant for a business on Instagram/Facebook.
Answer ONLY from the business knowledge provided. Never invent prices, dates, links or policies.
If the knowledge does not contain the answer, set confidence below 40.
Return ONLY JSON: {"reply": string, "confidence": 0-100, "intent": "price|buy|support|booking|info|complaint|spam|other", "sentiment": "positive|neutral|negative", "lead_score": 0-100}.
Keep reply under 600 characters, plain text, no markdown.`;

export async function runAiAgent(
  admin: AdminClient,
  ev: {
    organizationId: string; conversationId: string; socialAccountId: string | null;
    platform: "instagram" | "facebook"; channel: string; body: string; externalUserId: string;
  },
  startedAt: string,
) {
  try {
    if (ev.channel === "comment") return; // DMs only: replies stay inside the 24-hour window
    const { data } = await admin.from("platform_settings").select("feature_flags").eq("id", true).maybeSingle();
    const flags = (data?.feature_flags as Record<string, unknown> | null) ?? {};
    if (!agentFlagActive(flags, ev.organizationId)) return;
    const cfg = sanitizeAgentConfig(flags[agentKey(ev.organizationId)]);
    if (!cfg.enabled) return;

    // Anything else (rule or flow) already answered → stay quiet.
    const { count } = await admin.from("automation_runs").select("id", { count: "exact", head: true })
      .eq("conversation_id", ev.conversationId).or("rule_id.not.is.null,status.in.(sent,matched)").gte("created_at", startedAt);
    if ((count ?? 0) > 0) return;

    const { readAiProviders, generateWithFailover, sanitisePromptInput } = await import("@/lib/ai-providers.server");
    const message = sanitisePromptInput(ev.body, 600);
    if (!message) return;
    const { data: history } = await admin.from("messages").select("direction, body")
      .eq("conversation_id", ev.conversationId).order("sent_at", { ascending: false }).limit(6);
    const convo = (history ?? []).reverse().map((m) => `${m.direction === "inbound" ? "Customer" : "Business"}: ${sanitisePromptInput(String(m.body ?? ""), 300)}`).join("\n");
    const result = await generateWithFailover({
      config: await readAiProviders(admin),
      system: `${SYSTEM}\nTone: ${sanitisePromptInput(cfg.persona, 300)}`,
      prompt: `Business knowledge:\n${buildKnowledgeText(cfg) || "(none)"}\n\nRecent conversation:\n${convo}\n\nLatest customer message: ${message}`,
      scope: `agent:${ev.organizationId}`,
      long: true,
    });
    const verdict = parseAgentVerdict(result.text);
    const decision = agentDecision(cfg, verdict);

    let replyText: string | null = null;
    if (decision === "reply" || (decision === "handoff" && cfg.handoffMessage)) {
      replyText = decision === "reply" ? verdict!.reply : cfg.handoffMessage;
      const sent = await send(admin, ev, replyText);
      if (!sent) replyText = null;
    }
    if (decision === "handoff") {
      await admin.from("conversations").update({ status: "open" }).eq("id", ev.conversationId);
    }
    await admin.from("conversation_insights").insert({
      organization_id: ev.organizationId, conversation_id: ev.conversationId, message_text: ev.body.slice(0, 500),
      intent: verdict?.intent ?? "other", sentiment: verdict?.sentiment ?? "neutral",
      lead_score: verdict?.leadScore ?? 0, confidence: verdict?.confidence ?? 0,
      decision, reply_text: replyText, provider: result.provider,
    });
    if (verdict && verdict.intent !== "other") {
      await admin.from("contact_tags").upsert(
        { organization_id: ev.organizationId, platform: ev.platform, external_user_id: ev.externalUserId, tag: `intent:${verdict.intent}`, source: "ai" },
        { onConflict: "organization_id,platform,external_user_id,tag", ignoreDuplicates: true },
      );
    }
  } catch (e) {
    console.error("ai agent failed", e);
  }
}

async function send(admin: AdminClient, ev: Parameters<typeof runAiAgent>[1], text: string) {
  const { safetyBlockFor } = await import("@/lib/flows-runner.server");
  const block = await safetyBlockFor(admin, ev);
  const logRun = (status: string, detail: string) => admin.from("automation_runs").insert({
    organization_id: ev.organizationId, rule_id: null, conversation_id: ev.conversationId, status, detail: `ai_agent:${detail}`.slice(0, 300),
  });
  if (block) { await logRun("skipped", block); return false; }
  if (!ev.socialAccountId) return false;
  const [{ data: tok }, { data: acc }] = await Promise.all([
    admin.from("social_account_tokens").select("access_token").eq("social_account_id", ev.socialAccountId).maybeSingle(),
    admin.from("social_accounts").select("external_id, metadata").eq("id", ev.socialAccountId).maybeSingle(),
  ]);
  if (tok?.access_token) tok.access_token = (await (await import("@/lib/token-crypto.server")).readToken(tok.access_token)) ?? "";
  if (!tok?.access_token || !acc?.external_id) { await logRun("failed", "no_token"); return false; }
  const a = await import("@/lib/automation.server");
  const accountId = a.messagingAccountId(ev.platform, acc.external_id as string, acc.metadata);
  const r = await a.flowCallMessaging(ev.platform, accountId, { recipient: { id: ev.externalUserId }, message: { text }, access_token: tok.access_token });
  if (r.error) { await logRun("failed", r.error); return false; }
  const now = new Date().toISOString();
  await admin.from("messages").insert({ conversation_id: ev.conversationId, direction: "outbound", body: text, external_id: r.id ?? null, sender_name: "AI agent", sent_at: now });
  await admin.from("conversations").update({ last_message_at: now, last_message_preview: text.slice(0, 140) }).eq("id", ev.conversationId);
  await logRun("sent", "reply");
  return true;
}
