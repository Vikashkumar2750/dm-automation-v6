import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { AutomationRun } from "./automations.functions";

/** Read-only: post-wise comment, reply and automation views. Never touches delivery. */

export type PostCounts = Record<string, { comments: number; conversations: number }>;

/** post external id -> number of linked comments / commenters. */
export const listPostCommentCounts = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ organizationId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
      .from("messages")
      .select("post_external_id, conversation_id, conversations!inner(organization_id)")
      .eq("conversations.organization_id", data.organizationId)
      .not("post_external_id", "is", null)
      .eq("direction", "inbound")
      .order("sent_at", { ascending: false })
      .limit(5000);
    if (error) throw new Error(error.message);
    const out: Record<string, { comments: number; convs: Set<string> }> = {};
    for (const r of rows ?? []) {
      const k = r.post_external_id as string;
      const e = (out[k] ??= { comments: 0, convs: new Set() });
      e.comments += 1;
      e.convs.add(r.conversation_id);
    }
    return Object.fromEntries(Object.entries(out).map(([k, v]) => [k, { comments: v.comments, conversations: v.convs.size }])) as PostCounts;
  });

export type JourneyMessage = {
  id: string;
  conversation_id: string;
  direction: string;
  body: string;
  sender_name: string | null;
  sent_at: string;
  manual: boolean;
  post_external_id: string | null;
};
export type JourneyConversation = { id: string; platform: string; channel: string; name: string | null; status: string };

/** Everything that happened on one post: commenters, messages (bot vs manual) and automation runs. */
export const getPostJourney = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ organizationId: z.string().uuid(), postExternalId: z.string().min(1).max(200) }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: links, error } = await context.supabase
      .from("messages")
      .select("conversation_id, conversations!inner(organization_id)")
      .eq("conversations.organization_id", data.organizationId)
      .eq("post_external_id", data.postExternalId)
      .limit(1000);
    if (error) throw new Error(error.message);
    const ids = [...new Set((links ?? []).map((l) => l.conversation_id))].slice(0, 300);
    if (!ids.length) return { conversations: [] as JourneyConversation[], messages: [] as JourneyMessage[], runs: [] as AutomationRun[] };
    const [convs, msgs, runs] = await Promise.all([
      context.supabase.from("conversations").select("id, platform, channel, external_user_name, status").in("id", ids),
      context.supabase.from("messages").select("id, conversation_id, direction, body, sender_name, sent_at, sent_by, post_external_id").in("conversation_id", ids).order("sent_at", { ascending: true }).limit(3000),
      context.supabase.from("automation_runs").select("id, rule_id, conversation_id, status, detail, created_at, run_key").eq("organization_id", data.organizationId).in("conversation_id", ids).order("created_at", { ascending: true }).limit(3000),
    ]);
    if (convs.error) throw new Error(convs.error.message);
    if (msgs.error) throw new Error(msgs.error.message);
    if (runs.error) throw new Error(runs.error.message);
    return {
      conversations: (convs.data ?? []).map((c) => ({ id: c.id, platform: c.platform, channel: c.channel, name: c.external_user_name, status: c.status })) as JourneyConversation[],
      messages: (msgs.data ?? []).map(({ sent_by, ...m }) => ({ ...m, manual: !!sent_by })) as JourneyMessage[],
      runs: (runs.data ?? []) as AutomationRun[],
    };
  });

/** Live like/comment/share/view counts for one post. */
export const getSinglePostStats = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({
    organizationId: z.string().uuid(),
    socialAccountId: z.string().uuid().nullable(),
    platform: z.enum(["instagram", "facebook", "youtube"]),
    externalPostId: z.string().min(1).max(200),
  }).parse(d))
  .handler(async ({ data, context }) => {
    if (!data.socialAccountId) return null;
    const { data: acc } = await context.supabase.from("social_accounts").select("id").eq("id", data.socialAccountId).eq("organization_id", data.organizationId).maybeSingle();
    if (!acc) return null;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { fetchPostStats } = await import("./post-remote.server");
    return fetchPostStats(supabaseAdmin, { id: data.externalPostId, platform: data.platform, social_account_id: data.socialAccountId, external_post_id: data.externalPostId });
  });
