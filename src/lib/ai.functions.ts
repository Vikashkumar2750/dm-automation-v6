import { createOpenAI } from "@ai-sdk/openai";
import { createServerFn } from "@tanstack/react-start";
import { Output, streamText } from "ai";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const MODEL = "openai/gpt-6-astra";

async function runModel<T>(
  prompt: string,
  system: string,
  schema: z.ZodType<T>,
): Promise<T> {
  const key = process.env["LOVABLE_API_KEY"];
  if (!key) throw new Error("AI is not configured yet");

  const { createLovableAiGatewayRunIdFetch } = await import("@/lib/ai-gateway.server");
  const runIdFetch = createLovableAiGatewayRunIdFetch();
  const lovable = createOpenAI({
    baseURL: "https://ai.gateway.lovable.dev/v1",
    apiKey: key,
    headers: { "Lovable-API-Key": key, "X-Lovable-AIG-SDK": "vercel-ai-sdk" },
    fetch: runIdFetch.fetch,
  });

  try {
    const result = streamText({
      model: lovable.responses(MODEL),
      system,
      prompt,
      output: Output.object({ schema }),
      providerOptions: {
        openai: {
          forceReasoning: true,
          reasoningEffort: "low",
          reasoningSummary: "auto",
          store: false,
          include: ["reasoning.encrypted_content"],
        },
      },
    });
    return await result.output;
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message.includes("429")) {
      throw new Error("AI is busy right now — try again in a moment");
    }
    if (message.includes("402")) {
      throw new Error("AI credits are exhausted — top up to keep using the assistant");
    }
    throw new Error("The AI service could not complete this request");
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
  .handler(async ({ data }) => {
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
  .handler(async ({ data }) => {
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
  .handler(async ({ data }) => {
    const rule = await runModel(
      `Goal: ${data.goal}`,
      [
        "You design keyword automation rules for an Instagram/Facebook inbox tool.",
        "Give 3-8 lowercase keywords and 2-3 friendly reply variations under 40 words each.",
        "Keep the rule name under 80 characters.",
      ].join("\n"),
      suggestedRule,
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
