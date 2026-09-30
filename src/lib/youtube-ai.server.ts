/**
 * Contextual YouTube comment replies.
 *
 * YouTube has no direct messaging, so a reply must answer the comment itself —
 * never say "check your DM" or "replied in inbox". The prompt below forces the
 * model to mirror the viewer's own language (English, Hindi or Hinglish) and to
 * respond to what they actually wrote.
 */

type AdminClient = import("@supabase/supabase-js").SupabaseClient;

const SYSTEM = [
  "You are the creator of a YouTube channel replying publicly to one viewer comment.",
  "Reply only to what the viewer actually said — mirror their exact topic or question.",
  "Mirror their language: reply in Hinglish for Hinglish, Hindi for Hindi, English for English.",
  "Sound like a real creator: warm, specific, 8 to 30 words, at most one emoji.",
  "Never say DM, inbox, direct message, private message or 'check your messages' — YouTube has no DMs.",
  "Never invent facts, prices, promises, links or personal details.",
  "Never mention AI or automation. No hashtags. Return only the reply text, nothing else.",
].join(" ");

const BANNED = /\b(dm|inbox|direct message|private message|messaged you|check your message)\b/i;

export type YouTubeReplyResult = {
  text: string | null;
  provider: string | null;
  reason: string | null;
};

export async function generateYouTubeReply(
  admin: AdminClient,
  input: {
    comment: string;
    approvedReply: string | null;
    link: string | null;
    videoTitle?: string | null;
    scope?: string;
  },
): Promise<YouTubeReplyResult> {
  const { readAiProviders, generateWithFailover, sanitisePromptInput } = await import(
    "@/lib/ai-providers.server"
  );
  const config = await readAiProviders(admin);

  const comment = sanitisePromptInput(input.comment, 400);
  if (!comment) return { text: null, provider: null, reason: "empty comment" };

  const prompt = [
    input.videoTitle ? `Video title: ${sanitisePromptInput(input.videoTitle, 120)}` : "",
    `Viewer comment: ${comment}`,
    input.approvedReply
      ? `Tone reference from the creator (keep the intent, do not copy it): ${sanitisePromptInput(input.approvedReply, 240)}`
      : "",
    input.link ? "A link will be appended automatically after your reply, so do not write any URL." : "",
    "Write the public reply now.",
  ]
    .filter(Boolean)
    .join("\n");

  const result = await generateWithFailover({
    config,
    system: SYSTEM,
    prompt,
    scope: input.scope ?? "youtube",
  });

  if (!result.text) {
    const last = result.attempts.at(-1);
    return { text: null, provider: null, reason: last ? `${last.provider}: ${last.error}` : "no provider" };
  }
  // Safety net: a model that still mentions DMs is not usable on YouTube.
  if (BANNED.test(result.text)) {
    return { text: null, provider: result.provider, reason: "reply mentioned DM" };
  }
  return { text: result.text, provider: result.provider, reason: null };
}
