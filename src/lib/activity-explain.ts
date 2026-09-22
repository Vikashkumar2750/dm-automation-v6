/**
 * Human wording for the raw reason codes the automation engine records.
 * Shared by the admin alerts console, the user dashboard activity feed and
 * the automations page so wording stays identical everywhere.
 */
export function explainReason(detail: string | null): { title: string; hint: string } {
  const code = (detail ?? "").toLowerCase();
  const map: [string, string, string][] = [
    ["no_matching_rule", "No rule matched", "The message did not match any active rule — normal if testing keywords."],
    ["no_token", "Account credentials missing", "Reconnect the social account from Social Accounts."],
    ["window_expired", "24-hour reply window closed", "Meta blocks DMs after 24h of silence — nothing to fix."],
    ["no_comment_id", "Comment reference missing", "The comment was deleted before the reply was sent."],
    ["no_account", "No social account linked", "Connect an account for this workspace."],
    ["comment_reply", "Public comment reply rejected", "Usually a permission or deleted-comment issue."],
    ["follow_prompt", "Follow request message rejected", "Instagram refused the prompt format or the 24h window closed."],
    ["follow_gate", "Follow check could not start", "The follow confirmation step could not be saved. Try the comment again."],
    ["follow_not_confirmed", "Follow not confirmed yet", "The contact can follow the account and tap “I followed” again."],
    ["follow_gate_expired", "Follow check expired", "The contact did not confirm a follow after three checks."],
    ["attachment", "Attachment could not be delivered", "Check the attachment URL is public and the right type."],
    ["not_a_follower", "Skipped: contact does not follow", "Rule is set to followers only."],
    ["already_a_follower", "Skipped: contact already follows", "Rule targets non-followers only."],
    ["paused", "Skipped: automation paused", "Automation is paused for this workspace."],
    ["quiet_hours", "Skipped: quiet hours", "Outside the workspace's sending hours."],
    ["daily_limit", "Skipped: daily limit reached", "Raise the rule's daily cap if this is unexpected."],
    ["cooldown", "Skipped: cooldown active", "The same contact was messaged very recently."],
    ["opt_out", "Skipped: contact opted out", "Contact asked to stop receiving messages."],
    ["blocked_keyword", "Skipped: blocked word", "Message matched a blocked keyword."],
    ["no_response_text", "Rule has no message written", "Open the rule and add the reply text."],
    ["unknown_action", "Rule action not supported", "Edit the rule and pick a valid action."],
  ];
  for (const [key, title, hint] of map) {
    if (code.startsWith(key) || code.includes(key)) return { title, hint };
  }
  if (!code) return { title: "Automation step completed", hint: "" };
  return { title: "Automation could not complete", hint: "Open Recent activity on the Automations page for details." };
}

/** Friendly label for a raw webhook event type like "instagram.comments". */
export function webhookEventLabel(eventType: string, platform: string | null): string {
  const t = eventType.toLowerCase();
  const where = platform === "instagram" ? "Instagram" : platform === "facebook" ? "Facebook" : platform === "youtube" ? "YouTube" : "Social";
  if (t.includes("comment")) return `${where} comment received`;
  if (t.includes("postback")) return `${where} button tap received`;
  if (t.includes("message")) return `${where} DM received`;
  return `${where} event received`;
}
