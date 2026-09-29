import { createOpenAI } from "@ai-sdk/openai";
import { streamText } from "ai";

const MODEL = "openai/gpt-6-astra";

function cleanReply(value: string) {
  const text = value.replace(/^['"]|['"]$/g, "").replace(/\s+/g, " ").trim();
  if (!text || text.length > 700) return null;
  return text;
}

export async function generateYouTubeReply(input: {
  comment: string;
  approvedReply: string | null;
  link: string | null;
}): Promise<string | null> {
  const key = process.env["LOVABLE_API_KEY"];
  if (!key) return null;
  const { createLovableAiGatewayRunIdFetch } = await import("@/lib/ai-gateway.server");
  const runIdFetch = createLovableAiGatewayRunIdFetch();
  const provider = createOpenAI({
    baseURL: "https://ai.gateway.lovable.dev/v1",
    apiKey: key,
    headers: { "Lovable-API-Key": key, "X-Lovable-AIG-SDK": "vercel-ai-sdk" },
    fetch: runIdFetch.fetch,
  });
  const result = streamText({
    model: provider.responses(MODEL),
    system: [
      "Write one natural public YouTube reply to the viewer's comment.",
      "Sound warm and human, not generic or promotional. Keep it under 45 words.",
      "Respond only to what the viewer actually said. Never invent facts, promises or personal details.",
      "Do not mention automation or AI. Do not add hashtags. Return only the reply text.",
      "If an approved reference reply is provided, preserve its intent without copying it mechanically.",
      "Do not include a URL; the application appends the approved link separately.",
    ].join(" "),
    prompt: [
      `Viewer comment: ${input.comment.slice(0, 1000)}`,
      input.approvedReply ? `Approved reference reply: ${input.approvedReply.slice(0, 700)}` : "",
      input.link ? "An approved link will be appended after your reply." : "",
    ]
      .filter(Boolean)
      .join("\n"),
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
  return cleanReply(await result.text);
}