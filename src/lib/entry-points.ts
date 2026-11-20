/** Story-only normalization. Ordinary comment and DM rules are returned unchanged. */
export function isStoryTrigger(trigger: string | undefined): boolean {
  return trigger === "story_reply" || trigger === "story_mention";
}

export function normalizeStoryInput<T extends { trigger?: string; platform?: unknown; targetPostIds?: string[]; matchType?: string; keywords?: string[]; action?: string; commentReplyText?: unknown; commentReplyVariations?: string[] }>(input: T): T {
  if (!isStoryTrigger(input.trigger)) return input;
  return {
    ...input,
    platform: "instagram",
    targetPostIds: [],
    action: input.action === "set_status" ? "set_status" : "reply_dm",
    commentReplyText: null,
    commentReplyVariations: [],
    ...(input.trigger === "story_mention" ? { matchType: "any", keywords: [] } : {}),
  };
}

/** Also handles previously saved story rules without rewriting any active rows. */
export function normalizeStoryRule<T extends { trigger: string; platform: unknown; target_post_ids: string[] | null; match_type: string; keywords: string[] | null; action: string; comment_reply_text: string | null; comment_reply_variations: string[] | null }>(rule: T): T {
  if (!isStoryTrigger(rule.trigger)) return rule;
  return {
    ...rule,
    platform: "instagram",
    target_post_ids: [],
    action: rule.action === "set_status" ? "set_status" : "reply_dm",
    comment_reply_text: null,
    comment_reply_variations: [],
    ...(rule.trigger === "story_mention" ? { match_type: "any", keywords: [] } : {}),
  };
}