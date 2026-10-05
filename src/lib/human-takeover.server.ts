/** P2 human takeover — server helpers. Every automated send path checks conversationInTakeover. */
import { takeoverActive, takeoverUntil } from "@/lib/human-takeover";

type AdminClient = import("@supabase/supabase-js").SupabaseClient;

/** Fresh DB read (never cached) so in-flight jobs see a takeover that started a moment ago. */
export async function conversationInTakeover(admin: AdminClient, conversationId: string | null | undefined): Promise<boolean> {
  if (!conversationId) return false;
  const { data } = await admin.from("conversations").select("bot_paused_until").eq("id", conversationId).maybeSingle();
  return takeoverActive(data as { bot_paused_until: string | null } | null);
}

/** Called after a team member's manual reply was delivered. Never throws. */
export async function startTakeover(
  admin: AdminClient,
  args: { conversationId: string; organizationId: string; userId: string; reason: string },
) {
  try {
    const { data: s } = await admin.from("automation_settings").select("takeover_minutes")
      .eq("organization_id", args.organizationId).maybeSingle();
    const now = new Date();
    await admin.from("conversations").update({
      bot_paused_at: now.toISOString(),
      bot_paused_until: takeoverUntil(now, (s as { takeover_minutes?: number } | null)?.takeover_minutes),
      bot_paused_by: args.userId,
      bot_paused_reason: args.reason,
    }).eq("id", args.conversationId);
    // Queued Wait-step flows must never burst-send after the human is done.
    await admin.from("flow_runs").update({ status: "cancelled", detail: "human_takeover", updated_at: now.toISOString() })
      .eq("conversation_id", args.conversationId).eq("status", "waiting");
    await admin.from("automation_runs").insert({
      organization_id: args.organizationId, rule_id: null, conversation_id: args.conversationId,
      status: "skipped", detail: `human_takeover:started:${args.reason}`,
    });
  } catch (e) {
    console.error("takeover start failed", (e as Error).message);
  }
}
