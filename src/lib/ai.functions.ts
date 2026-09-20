import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const GATEWAY = "https://ai.gateway.lovable.dev/v1/chat/completions";
const MODEL = "google/gemini-2.5-flash";

type ChatMessage = { role: "system" | "user"; content: string };

async function chat(messages: ChatMessage[]): Promise<string> {
  const apiKey = process.env["LOVABLE_API_KEY"];
  if (!apiKey) throw new Error("AI is not configured yet");

  const response = await fetch(GATEWAY, {
    method: "POST",
    headers: {
      authorization: `Bearer ${apiKey}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({ model: MODEL, messages }),
  });

  if (response.status === 429) {
    throw new Error("AI is busy right now — try again in a moment");
  }
  if (response.status === 402) {
    throw new Error("AI credits are exhausted — top up to keep using the assistant");
  }
  if (!response.ok) {
    throw new Error("The AI service could not complete this request");
  }

  const data = (await response.json()) as {
    choices?: { message?: { content?: string } }[];
  };
  const text = data.choices?.[0]?.message?.content?.trim();
  if (!text) throw new Error("The AI returned an empty answer");
  return text;
}

/** Splits a numbered/bulleted answer into clean options. */
function toOptions(text: string, max: number): string[] {
  const blocks = text
    .split(/\n{2,}|\n(?=\s*(?:\d+[.)]|[-*•]))/g)
    .map((block) =>
      block
        .replace(/^\s*(?:\d+[.)]|[-*•])\s*/, "")
        .replace(/^["“]|["”]$/g, "")
        .trim(),
    )
    .filter(Boolean);
  const list = blocks.length > 0 ? blocks : [text];
  return list.slice(0, max);
}

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
    const text = await chat([
      {
        role: "system",
        content:
          "You are a social media copywriter. Write scroll-stopping captions that sound human, never corporate. Reply with exactly 3 captions, numbered 1., 2., 3. No preamble, no commentary.",
      },
      {
        role: "user",
        content: [
          `Platform: ${platformLabel[data.platform]}`,
          `Tone: ${data.tone}`,
          `Post idea: ${data.topic}`,
          data.withHashtags
            ? "End each caption with 5-8 relevant hashtags."
            : "Do not use hashtags.",
        ].join("\n"),
      },
    ]);
    return { options: toOptions(text, 3) };
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
    const text = await chat([
      {
        role: "system",
        content:
          "You write replies for a brand's Instagram and Facebook inbox. Keep each reply under 40 words, warm, specific and ready to send as-is. Reply with exactly 3 options, numbered 1., 2., 3. No preamble.",
      },
      {
        role: "user",
        content: [
          `Tone: ${data.tone}`,
          data.context ? `About the business: ${data.context}` : "",
          `Customer wrote: "${data.message}"`,
        ]
          .filter(Boolean)
          .join("\n"),
      },
    ]);
    return { options: toOptions(text, 3) };
  });

const suggestedRule = z.object({
  name: z.string().max(80),
  trigger: z.enum(["dm_received", "comment_received"]),
  matchType: z.enum(["any", "contains", "exact", "starts_with"]),
  keywords: z.array(z.string()).max(20),
  action: z.enum([
    "reply_dm",
    "comment_public_reply",
    "comment_private_reply",
    "hide_comment",
    "set_status",
  ]),
  responseVariations: z.array(z.string()).max(3),
});

export type SuggestedRule = z.infer<typeof suggestedRule>;

export const suggestAutomation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z.object({ goal: z.string().trim().min(5).max(600) }).parse(data),
  )
  .handler(async ({ data }) => {
    const text = await chat([
      {
        role: "system",
        content: [
          "You design keyword automation rules for an Instagram/Facebook inbox tool.",
          "Answer with raw JSON only — no markdown fences, no commentary.",
          'Shape: {"name":string,"trigger":"dm_received"|"comment_received","matchType":"any"|"contains"|"exact"|"starts_with","keywords":string[],"action":"reply_dm"|"comment_public_reply"|"comment_private_reply"|"hide_comment"|"set_status","responseVariations":string[]}',
          "Give 3-8 lowercase keywords and 2-3 friendly reply variations under 40 words each.",
        ].join("\n"),
      },
      { role: "user", content: `Goal: ${data.goal}` },
    ]);

    const cleaned = text.replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();
    try {
      return { rule: suggestedRule.parse(JSON.parse(cleaned)) };
    } catch {
      throw new Error("The AI answer could not be read — try rewording the goal");
    }
  });
