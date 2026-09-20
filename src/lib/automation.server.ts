/**
 * Automation engine V1 (Phase 8).
 * Runs server-side right after an inbound message is ingested from a webhook.
 * Safety: rule cooldown per conversation, daily cap per rule, never reacts to
 * outbound/automated messages, and every attempt is logged in automation_runs.
 */

type AdminClient = import("@supabase/supabase-js").SupabaseClient;

const GRAPH = "https://graph.facebook.com/v21.0";

export type AutomationContext = {
  organizationId: string;
  conversationId: string;
  socialAccountId: string | null;
  platform: "instagram" | "facebook";
  channel: string; // "dm" | "comment"
  body: string;
  externalUserId: string;
  /** Comment id for comment channel, message id for DMs. */
  externalId: string | null;
};

type Rule = {
  id: string;
  name: string;
  platform: string | null;
  trigger: string;
  match_type: string;
  keywords: string[];
  action: string;
  response_text: string | null;
  set_status: string | null;
  cooldown_seconds: number;
  daily_limit: number;
};

function matches(rule: Rule, body: string) {
  if (rule.match_type === "any") return true;
  const text = body.toLowerCase();
  const keys = (rule.keywords ?? []).map((k) => k.trim().toLowerCase()).filter(Boolean);
  if (keys.length === 0) return false;
  return keys.some((k) => {
    if (rule.match_type === "exact") return text.trim() === k;
    if (rule.match_type === "starts_with") return text.trim().startsWith(k);
    return text.includes(k);
  });
}

async function log(
  admin: AdminClient,
  ctx: AutomationContext,
  ruleId: string | null,
  status: "matched" | "sent" | "skipped" | "failed",
  detail?: string,
) {
  await admin.from("automation_runs").insert({
    organization_id: ctx.organizationId,
    rule_id: ruleId,
    conversation_id: ctx.conversationId,
    status,
    detail: detail ?? null,
  });
}

export async function runAutomations(admin: AdminClient, ctx: AutomationContext) {
  const trigger = ctx.channel === "comment" ? "comment_received" : "dm_received";

  const { data: rules } = await admin
    .from("automation_rules")
    .select(
      "id, name, platform, trigger, match_type, keywords, action, response_text, set_status, cooldown_seconds, daily_limit",
    )
    .eq("organization_id", ctx.organizationId)
    .eq("is_active", true)
    .eq("trigger", trigger)
    .order("priority", { ascending: true });

  const candidates = ((rules ?? []) as Rule[]).filter(
    (r) => (!r.platform || r.platform === ctx.platform) && matches(r, ctx.body),
  );
  if (candidates.length === 0) return;

  // Only the highest-priority matching rule fires (anti-spam).
  const rule = candidates[0]!;

  // Cooldown: skip if this rule already acted on this conversation recently.
  const since = new Date(Date.now() - rule.cooldown_seconds * 1000).toISOString();
  const { count: recent } = await admin
    .from("automation_runs")
    .select("id", { count: "exact", head: true })
    .eq("rule_id", rule.id)
    .eq("conversation_id", ctx.conversationId)
    .eq("status", "sent")
    .gte("created_at", since);
  if ((recent ?? 0) > 0) {
    await log(admin, ctx, rule.id, "skipped", "cooldown");
    return;
  }

  // Daily cap per rule.
  const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { count: today } = await admin
    .from("automation_runs")
    .select("id", { count: "exact", head: true })
    .eq("rule_id", rule.id)
    .eq("status", "sent")
    .gte("created_at", dayAgo);
  if ((today ?? 0) >= rule.daily_limit) {
    await log(admin, ctx, rule.id, "skipped", "daily_limit");
    return;
  }

  try {
    if (rule.action === "set_status") {
      await admin
        .from("conversations")
        .update({ status: rule.set_status ?? "pending" })
        .eq("id", ctx.conversationId);
      await log(admin, ctx, rule.id, "sent", `status:${rule.set_status ?? "pending"}`);
      return;
    }

    if (!ctx.socialAccountId) {
      await log(admin, ctx, rule.id, "failed", "no_account");
      return;
    }
    const [{ data: tokenRow }, { data: account }] = await Promise.all([
      admin
        .from("social_account_tokens")
        .select("access_token")
        .eq("social_account_id", ctx.socialAccountId)
        .maybeSingle(),
      admin
        .from("social_accounts")
        .select("external_id")
        .eq("id", ctx.socialAccountId)
        .maybeSingle(),
    ]);
    const token = tokenRow?.access_token as string | undefined;
    if (!token || !account?.external_id) {
      await log(admin, ctx, rule.id, "failed", "no_token");
      return;
    }

    const text = rule.response_text?.trim();

    if (rule.action === "hide_comment") {
      if (!ctx.externalId) {
        await log(admin, ctx, rule.id, "failed", "no_comment_id");
        return;
      }
      const res = await call(`${GRAPH}/${ctx.externalId}`, { hide: true, access_token: token });
      if (res.error) {
        await log(admin, ctx, rule.id, "failed", res.error);
        return;
      }
      await log(admin, ctx, rule.id, "sent", "hidden");
      return;
    }

    if (!text) {
      await log(admin, ctx, rule.id, "failed", "no_response_text");
      return;
    }

    let result: { id?: string; error?: string };
    let prefix = "";

    if (rule.action === "reply_dm") {
      result = await call(`${GRAPH}/${account.external_id}/messages`, {
        recipient: { id: ctx.externalUserId },
        message: { text },
        access_token: token,
      });
    } else if (rule.action === "comment_public_reply") {
      if (!ctx.externalId) {
        await log(admin, ctx, rule.id, "failed", "no_comment_id");
        return;
      }
      prefix = "[public reply] ";
      result = await call(`${GRAPH}/${ctx.externalId}/replies`, {
        message: text,
        access_token: token,
      });
    } else if (rule.action === "comment_private_reply") {
      if (!ctx.externalId) {
        await log(admin, ctx, rule.id, "failed", "no_comment_id");
        return;
      }
      prefix = "[private reply] ";
      result = await call(`${GRAPH}/${account.external_id}/messages`, {
        recipient: { comment_id: ctx.externalId },
        message: { text },
        access_token: token,
      });
    } else {
      await log(admin, ctx, rule.id, "skipped", "unknown_action");
      return;
    }

    if (result.error) {
      await log(admin, ctx, rule.id, "failed", result.error.slice(0, 300));
      return;
    }

    const now = new Date().toISOString();
    await admin.from("messages").insert({
      conversation_id: ctx.conversationId,
      direction: "outbound",
      body: `${prefix}${text}`,
      external_id: result.id ?? null,
      sender_name: `Automation · ${rule.name}`,
      sent_at: now,
    });
    await admin
      .from("conversations")
      .update({
        last_message_at: now,
        last_message_preview: `${prefix}${text}`.slice(0, 140),
        status: "pending",
      })
      .eq("id", ctx.conversationId);

    await log(admin, ctx, rule.id, "sent", rule.action);
  } catch (error) {
    await log(
      admin,
      ctx,
      rule.id,
      "failed",
      error instanceof Error ? error.message.slice(0, 300) : "unknown_error",
    );
  }
}

async function call(url: string, payload: Record<string, unknown>) {
  const response = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
  });
  const json = (await response.json()) as {
    id?: string;
    message_id?: string;
    error?: { message?: string };
  };
  if (!response.ok || json.error) {
    return { error: json.error?.message ?? `HTTP ${response.status}` };
  }
  return { id: json.id ?? json.message_id };
}
