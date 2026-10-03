/**
 * Abandoned-conversation nudges + CRM webhook sync (server only).
 * Nudges reuse the flow safety gate (pause, quiet hours, caps) via sendDirectDm
 * and never touch the locked keyword-rule delivery flow.
 */
import { conversationNudgeDue } from "@/lib/nudges";

type AdminClient = import("@supabase/supabase-js").SupabaseClient;

/** Scheduler tick: one re-engagement DM per abandoned conversation, inside the 24h window. */
export async function runConversationNudges(admin: AdminClient) {
  const { data: settings } = await admin.from("nudge_settings").select("organization_id, delay_minutes, text").eq("enabled", true);
  let sent = 0;
  const since = new Date(Date.now() - 23 * 3600_000).toISOString();
  for (const s of settings ?? []) {
    const { data: convos } = await admin.from("conversations")
      .select("id, platform, external_user_id, social_account_id, last_message_at")
      .eq("organization_id", s.organization_id).eq("channel", "dm")
      .in("platform", ["instagram", "facebook"]).gte("last_message_at", since).limit(50);
    for (const c of convos ?? []) {
      const { data: nudged } = await admin.from("conversation_nudge_log").select("id").eq("conversation_id", c.id).maybeSingle();
      if (nudged) continue;
      const { data: last } = await admin.from("messages").select("direction, sent_at")
        .eq("conversation_id", c.id).order("sent_at", { ascending: false }).limit(1).maybeSingle();
      if (!last || last.direction !== "inbound") continue; // we already replied (or nothing to answer)
      const { data: lastOut } = await admin.from("messages").select("sent_at")
        .eq("conversation_id", c.id).eq("direction", "outbound").order("sent_at", { ascending: false }).limit(1).maybeSingle();
      if (!conversationNudgeDue(last.sent_at as string, (lastOut?.sent_at as string | null) ?? null, s.delay_minutes)) continue;
      // Claim first so two ticks never nudge the same conversation twice.
      const { data: claimed } = await admin.from("conversation_nudge_log")
        .insert({ organization_id: s.organization_id, conversation_id: c.id }).select("id");
      if (!claimed?.length) continue;
      const { sendDirectDm } = await import("@/lib/flows-runner.server");
      const ok = await sendDirectDm(admin, {
        organizationId: s.organization_id, conversationId: c.id, socialAccountId: c.social_account_id,
        platform: c.platform, externalUserId: c.external_user_id,
      }, s.text, null, "Conversation nudge");
      if (ok) sent++;
    }
  }
  return { sent };
}

/** Push freshly captured contact details to the workspace's outbound webhook (Sheets/Zapier/Make). Fire-and-forget. */
export async function syncContactToWebhook(
  admin: AdminClient,
  organizationId: string,
  payload: { platform: string; external_user_id: string; email: string | null; phone: string | null },
) {
  try {
    const { data: sync } = await admin.from("crm_sync_settings").select("webhook_url").eq("organization_id", organizationId).eq("enabled", true).maybeSingle();
    const url = sync?.webhook_url as string | null;
    if (!url || !/^https:\/\//.test(url)) return;
    await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ source: "autodm", ...payload, captured_at: new Date().toISOString() }),
      signal: AbortSignal.timeout(8000),
    });
  } catch (e) {
    console.error("crm webhook sync failed", e);
  }
}
