import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type AutomationRule = {
  id: string;
  organization_id: string;
  name: string;
  is_active: boolean;
  priority: number;
  platform: "instagram" | "facebook" | "youtube" | null;
  trigger: "dm_received" | "comment_received";
  match_type: "any" | "contains" | "exact" | "starts_with";
  keywords: string[];
  action:
    | "reply_dm"
    | "comment_public_reply"
    | "comment_private_reply"
    | "hide_comment"
    | "set_status";
  response_text: string | null;
  set_status: "open" | "pending" | "resolved" | null;
  cooldown_seconds: number;
  daily_limit: number;
  created_at: string;
};

export type AutomationRun = {
  id: string;
  rule_id: string | null;
  conversation_id: string | null;
  status: "matched" | "sent" | "skipped" | "failed";
  detail: string | null;
  created_at: string;
};

const SELECT =
  "id, organization_id, name, is_active, priority, platform, trigger, match_type, keywords, action, response_text, set_status, cooldown_seconds, daily_limit, created_at";

const ruleInput = z.object({
  name: z.string().trim().min(1).max(80),
  isActive: z.boolean(),
  priority: z.number().int().min(1).max(999),
  platform: z.enum(["instagram", "facebook"]).nullable(),
  trigger: z.enum(["dm_received", "comment_received"]),
  matchType: z.enum(["any", "contains", "exact", "starts_with"]),
  keywords: z.array(z.string().trim().min(1).max(60)).max(20),
  action: z.enum([
    "reply_dm",
    "comment_public_reply",
    "comment_private_reply",
    "hide_comment",
    "set_status",
  ]),
  responseText: z.string().trim().max(1000).nullable(),
  setStatus: z.enum(["open", "pending", "resolved"]).nullable(),
  cooldownSeconds: z.number().int().min(0).max(86400),
  dailyLimit: z.number().int().min(1).max(5000),
});

function toRow(input: z.infer<typeof ruleInput>) {
  return {
    name: input.name,
    is_active: input.isActive,
    priority: input.priority,
    platform: input.platform,
    trigger: input.trigger,
    match_type: input.matchType,
    keywords: input.keywords,
    action: input.action,
    response_text: input.responseText,
    set_status: input.setStatus,
    cooldown_seconds: input.cooldownSeconds,
    daily_limit: input.dailyLimit,
  };
}

export const listAutomationRules = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z.object({ organizationId: z.string().uuid() }).parse(data),
  )
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
      .from("automation_rules")
      .select(SELECT)
      .eq("organization_id", data.organizationId)
      .order("priority", { ascending: true })
      .limit(100);
    if (error) throw new Error(error.message);
    return (rows ?? []) as AutomationRule[];
  });

export const createAutomationRule = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    ruleInput.extend({ organizationId: z.string().uuid() }).parse(data),
  )
  .handler(async ({ data, context }) => {
    const { organizationId, ...rest } = data;
    const { error } = await context.supabase.from("automation_rules").insert({
      organization_id: organizationId,
      created_by: context.userId,
      ...toRow(rest),
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const updateAutomationRule = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    ruleInput.partial().extend({ id: z.string().uuid() }).parse(data),
  )
  .handler(async ({ data, context }) => {
    const { id, ...rest } = data;
    const patch: Record<string, unknown> = {};
    if (rest.name !== undefined) patch["name"] = rest.name;
    if (rest.isActive !== undefined) patch["is_active"] = rest.isActive;
    if (rest.priority !== undefined) patch["priority"] = rest.priority;
    if (rest.platform !== undefined) patch["platform"] = rest.platform;
    if (rest.trigger !== undefined) patch["trigger"] = rest.trigger;
    if (rest.matchType !== undefined) patch["match_type"] = rest.matchType;
    if (rest.keywords !== undefined) patch["keywords"] = rest.keywords;
    if (rest.action !== undefined) patch["action"] = rest.action;
    if (rest.responseText !== undefined) patch["response_text"] = rest.responseText;
    if (rest.setStatus !== undefined) patch["set_status"] = rest.setStatus;
    if (rest.cooldownSeconds !== undefined) patch["cooldown_seconds"] = rest.cooldownSeconds;
    if (rest.dailyLimit !== undefined) patch["daily_limit"] = rest.dailyLimit;

    const { error } = await context.supabase
      .from("automation_rules")
      .update(patch)
      .eq("id", id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteAutomationRule = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("automation_rules")
      .delete()
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const listAutomationRuns = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z.object({ organizationId: z.string().uuid() }).parse(data),
  )
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
      .from("automation_runs")
      .select("id, rule_id, conversation_id, status, detail, created_at")
      .eq("organization_id", data.organizationId)
      .order("created_at", { ascending: false })
      .limit(40);
    if (error) throw new Error(error.message);
    return (rows ?? []) as AutomationRun[];
  });
