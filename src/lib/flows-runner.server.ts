/**
 * Phase B live flow execution. Runs ONLY when:
 *  - flows_enabled is on for the workspace, AND
 *  - flows_live_enabled is on for the workspace (separate Super Admin switch), AND
 *  - no keyword rule already sent something for this event.
 * Every failure is caught and logged; it can never throw into the webhook.
 * All org safety settings (pause, quiet hours, caps, opt-out) apply.
 */
import { sanitizeFlows, flowTriggerFor, type Flow, type FlowStep } from "@/lib/flows";
import { extractContactInfo } from "@/lib/crm";

type AdminClient = import("@supabase/supabase-js").SupabaseClient;

const GRAPH = "https://graph.facebook.com/v21.0";

export type FlowEvent = {
  organizationId: string;
  conversationId: string;
  socialAccountId: string | null;
  platform: "instagram" | "facebook";
  channel: string;
  body: string;
  externalUserId: string;
  externalId: string | null;
  trigger?: string;
};

type RunState = FlowEvent & { usedCommentReply?: boolean };

function listed(flags: Record<string, unknown>, key: string, orgId: string) {
  const orgs = Array.isArray(flags[key]) ? (flags[key] as string[]) : [];
  return orgs.length === 0 || orgs.includes(orgId);
}

export function liveFlowsActive(flags: Record<string, unknown>, orgId: string) {
  return (
    flags["flows_enabled"] !== false &&
    listed(flags, "flows_orgs", orgId) &&
    flags["flows_live_enabled"] !== false &&
    listed(flags, "flows_live_orgs", orgId)
  );
}

async function log(admin: AdminClient, ev: FlowEvent, status: string, detail: string) {
  await admin.from("automation_runs").insert({
    organization_id: ev.organizationId,
    rule_id: null,
    conversation_id: ev.conversationId,
    status,
    detail: `flow:${detail}`.slice(0, 300),
  });
}

/** Safety gate shared with keyword rules. Returns a skip reason or null. */
async function safetyBlock(admin: AdminClient, ev: FlowEvent): Promise<string | null> {
  const a = await import("@/lib/automation.server");
  const { data: platform } = await admin.from("platform_settings").select("global_send_paused").eq("id", true).maybeSingle();
  if (platform?.global_send_paused) return "platform_send_paused";
  const { data: row } = await admin
    .from("automation_settings")
    .select("is_paused, blocked_keywords, opt_out_keywords, per_contact_daily_limit, quiet_hours_enabled, quiet_hours_start, quiet_hours_end, timezone_offset_minutes, hourly_send_limit, daily_send_limit, viral_guard_enabled, viral_threshold_per_minute, viral_cooldown_minutes, auto_paused_until, auto_pause_reason")
    .eq("organization_id", ev.organizationId)
    .maybeSingle();
  const s = { ...a.FLOW_DEFAULT_SETTINGS, ...(row ?? {}) } as import("@/lib/automation.server").FlowSafetySettings;
  if (s.is_paused) return "automation_paused";
  if (s.auto_paused_until && new Date(s.auto_paused_until) > new Date()) return "auto_paused";
  if (a.flowInQuietHours(s)) return "quiet_hours";
  if (a.flowHitsKeyword(s.opt_out_keywords, ev.body)) return "opt_out";
  if (a.flowHitsKeyword(s.blocked_keywords, ev.body)) return "blocked_keyword";
  const hourAgo = new Date(Date.now() - 3600_000).toISOString();
  const dayAgo = new Date(Date.now() - 86400_000).toISOString();
  const count = async (since: string, conv?: string) => {
    let q = admin.from("automation_runs").select("id", { count: "exact", head: true })
      .eq("organization_id", ev.organizationId).eq("status", "sent").gte("created_at", since);
    if (conv) q = q.eq("conversation_id", conv);
    return (await q).count ?? 0;
  };
  if ((await count(hourAgo)) >= s.hourly_send_limit) return "org_hourly_limit";
  if ((await count(dayAgo)) >= s.daily_send_limit) return "org_daily_limit";
  if ((await count(dayAgo, ev.conversationId)) >= s.per_contact_daily_limit) return "per_contact_limit";
  return null;
}

async function credentials(admin: AdminClient, ev: FlowEvent) {
  if (!ev.socialAccountId) return null;
  const [{ data: tok }, { data: acc }] = await Promise.all([
    admin.from("social_account_tokens").select("access_token").eq("social_account_id", ev.socialAccountId).maybeSingle(),
    admin.from("social_accounts").select("external_id, metadata").eq("id", ev.socialAccountId).maybeSingle(),
  ]);
  const token = (await (await import("@/lib/token-crypto.server")).readToken(tok?.access_token as string | undefined)) ?? undefined;
  if (!token || !acc?.external_id) return null;
  const { messagingAccountId } = await import("@/lib/automation.server");
  return { token, accountId: messagingAccountId(ev.platform, acc.external_id as string, acc.metadata) };
}

async function recordOutbound(admin: AdminClient, ev: FlowEvent, flow: Flow, body: string, id: string | null) {
  const now = new Date().toISOString();
  await admin.from("messages").insert({
    conversation_id: ev.conversationId, direction: "outbound", body, external_id: id,
    sender_name: `Flow · ${flow.name}`, sent_at: now,
  });
  await admin.from("conversations").update({ last_message_at: now, last_message_preview: body.slice(0, 140), status: "pending" }).eq("id", ev.conversationId);
}

/** Run steps from `from`. Returns true when at least one action was taken. */
async function executeSteps(admin: AdminClient, flow: Flow, st: RunState, from: number): Promise<boolean> {
  const a = await import("@/lib/automation.server");
  let acted = false;
  let creds: Awaited<ReturnType<typeof credentials>> | undefined;
  const getCreds = async () => (creds === undefined ? (creds = await credentials(admin, st)) : creds);
  const text = st.body.toLowerCase();

  for (let i = from; i < flow.steps.length; i++) {
    const s = flow.steps[i] as FlowStep;
    if (s.kind === "condition") {
      let ok: boolean;
      if (s.check === "contains") {
        ok = s.value.toLowerCase().split(",").map((k) => k.trim()).filter(Boolean).some((k) => text.includes(k));
      } else {
        const c = await getCreds();
        const follows = c ? await a.flowCheckFollows(st.platform, st.externalUserId, c.token) : null;
        ok = follows === (s.value === "yes");
      }
      if (!ok) {
        if (acted) await log(admin, st, "skipped", `${flow.name}:stopped_at_${i + 1}`);
        return acted;
      }
      continue;
    }
    if (s.kind === "wait") {
      await admin.from("flow_runs").insert({
        organization_id: st.organizationId, conversation_id: st.conversationId, flow_id: flow.id, flow_name: flow.name,
        state: st as never, next_step: i + 1, resume_at: new Date(Date.now() + s.minutes * 60_000).toISOString(),
      });
      await log(admin, st, "matched", `${flow.name}:waiting_${s.minutes}m`);
      return true;
    }
    if (s.kind === "tag") {
      if (s.value) {
        await admin.from("contact_tags").upsert(
          { organization_id: st.organizationId, platform: st.platform, external_user_id: st.externalUserId, tag: s.value, source: "flow" },
          { onConflict: "organization_id,platform,external_user_id,tag", ignoreDuplicates: true },
        );
      }
      acted = true;
      continue;
    }
    const block = await safetyBlock(admin, st);
    if (block) {
      await log(admin, st, "skipped", `${flow.name}:${block}`);
      return true; // stop this event; do not fall through to another flow
    }
    const c = await getCreds();
    if (!c) {
      await log(admin, st, "failed", `${flow.name}:no_token`);
      return true;
    }
    if (s.kind === "public_reply") {
      if (st.channel !== "comment" || !st.externalId) { await log(admin, st, "skipped", `${flow.name}:not_a_comment`); continue; }
      const res = await a.flowGraphCall(`${GRAPH}/${st.externalId}/${st.platform === "facebook" ? "comments" : "replies"}`, { message: s.text, access_token: c.token });
      if (res.error) { await log(admin, st, "failed", `${flow.name}:${res.error}`); return true; }
      await recordOutbound(admin, st, flow, `[public reply] ${s.text}`, res.id ?? null);
      await log(admin, st, "sent", `${flow.name}:public_reply`);
      acted = true;
      continue;
    }
    // Phase E: payment link / coupon steps become a normal DM (same safety + sending path).
    let msgText = "";
    let btn: { title: string; url: string } | null = null;
    if (s.kind === "send_dm") {
      msgText = s.text;
      if (s.buttonTitle && s.buttonUrl) btn = { title: s.buttonTitle, url: s.buttonUrl };
    } else if (s.kind === "send_payment" || s.kind === "send_coupon") {
      const r = await import("@/lib/revenue.server");
      const target = { organizationId: st.organizationId, platform: st.platform, externalUserId: st.externalUserId, conversationId: st.conversationId, socialAccountId: st.socialAccountId };
      if (s.kind === "send_payment") {
        const link = await r.createPaymentLinkFor(admin, target, s.productId);
        if ("error" in link) { await log(admin, st, "failed", `${flow.name}:${link.error}`); return true; }
        const { formatInr } = await import("@/lib/revenue");
        msgText = s.text || `${link.name} — ${formatInr(link.amount)}`;
        btn = { title: "Pay now", url: link.url };
      } else {
        const code = await r.issueCoupon(admin, target, s.campaignId);
        if (!code) { await log(admin, st, "skipped", `${flow.name}:coupon_unavailable`); continue; }
        msgText = s.text.replace(/\{code\}/g, code);
      }
    } else {
      continue;
    }
    // send_dm — first DM after a comment is a private reply to that comment.
    const viaComment = st.channel === "comment" && st.externalId && !st.usedCommentReply;
    const recipient = viaComment ? { comment_id: st.externalId } : { id: st.externalUserId };
    const shapes = btn
      ? a.flowButtonMessages(msgText, [{ type: "web_url", url: btn.url, title: btn.title }])
      : [{ text: msgText }];
    let sentId: string | undefined;
    let err = "";
    for (const message of shapes) {
      const r = await a.flowCallMessaging(st.platform, c.accountId, { recipient, message, access_token: c.token });
      if (!r.error) { sentId = r.id; err = ""; break; }
      err = r.error;
    }
    if (err) { await log(admin, st, "failed", `${flow.name}:${err}`); return true; }
    if (viaComment) st.usedCommentReply = true;
    await recordOutbound(admin, st, flow, (viaComment ? "[private reply] " : "") + msgText + (btn ? `\n[${btn.title}] ${btn.url}` : ""), sentId ?? null);
    await log(admin, st, "sent", `${flow.name}:${s.kind}`);
    acted = true;
  }
  return acted;
}

/** Phase D: save an email/phone found in an incoming DM to the CRM (never overwrites, never sends). */
async function captureContactInfo(admin: AdminClient, ev: FlowEvent) {
  try {
    if (ev.channel === "comment") return;
    const found = extractContactInfo(ev.body ?? "");
    if (!found.email && !found.phone) return;
    const key = { organization_id: ev.organizationId, platform: ev.platform, external_user_id: ev.externalUserId };
    const { data: cur } = await admin.from("contact_profiles").select("email, phone")
      .eq("organization_id", key.organization_id).eq("platform", key.platform).eq("external_user_id", key.external_user_id).maybeSingle();
    const email = cur?.email || found.email;
    const phone = cur?.phone || found.phone;
    if (cur && cur.email === email && cur.phone === phone) return;
    await admin.from("contact_profiles").upsert({ ...key, email, phone, updated_at: new Date().toISOString() }, { onConflict: "organization_id,platform,external_user_id" });
    const { syncContactToWebhook } = await import("@/lib/nudges.server");
    await syncContactToWebhook(admin, ev.organizationId, { platform: ev.platform, external_user_id: ev.externalUserId, email, phone });
  } catch (e) {
    console.error("contact capture failed", e);
  }
}

/** Called by the webhook after keyword rules. Never throws. */
export async function runLiveFlows(admin: AdminClient, ev: FlowEvent, startedAt: string) {
  await captureContactInfo(admin, ev);
  try {
    const { data } = await admin.from("platform_settings").select("feature_flags").eq("id", true).maybeSingle();
    const flags = (data?.feature_flags as Record<string, unknown> | null) ?? {};
    if (!liveFlowsActive(flags, ev.organizationId)) return;
    const trigger = flowTriggerFor(ev.channel, ev.trigger);
    const flows = sanitizeFlows(flags[`flows_cfg_${ev.organizationId}`]).filter(
      (f) => f.active && f.trigger === trigger && (f.platform === "both" || f.platform === ev.platform),
    );
    if (flows.length === 0) return;
    // Keyword rules win: if one already sent for this event, flows stay quiet.
    const { count } = await admin.from("automation_runs").select("id", { count: "exact", head: true })
      .eq("conversation_id", ev.conversationId).eq("status", "sent").not("rule_id", "is", null).gte("created_at", startedAt);
    if ((count ?? 0) > 0) return;
    for (const flow of flows) {
      if (await executeSteps(admin, flow, { ...ev }, 0)) return;
    }
  } catch (e) {
    console.error("live flow failed", e);
  }
}

/** Scheduler tick: continue flows whose Wait step has finished. */
export async function resumeDueFlows(admin: AdminClient) {
  const { data: due } = await admin.from("flow_runs").select("id, organization_id, flow_id, state, next_step")
    .eq("status", "waiting").lte("resume_at", new Date().toISOString()).limit(50);
  const { data: ps } = await admin.from("platform_settings").select("feature_flags").eq("id", true).maybeSingle();
  const flags = (ps?.feature_flags as Record<string, unknown> | null) ?? {};
  let resumed = 0;
  for (const run of due ?? []) {
    // Claim the row first so two ticks never resume the same run.
    const { data: claimed } = await admin.from("flow_runs").update({ status: "running", updated_at: new Date().toISOString() })
      .eq("id", run.id).eq("status", "waiting").select("id");
    if (!claimed?.length) continue;
    let status = "done";
    let detail: string | null = null;
    try {
      const flow = liveFlowsActive(flags, run.organization_id)
        ? sanitizeFlows(flags[`flows_cfg_${run.organization_id}`]).find((f) => f.id === run.flow_id && f.active)
        : undefined;
      if (!flow) { status = "cancelled"; detail = "flow_off_or_removed"; }
      else { await executeSteps(admin, flow, run.state as RunState, run.next_step); resumed++; }
    } catch (e) {
      status = "failed";
      detail = (e as Error).message.slice(0, 300);
    }
    await admin.from("flow_runs").update({ status, detail, updated_at: new Date().toISOString() }).eq("id", run.id);
  }
  return { due: due?.length ?? 0, resumed };
}

/** Shared safety gate for other new sending paths (Phase C AI agent). */
export const safetyBlockFor = (admin: AdminClient, ev: Pick<FlowEvent, "organizationId" | "conversationId" | "body">) =>
  safetyBlock(admin, ev as FlowEvent);

/** Phase E: send one plain DM (with optional button) through the same safety gate. Never throws. */
export async function sendDirectDm(
  admin: AdminClient,
  t: { organizationId: string; conversationId: string; socialAccountId: string | null; platform: string; externalUserId: string },
  text: string,
  button: { title: string; url: string } | null,
  label: string,
): Promise<boolean> {
  try {
    const ev: FlowEvent = { ...t, platform: t.platform as "instagram" | "facebook", channel: "dm", body: "", externalId: null };
    const block = await safetyBlock(admin, ev);
    const pseudo = { id: "revenue", name: label } as Flow;
    if (block) { await log(admin, ev, "skipped", `${label}:${block}`); return false; }
    const c = await credentials(admin, ev);
    if (!c) { await log(admin, ev, "failed", `${label}:no_token`); return false; }
    const a = await import("@/lib/automation.server");
    const shapes = button ? a.flowButtonMessages(text, [{ type: "web_url", url: button.url, title: button.title }]) : [{ text }];
    for (const message of shapes) {
      const r = await a.flowCallMessaging(ev.platform, c.accountId, { recipient: { id: ev.externalUserId }, message, access_token: c.token });
      if (!r.error) {
        await recordOutbound(admin, ev, pseudo, text + (button ? `\n[${button.title}] ${button.url}` : ""), r.id ?? null);
        await log(admin, ev, "sent", label);
        return true;
      }
      await log(admin, ev, "failed", `${label}:${r.error}`);
    }
    return false;
  } catch (e) {
    console.error("direct dm failed", e);
    return false;
  }
}
