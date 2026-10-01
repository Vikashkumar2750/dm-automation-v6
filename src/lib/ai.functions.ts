import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function runModel<T>(
  prompt: string,
  system: string,
  schema: z.ZodType<T>,
  userId: string,
  shape: string,
): Promise<T> {
  const { readAiProviders, generateWithFailover, sanitisePromptInput } = await import(
    "@/lib/ai-providers.server"
  );
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const config = await readAiProviders(supabaseAdmin);
  const { readAiDailyLimit } = await import("@/lib/site-settings.server");
  const limit = await readAiDailyLimit(supabaseAdmin);
  const { data: used, error: quotaError } = await supabaseAdmin.rpc("consume_ai_request" as never, {
    _user_id: userId,
    _limit: limit,
  } as never);
  if (quotaError) throw new Error("Could not check your AI limit — please try again");
  if ((used as unknown as number) < 0) {
    throw new Error(`You've used all ${limit} AI requests for today. The limit resets tomorrow.`);
  }
  const result = await generateWithFailover({
    // The dashboard assistant uses the same keys as YouTube replies,
    // independent of the YouTube on/off switch.
    config: { ...config, enabled: true, useLovableFallback: true, maxCallsPerHour: 40 },
    system: `${system}\nRespond with ONLY a valid JSON object matching this shape, no markdown fences: ${shape}`,
    prompt: sanitisePromptInput(prompt, 3000),
    scope: `assistant:${userId}`,
    long: true,
  });
  if (!result.text) {
    const last = result.attempts.at(-1);
    if (last?.provider === "budget") throw new Error("Hourly AI limit reached — try again later");
    if (last?.status === 402) throw new Error("AI credits are exhausted — add credits or another key in Super admin → Settings");
    if (last?.status === 429) throw new Error("AI is busy right now — try again in a moment");
    throw new Error("The AI service could not complete this request");
  }
  const match = result.text.replace(/```(?:json)?/gi, "").match(/\{[\s\S]*\}/);
  try {
    return schema.parse(JSON.parse(match ? match[0] : result.text));
  } catch {
    throw new Error("The AI reply was not in the expected format — please try again");
  }
}

const optionsSchema = z.object({ options: z.array(z.string()) });

const platformLabel: Record<string, string> = {
  instagram: "Instagram",
  facebook: "a Facebook Page",
};

export const generateCaptions = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        topic: z.string().trim().min(3).max(600),
        platform: z.enum(["instagram", "facebook"]),
        tone: z.string().trim().min(2).max(40),
        withHashtags: z.boolean(),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const result = await runModel(
      [
        `Platform: ${platformLabel[data.platform]}`,
        `Tone: ${data.tone}`,
        `Post idea: ${data.topic}`,
        data.withHashtags
          ? "End each caption with 5-8 relevant hashtags."
          : "Do not use hashtags.",
      ].join("\n"),
      "You are a social media copywriter. Write scroll-stopping captions that sound human, never corporate. Return exactly 3 captions in the options array.",
      optionsSchema,
      context.userId,
      '{"options": ["string", "string", "string"]}',
    );
    return { options: result.options.slice(0, 3) };
  });

export const suggestReplies = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        message: z.string().trim().min(2).max(2000),
        tone: z.string().trim().min(2).max(40),
        context: z.string().trim().max(600),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const result = await runModel(
      [
        `Tone: ${data.tone}`,
        data.context ? `About the business: ${data.context}` : "",
        `Customer wrote: "${data.message}"`,
      ]
        .filter(Boolean)
        .join("\n"),
      "You write replies for a brand's Instagram and Facebook inbox. Keep each reply under 40 words, warm, specific and ready to send as-is. Return exactly 3 options in the options array.",
      optionsSchema,
      context.userId,
      '{"options": ["string", "string", "string"]}',
    );
    return { options: result.options.slice(0, 3) };
  });

const suggestedRule = z.object({
  name: z.string(),
  trigger: z.enum(["dm_received", "comment_received"]),
  matchType: z.enum(["any", "contains", "exact", "starts_with"]),
  keywords: z.array(z.string()),
  action: z.enum([
    "reply_dm",
    "comment_public_reply",
    "comment_private_reply",
    "hide_comment",
    "set_status",
  ]),
  responseVariations: z.array(z.string()),
});

export type SuggestedRule = z.infer<typeof suggestedRule>;

export const suggestAutomation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z.object({ goal: z.string().trim().min(5).max(600) }).parse(data),
  )
  .handler(async ({ data, context }) => {
    const rule = await runModel(
      `Goal: ${data.goal}`,
      [
        "You design keyword automation rules for an Instagram/Facebook inbox tool.",
        "Give 3-8 lowercase keywords and 2-3 friendly reply variations under 40 words each.",
        "Keep the rule name under 80 characters.",
      ].join("\n"),
      suggestedRule,
      context.userId,
      '{"name": string, "trigger": "dm_received"|"comment_received", "matchType": "any"|"contains"|"exact"|"starts_with", "keywords": string[], "action": "reply_dm"|"comment_public_reply"|"comment_private_reply"|"hide_comment"|"set_status", "responseVariations": string[]}',
    );
    return {
      rule: {
        ...rule,
        name: rule.name.slice(0, 80),
        keywords: rule.keywords.slice(0, 20),
        responseVariations: rule.responseVariations.slice(0, 3),
      } satisfies SuggestedRule,
    };
  });
