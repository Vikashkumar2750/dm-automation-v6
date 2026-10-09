/**
 * Phase B live flow execution. Runs ONLY when:
 *  - flows_enabled is on for the workspace, AND
 *  - flows_live_enabled is on for the workspace (separate Super Admin switch), AND
 *  - no keyword rule already sent something for this event.
 * Every failure is caught and logged; it can never throw into the webhook.
 * All org safety settings (pause, quiet hours, caps, opt-out) apply.
 */
import { sanitizeFlows, flowTriggerFor, flowTargetsPost, conditionPasses, leadAnswer, type Flow, type FlowStep, type LeadField } from "@/lib/flows";
import { callbackMatches, flowCallbackPayload, parseFlowCallback, type FlowCallback } from "@/lib/flow-callback";
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
  payload?: string | null;
  /** Comment's post/reel id, used by flows limited to selected posts. */
  postExternalId?: string | null;
  /** Groups every step of one run (Activity + plan usage: 1 run = 1 count). */
  runKey?: string;
};

type FormProgress = { step: number; field: number; answers: Record<string, string> };
type GateProgress = { step: number; tries: number };
type RunState = FlowEvent & { usedCommentReply?: boolean; form?: FormProgress; gate?: GateProgress; tap?: { stage: "opener" | "follow"; nonce: string; stepId: string }; originalCommentId?: string | null };
const FORM_TIMEOUT_MS = 24 * 3600_000;
export const FLOW_FOLLOWED_PAYLOAD = "FLOW_FOLLOWED";
const FOLLOWED_TITLE = "I followed ✅";
/** Max re-sends of the follow request when someone taps but still doesn't follow. */
export const MAX_GATE_TRIES = 2;

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
    run_key: ev.runKey ?? null,
  });
}

/** Safety gate shared with keyword rules. Returns a skip reason or null. */
async function safetyBlock(admin: AdminClient, ev: FlowEvent): Promise<string | null> {
  const a = await import("@/lib/automation.server");
  // P2: a human owns this conversation — every automated path stops here (flows, AI, nudges, reminders, broadcasts).
  const { conversationInTakeover } = await import("@/lib/human-takeover.server");
  if (await conversationInTakeover(admin, ev.conversationId)) return "human_takeover";
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
  let profile: { tags: string[]; hasEmail: boolean; hasPhone: boolean } | undefined;
  const contactKey = () => ({ organization_id: st.organizationId, platform: st.platform, external_user_id: st.externalUserId });
  const getProfile = async () => {
    if (profile) return profile;
    const k = contactKey();
    const [{ data: tags }, { data: cp }] = await Promise.all([
      admin.from("contact_tags").select("tag").eq("organization_id", k.organization_id).eq("platform", k.platform).eq("external_user_id", k.external_user_id),
      admin.from("contact_profiles").select("email, phone").eq("organization_id", k.organization_id).eq("platform", k.platform).eq("external_user_id", k.external_user_id).maybeSingle(),
    ]);
    profile = { tags: (tags ?? []).map((t: { tag: string }) => String(t.tag).toLowerCase()), hasEmail: !!cp?.email, hasPhone: !!cp?.phone };
    return profile;
  };
  let followsCache: boolean | null | undefined;
  const getFollows = async () => {
    if (followsCache !== undefined) return followsCache;
    const c = await getCreds();
    followsCache = c ? await a.flowCheckFollows(st.platform, st.externalUserId, c.token) : null;
    return followsCache;
  };

  for (let i = from; i < flow.steps.length; i++) {
    const s = flow.steps[i] as FlowStep;
    if (s.disabled) continue; // switched off in the builder: skipped, flow continues
    if (s.kind === "condition") {
      const needsProfile = s.check === "has_tag" || s.check === "no_tag" || s.check === "has_contact";
      const p = needsProfile ? await getProfile() : { tags: [], hasEmail: false, hasPhone: false };
      const isFollower = s.check === "is_follower" ? await getFollows() : null;
      const ok = conditionPasses(s, { text: st.body ?? "", isFollower, ...p });
      if (!ok) {
        if (acted) await log(admin, st, "skipped", `${flow.name}:stopped_at_${i + 1}`);
        return acted;
      }
      continue;
    }
    if (s.kind === "remove_tag") {
      if (s.value) {
        const k = contactKey();
        await admin.from("contact_tags").delete().eq("organization_id", k.organization_id).eq("platform", k.platform)
          .eq("external_user_id", k.external_user_id).eq("tag", s.value);
        if (profile) profile.tags = profile.tags.filter((t) => t !== s.value.toLowerCase());
      }
      acted = true;
      continue;
    }
    if (s.kind === "follow_gate" && (await getFollows()) === true) continue; // followers pass straight through
    if (s.kind === "wait") {
      await admin.from("flow_runs").insert({
        organization_id: st.organizationId, conversation_id: st.conversationId, flow_id: flow.id, flow_name: flow.name,
        state: st as never, next_step: i + 1, status: "waiting", resume_at: new Date(Date.now() + s.minutes * 60_000).toISOString(),
      });
      await log(admin, st, "matched", `${flow.name}:waiting_${s.minutes}m`);
      return true;
    }
    if (s.kind === "lead_form") {
      const first = s.fields[0];
      if (!first) continue;
      const sent = await sendFormQuestion(admin, flow, st, first, s.intro);
      if (sent) {
        await admin.from("flow_runs").insert({
          organization_id: st.organizationId, conversation_id: st.conversationId, flow_id: flow.id, flow_name: flow.name,
          state: { ...st, form: { step: i, field: 0, answers: {} } } as never, next_step: i, status: "awaiting_reply",
          resume_at: new Date(Date.now() + FORM_TIMEOUT_MS).toISOString(),
        });
      }
      return true;
    }
    if (s.kind === "tag") {
      if (s.value) {
        await admin.from("contact_tags").upsert(
          { organization_id: st.organizationId, platform: st.platform, external_user_id: st.externalUserId, tag: s.value, source: "flow" },
          { onConflict: "organization_id,platform,external_user_id,tag", ignoreDuplicates: true },
        );
      }
      if (profile && s.value && !profile.tags.includes(s.value.toLowerCase())) profile.tags.push(s.value.toLowerCase());
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
      const commentId = st.originalCommentId ?? (st.channel === "comment" ? st.externalId : null);
      if (!commentId) { await log(admin, st, "skipped", `${flow.name}:not_a_comment`); continue; }
      const res = await a.flowGraphCall(`${GRAPH}/${commentId}/${st.platform === "facebook" ? "comments" : "replies"}`, { message: s.text, access_token: c.token });
      if (res.error) { await log(admin, st, "failed", `${flow.name}:${res.error}`); return true; }
      await recordOutbound(admin, st, flow, `[public reply] ${s.text}`, res.id ?? null);
      await log(admin, st, "sent", `${flow.name}:public_reply`);
      acted = true;
      continue;
    }
    // Phase E: payment link / coupon steps become a normal DM (same safety + sending path).
    let msgText = "";
    let btn: { title: string; url: string } | null = null;
    let stopAfterSend = false;
    if (s.kind === "opening_dm") {
      if (st.channel !== "comment" || st.usedCommentReply) { await log(admin, st, "skipped", `${flow.name}:opener_not_first_private_reply`); return true; }
      msgText = s.text;
      stopAfterSend = true;
    } else if (s.kind === "send_dm") {
      msgText = s.text;
      if (s.buttonTitle && s.buttonUrl) btn = { title: s.buttonTitle, url: s.buttonUrl };
    } else if (s.kind === "ask_contact") {
      msgText = s.text; // the reply is saved to Contacts by captureContactInfo on the next DM
    } else if (s.kind === "follow_gate") {
      msgText = s.text;
      if (s.profileUrl) btn = { title: s.buttonTitle || "Visit profile", url: s.profileUrl };
      stopAfterSend = true; // Only the run-bound confirmation button can resume this gate.
    } else if (s.kind === "send_offer" || s.kind === "send_payment" || s.kind === "send_coupon") {
      const r = await import("@/lib/revenue.server");
      const target = { organizationId: st.organizationId, platform: st.platform, externalUserId: st.externalUserId, conversationId: st.conversationId, socialAccountId: st.socialAccountId };
      if (s.kind === "send_offer") {
        const link = await r.createOfferLinkFor(admin, target, s.productId, s.pageId);
        if ("error" in link) { await log(admin, st, "failed", `${flow.name}:${link.error}`); return true; }
        msgText = s.text || `${link.name} — your offer is ready`;
        btn = { title: "View offer", url: link.offerUrl };
      } else if (s.kind === "send_payment") {
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
    const buttons: Parameters<typeof a.flowButtonMessages>[1] = btn ? [{ type: "web_url", url: btn.url, title: btn.title }] : [];
    let pendingId: string | null = null;
    let pendingState: RunState | null = null;
    let tapPayload = "";
    if (s.kind === "opening_dm" || s.kind === "follow_gate") {
      pendingId = crypto.randomUUID();
      const tap = { stage: s.kind === "opening_dm" ? "opener" as const : "follow" as const, nonce: crypto.randomUUID(), stepId: s.id };
      pendingState = { ...st, tap, ...(s.kind === "follow_gate" ? { gate: { step: i, tries: st.gate?.tries ?? 0 } } : {}) };
      tapPayload = flowCallbackPayload({ runId: pendingId, ...tap });
      const { error } = await admin.from("flow_runs").insert({
        id: pendingId, organization_id: st.organizationId, conversation_id: st.conversationId,
        flow_id: flow.id, flow_name: flow.name, state: pendingState as never, next_step: i,
        status: "running", resume_at: new Date(Date.now() + FORM_TIMEOUT_MS).toISOString(),
      });
      if (error) { await log(admin, st, "failed", `${flow.name}:pending_tap_save_failed`); return true; }
    }
    if (s.kind === "follow_gate") buttons.push({ type: "postback", title: FOLLOWED_TITLE, payload: tapPayload });
    const shapes = s.kind === "opening_dm" ? a.openerMessages(msgText, s.buttonTitle, tapPayload)
      : buttons.length ? a.flowButtonMessages(msgText, buttons) : [{ text: msgText }];
    let sentId: string | undefined;
    let err = "";
    for (const message of shapes) {
      const r = await a.flowCallMessaging(st.platform, c.accountId, { recipient, message, access_token: c.token });
      if (!r.error) { sentId = r.id; err = ""; break; }
      err = r.error;
    }
    if (err) {
      if (pendingId) await admin.from("flow_runs").update({ status: "failed", detail: "prompt_send_failed" }).eq("id", pendingId);
      await log(admin, st, "failed", `${flow.name}:${err}`); return true;
    }
    if (viaComment) st.usedCommentReply = true;
    await recordOutbound(admin, st, flow, (viaComment ? "[private reply] " : "") + msgText + (btn ? `\n[${btn.title}] ${btn.url}` : ""), sentId ?? null);
    await log(admin, st, "sent", `${flow.name}:${s.kind}`);
    acted = true;
    if (pendingId && pendingState) {
      await admin.from("flow_runs").update({ status: "awaiting_reply", state: { ...pendingState, usedCommentReply: st.usedCommentReply } as never }).eq("id", pendingId).eq("status", "running");
    }
    if (stopAfterSend) return true;
  }
  return acted;
}

/** Send one lead-form question (choices as quick-reply taps) through the normal safety gate. */
async function sendFormQuestion(admin: AdminClient, flow: Flow, st: RunState, f: LeadField, prefix: string): Promise<boolean> {
  const block = await safetyBlock(admin, st);
  if (block) { await log(admin, st, "skipped", `${flow.name}:${block}`); return false; }
  const c = await credentials(admin, st);
  if (!c) { await log(admin, st, "failed", `${flow.name}:no_token`); return false; }
  const a = await import("@/lib/automation.server");
  const text = [prefix, f.label].filter(Boolean).join("\n\n").slice(0, 1000);
  const viaComment = st.channel === "comment" && st.externalId && !st.usedCommentReply;
  const recipient = viaComment ? { comment_id: st.externalId } : { id: st.externalUserId };
  const message = f.type === "choice" && f.options.length
    ? { text, quick_replies: f.options.map((o) => ({ content_type: "text", title: o, payload: `LEADFORM_${o}`.slice(0, 1000) })) }
    : { text };
  const r = await a.flowCallMessaging(st.platform, c.accountId, { recipient, message, access_token: c.token });
  if (r.error) { await log(admin, st, "failed", `${flow.name}:${r.error}`); return false; }
  if (viaComment) st.usedCommentReply = true;
  await recordOutbound(admin, st, flow, (viaComment ? "[private reply] " : "") + text, r.id ?? null);
  await log(admin, st, "sent", `${flow.name}:lead_form`);
  return true;
}

/** A DM answering an open lead form: save it, ask the next question or continue the flow. Returns true when handled. */
async function continueLeadForm(admin: AdminClient, ev: FlowEvent, flags: Record<string, unknown>): Promise<boolean> {
  if (ev.channel === "comment") return false;
  const { data: run } = await admin.from("flow_runs").select("id, flow_id, state, next_step")
    .eq("conversation_id", ev.conversationId).not("state->form", "is", null).eq("status", "awaiting_reply").gt("resume_at", new Date().toISOString())
    .order("created_at", { ascending: false }).limit(1).maybeSingle();
  if (!run) return false;
  const { data: claimed } = await admin.from("flow_runs").update({ status: "running", updated_at: new Date().toISOString() })
    .eq("id", run.id).eq("status", "awaiting_reply").select("id");
  if (!claimed?.length) return true;
  const finish = (status: string, detail: string | null = null, state?: RunState) =>
    admin.from("flow_runs").update({ status, detail, ...(state ? { state: state as never } : {}), updated_at: new Date().toISOString() }).eq("id", run.id);
  const flow = sanitizeFlows(flags[`flows_cfg_${ev.organizationId}`]).find((f) => f.id === run.flow_id && f.active);
  const prev = run.state as RunState;
  const step = flow?.steps[run.next_step];
  if (prev.gate || prev.tap) { await finish("awaiting_reply"); return false; }
  if (!flow || !prev.form || step?.kind !== "lead_form") { await finish("cancelled", "flow_off_or_changed"); return false; }
  const st: RunState = { ...prev, channel: ev.channel, externalId: ev.externalId, originalCommentId: prev.originalCommentId ?? (prev.channel === "comment" ? prev.externalId : null) };
  const form = { ...prev.form, answers: { ...prev.form.answers } };
  const field = step.fields[form.field];
  if (!field) { await finish("cancelled", "form_changed"); return false; }
  const ans = leadAnswer(field, ev.body ?? "");
  if (!ans.ok) {
    await sendFormQuestion(admin, flow, st, field, ans.hint);
    await finish("awaiting_reply", null, { ...st, form });
    return true;
  }
  form.answers[field.key] = ans.value;
  // Save into Contacts (custom fields; email/phone also into their own columns, never overwriting).
  const key = { organization_id: ev.organizationId, platform: ev.platform, external_user_id: ev.externalUserId };
  const { data: cur } = await admin.from("contact_profiles").select("email, phone, custom_fields")
    .eq("organization_id", key.organization_id).eq("platform", key.platform).eq("external_user_id", key.external_user_id).maybeSingle();
  const custom = { ...((cur?.custom_fields as Record<string, unknown> | null) ?? {}), [field.key]: ans.value };
  await admin.from("contact_profiles").upsert({
    ...key, custom_fields: custom as never,
    email: cur?.email || (field.type === "email" ? ans.value : null),
    phone: cur?.phone || (field.type === "phone" ? ans.value : null),
    updated_at: new Date().toISOString(),
  }, { onConflict: "organization_id,platform,external_user_id" });
  const next = step.fields[form.field + 1];
  if (next) {
    form.field += 1;
    await sendFormQuestion(admin, flow, st, next, "");
    await finish("awaiting_reply", null, { ...st, form });
    return true;
  }
  await finish("done", "form_completed");
  await log(admin, st, "matched", `${flow.name}:form_completed`);
  const { form: _done, ...rest } = st;
  await executeSteps(admin, flow, rest, run.next_step + 1);
  return true;
}

/** Resolve flow payload to its original account before inbox ingestion. No rules table is touched. */
export async function resolveFlowTapAccount(admin: AdminClient, payload: string | null, receivingId: string | null, senderId: string | null) {
  const callback = parseFlowCallback(payload);
  if (!callback || !receivingId || !senderId) return null;
  const { data: run } = await admin.from("flow_runs").select("organization_id, state").eq("id", callback.runId).maybeSingle();
  const st = run?.state as RunState | undefined;
  if (!st?.socialAccountId || !st.tap || st.externalUserId !== senderId || st.tap.nonce !== callback.nonce || st.tap.stage !== callback.stage) return null;
  const { data: account } = await admin.from("social_accounts").select("id, organization_id, platform, external_id, metadata").eq("id", st.socialAccountId).maybeSingle();
  const pageId = (account?.metadata as { page_id?: string } | null)?.page_id;
  if (!account || account.organization_id !== run?.organization_id || st.organizationId !== account.organization_id || st.platform !== account.platform ||
    (receivingId !== account.external_id && receivingId !== pageId)) return null;
  return account as { id: string; organization_id: string; platform: "instagram" | "facebook" };
}

/** Run-bound stage/nonce/contact checks and compare-and-set prevent duplicate or unrelated taps. */
export async function continueFlowTap(admin: AdminClient, ev: FlowEvent, flags: Record<string, unknown>): Promise<boolean> {
  if (!ev.payload?.startsWith("FLOW_TAP:")) return false;
  const callback: FlowCallback | null = parseFlowCallback(ev.payload);
  if (!callback || ev.channel === "comment" || !liveFlowsActive(flags, ev.organizationId)) return true;
  const { data: run } = await admin.from("flow_runs").select("id, flow_id, state, next_step")
    .eq("id", callback.runId).eq("organization_id", ev.organizationId).eq("status", "awaiting_reply")
    .gt("resume_at", new Date().toISOString()).maybeSingle();
  if (!run) return true;
  const prev = run.state as RunState;
  const flow = sanitizeFlows(flags[`flows_cfg_${ev.organizationId}`]).find((f) => f.id === run.flow_id && f.active);
  const step = flow?.steps[run.next_step];
  if (!prev.tap || !step || !callbackMatches(callback, prev.tap, prev, ev, step.id)) return true;
  if (step.disabled || (callback.stage === "opener" ? step.kind !== "opening_dm" : step.kind !== "follow_gate")) return true;
  const block = await safetyBlock(admin, ev) ?? (prev.conversationId !== ev.conversationId ? await safetyBlock(admin, prev) : null);
  if (block) { await log(admin, ev, "skipped", `${flow?.name}:${block}`); return true; }
  const { data: claimed } = await admin.from("flow_runs").update({ status: "running", updated_at: new Date().toISOString() })
    .eq("id", run.id).eq("status", "awaiting_reply").select("id");
  if (!claimed?.length || !flow) return true;
  try {
    const { tap: _tap, form: _form, ...rest } = prev;
    const st: RunState = { ...rest, conversationId: ev.conversationId, externalUserId: ev.externalUserId,
      channel: ev.channel, externalId: ev.externalId, usedCommentReply: true,
      originalCommentId: prev.originalCommentId ?? prev.externalId };
    await log(admin, ev, "matched", `${flow.name}:${callback.stage}_tap_received`);
    if (callback.stage === "follow") {
      const c = await credentials(admin, st);
      const a = await import("@/lib/automation.server");
      const followed = c ? await a.flowCheckFollows(st.platform, st.externalUserId, c.token) : null;
      if (followed === true) {
        const { gate: _gate, ...ungated } = st;
        await executeSteps(admin, flow, ungated, run.next_step + 1);
      } else if ((prev.gate?.tries ?? 0) < MAX_GATE_TRIES) {
        st.gate = { step: run.next_step, tries: (prev.gate?.tries ?? 0) + 1 };
        await executeSteps(admin, flow, st, run.next_step);
      } else await log(admin, ev, "skipped", `${flow.name}:gate_gave_up`);
    } else await executeSteps(admin, flow, st, run.next_step + 1);
    await admin.from("flow_runs").update({ status: "done", detail: `${callback.stage}_tap_received`, updated_at: new Date().toISOString() }).eq("id", run.id).eq("status", "running");
  } catch (e) {
    await admin.from("flow_runs").update({ status: "failed", detail: "tap_resume_failed" }).eq("id", run.id).eq("status", "running");
    console.error("flow tap resume failed", e);
  }
  return true;
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
    if (ev.payload?.startsWith("FLOW_TAP:")) { await continueFlowTap(admin, ev, flags); return; }
    const { count: ruleSent } = await admin.from("automation_runs").select("id", { count: "exact", head: true })
      .eq("conversation_id", ev.conversationId).eq("status", "sent").not("rule_id", "is", null).gte("created_at", startedAt);
    if ((ruleSent ?? 0) === 0 && (await continueLeadForm(admin, ev, flags))) return;
    const trigger = flowTriggerFor(ev.channel, ev.trigger);
    const flows = sanitizeFlows(flags[`flows_cfg_${ev.organizationId}`]).filter(
      (f) => f.active && f.trigger === trigger && (f.platform === "both" || f.platform === ev.platform) && flowTargetsPost(f, ev.postExternalId ?? null),
    );
    if (flows.length === 0) return;
    // Keyword rules win: if one already sent for this event, flows stay quiet.
    const { count } = await admin.from("automation_runs").select("id", { count: "exact", head: true })
      .eq("conversation_id", ev.conversationId).eq("status", "sent").not("rule_id", "is", null).gte("created_at", startedAt);
    if ((count ?? 0) > 0) return;
    for (const flow of flows) {
      if (await executeSteps(admin, flow, { ...ev, runKey: `flow:${flow.id}:${crypto.randomUUID()}` }, 0)) return;
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
