// Outbound DMs (private replies, follow-gate prompts, link buttons) belong in
// the contact's DM thread, never in the comment thread that triggered them.
// Only the inbox record changes here; delivery is untouched.
type Admin = { from: (t: string) => any };

export async function inboxThreadFor(
  admin: Admin,
  conversationId: string | null | undefined,
  body: string,
): Promise<string | null | undefined> {
  if (!conversationId || body.startsWith("[public reply]")) return conversationId;
  const { data: conv } = await admin
    .from("conversations")
    .select("organization_id, social_account_id, platform, external_user_id, external_user_name, channel")
    .eq("id", conversationId)
    .maybeSingle();
  if (!conv || conv.channel !== "comment") return conversationId;
  const { data: dm } = await admin
    .from("conversations")
    .upsert(
      {
        organization_id: conv.organization_id,
        social_account_id: conv.social_account_id,
        platform: conv.platform,
        external_user_id: conv.external_user_id,
        external_user_name: conv.external_user_name,
        channel: "dm",
      },
      { onConflict: "organization_id,platform,external_user_id,channel" },
    )
    .select("id")
    .single();
  return dm?.id ?? conversationId;
}
