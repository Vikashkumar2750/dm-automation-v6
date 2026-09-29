/**
 * Human wording for the raw reason codes the automation engine records.
 * Shared by the admin alerts console, the user dashboard activity feed and
 * the automations page so wording stays identical everywhere.
 */
export function explainReason(detail: string | null): { title: string; hint: string } {
  const code = (detail ?? "").toLowerCase().replace(/^trace:[^:]+:/, "");
  const map: [string, string, string][] = [
    ["youtube:own_channel_comment", "YouTube: your own comment was skipped", "Comments made from the connected channel itself are never answered. Test from a different YouTube account."],
    ["youtube:comment:", "YouTube public reply posted", "The matching comment got one public reply."],
    ["youtube:no_matching_rule", "YouTube: no rule matched", "The comment did not match any active rule with platform set to YouTube."],
    ["youtube:daily_limit", "YouTube: daily limit reached", "This rule hit its Max / day limit."],
    ["youtube:no_response_text", "YouTube: reply text missing", "Add a YouTube public reply message to the rule."],
    ["youtube:no_token", "YouTube: channel not authorised", "Reconnect the YouTube channel from Social Accounts."],
    ["youtube:comment_list", "YouTube: could not read comments", "Google refused the comment list — reconnect the channel and confirm the youtube.force-ssl permission."],
    ["youtube:comment_reply", "YouTube: reply was rejected", "Google refused the public reply — see the reason, then reconnect the channel if needed."],
    ["code 10903", "Facebook blocked the DM for this commenter", "Facebook does not allow private replies to this person — usually because they commented as a Page or as an admin/owner of your own Page. Test with a normal personal Facebook profile that is not a Page admin."],
    ["already_replied_on_post", "Skipped: this person was already answered on this post", "One reply per person per post (7 days). Comments on other posts still get a reply."],
    ["post_reply:", "Comment on this post accepted", "First comment by this person on this post — reply is being sent."],
    ["duplicate_comment", "Skipped: this comment was already answered", "Meta allows one private reply per comment, so repeats are ignored."],
    ["gate_not_found", "Button tap not linked to a comment", "The tap arrived but its follow check had already finished or expired. Ask the contact to comment again."],
    ["gate_account_mismatch", "Button tap reached the wrong account", "The tap arrived from an account that does not own this follow check. Reconnect the intended Instagram account."],
    ["gate_lookup", "Button tap could not open its follow check", "The tap arrived, but its saved follow check could not be read. Ask the contact to comment again."],
    ["gate_follow_prompt_pending", "Follow request sent (Facebook)", "Facebook does not tell us who follows the Page, so the contact was asked to follow and tap “I followed ✅”. The link goes out on that tap."],
    ["gate_follow_status_unavailable", "Follow status could not be confirmed", "The tap arrived, but the platform did not confirm the follow. A confirmation prompt will be sent."],
    ["gate_rule_missing", "Rule for this tap was deleted", "The automation rule behind this button no longer exists."],
    ["duplicate_tap", "Duplicate tap ignored", "Meta delivered the same tap twice — only one copy was answered."],
    ["gate:tap_never_received", "“Send me the link” tap never reached us", "Meta did not deliver a button tap before the next comment. For non-followers the message sits in Message Requests — check that messaging_postbacks and standby are subscribed (Check & repair Meta) and the tester has a role in the Meta app."],
    ["gate:follow_confirm_never_received", "“I followed” tap never reached us", "The follow prompt was sent but no confirmation tap arrived from Meta before the next comment."],
    ["no_active_dm_received_rule", "DM did not match any DM rule", "A plain message arrived with no active “New DM” rule. Normal for chat replies."],
    ["no_matching_rule:platform", "No rule matched this platform", "The event arrived correctly, but no active rule includes this platform."],
    ["no_matching_rule:post", "No rule matched this post", "The event arrived correctly, but the rule is restricted to different selected posts."],
    ["no_matching_rule:keyword", "No rule matched this keyword", "The event arrived correctly, but its text did not match the active rule keywords."],
    ["no_matching_rule", "No rule matched", "The event arrived correctly but did not match an active rule."],
    ["no_token", "Account credentials missing", "Reconnect the social account from Social Accounts."],
    ["window_expired", "24-hour reply window closed", "Meta blocks DMs after 24h of silence — nothing to fix."],
    ["no_comment_id", "Comment reference missing", "The comment was deleted before the reply was sent."],
    ["no_account", "No social account linked", "Connect an account for this workspace."],
    ["comment_reply", "Public comment reply rejected", "Usually a permission or deleted-comment issue."],
    ["follow_prompt", "Follow request message rejected", "Instagram refused the prompt format or the 24h window closed."],
    ["follow_status_unavailable", "Follow status unavailable", "The platform did not reveal whether this contact follows yet. A follow confirmation was sent instead of the final link."],
    ["tap_prompt", "“Tap to get it” message rejected", "Meta refused the private reply — the comment may be older than 7 days or already answered."],
    ["follow_gate", "Follow check could not start", "The follow confirmation step could not be saved. Try the comment again."],
    ["follow_not_confirmed", "Follow not confirmed yet", "The contact can follow the account and tap “I followed” again."],
    ["follow_gate_expired", "Follow check expired", "The contact did not confirm a follow after three checks."],
    ["attachment_needs_tap", "Attachment held back", "A comment reply can carry only one message — turn on a follow check or keep the attachment so the contact taps first."],
    ["attachment", "Attachment could not be delivered", "Check the attachment URL is public and the right type. The link was sent as text instead."],
    ["not_a_follower", "Skipped: contact does not follow", "Rule is set to followers only."],
    ["already_a_follower", "Skipped: contact already follows", "Rule targets non-followers only."],
    ["paused", "Skipped: automation paused", "Automation is paused for this workspace."],
    ["quiet_hours", "Skipped: quiet hours", "Outside the workspace's sending hours."],
    ["plan_monthly_dm_limit", "Monthly DM limit reached — upgrade", "Your plan's automated DMs for this month are used up. Upgrade on the Billing page, or wait until the 1st of next month."],
    ["per_contact_limit", "Skipped: contact reply limit reached", "This contact already received the allowed automated replies in the last 24 hours. Raise the per-person limit in Safety settings or wait for it to reset."],
    ["daily_limit", "Skipped: daily limit reached", "Raise the rule's daily cap if this is unexpected."],
    ["cooldown", "Skipped: cooldown active", "The same contact was messaged very recently."],
    ["opt_out", "Skipped: contact opted out", "Contact asked to stop receiving messages."],
    ["blocked_keyword", "Skipped: blocked word", "Message matched a blocked keyword."],
    ["no_response_text", "Rule has no message written", "Open the rule and add the reply text."],
    ["unknown_action", "Rule action not supported", "Edit the rule and pick a valid action."],
    ["trace:echo", "Our own outgoing message", "Delivery receipt of a message we sent — no automation needed."],
    ["trace:self_or_unknown_sender", "Event from our own account", "Meta echoed our account's own action — nothing to automate."],
    ["trace:not_a_comment", "Post event, not a comment", "Likes and other post events do not trigger comment rules."],
    ["trace:comment_removed", "Comment was removed", "A deleted comment cannot trigger automation."],
    ["trace:unsupported_event", "Unsupported event type", "This webhook event type is not used by automation."],
    ["trace:empty_body", "Message had no text", "Media-only or reaction messages cannot match keyword rules."],
    ["trace:duplicate_delivery", "Duplicate delivery skipped", "Meta sent the same event twice — only the first copy ran."],
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

/** Friendly label for a successful step code like "tap_prompt". */
export function stepLabel(detail: string | null): string {
  const code = (detail ?? "").toLowerCase();
  const map: Record<string, string> = {
    comment_reply: "Public reply posted under the comment",
    tap_prompt: "“Send me the link” button sent in DM",
    gate_tap_received: "Button tap received",
    gate_verified_follower: "Follow verified — sending final DM",
    gate_verified_non_follower: "Not following yet — sending follow request",
    follow_prompt: "Follow request sent (Visit profile + I followed)",
    follow_status_unavailable: "Follow confirmation sent — platform did not reveal follow status",
    reply_dm: "Final DM delivered",
    dm_link: "Final DM with link button delivered",
    attachment: "Attachment delivered",
    "click:link": "Contact opened the link 🔗",
    "click:attachment": "Contact opened the attachment 📎",
  };
  for (const [k, v] of Object.entries(map)) if (code.startsWith(k)) return v;
  return code ? `Step completed: ${code}` : "Reply sent";
}
