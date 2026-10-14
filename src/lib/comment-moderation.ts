export type CommentAction = "edit" | "delete";

/** Only Page-authored public comments can be edited; Instagram has no edit API. */
export function canEditComment(platform: string, direction: string, body: string, externalId: string | null) {
  return platform === "facebook" && direction === "outbound" &&
    body.startsWith("[public reply] ") && Boolean(externalId);
}

export function commentRequest(action: CommentAction, commentId: string, token: string, body?: string) {
  if (!/^[\w-]+$/.test(commentId)) throw new Error("invalid_comment_id");
  if (action === "edit" && (!body?.trim() || body.trim().length > 1000)) throw new Error("invalid_comment_body");
  return {
    url: `https://graph.facebook.com/v21.0/${encodeURIComponent(commentId)}`,
    init: {
      method: action === "delete" ? "DELETE" : "POST",
      headers: { "content-type": "application/json", Authorization: `Bearer ${token}` },
      ...(action === "edit" ? { body: JSON.stringify({ message: body?.trim() }) } : {}),
    },
  };
}

/** Field Meta uses to report a comment's hidden state: Facebook `is_hidden`, Instagram `hidden`. */
export function hiddenField(platform: string) {
  return platform === "facebook" ? "is_hidden" : "hidden";
}

/** Read-back check: Meta sometimes answers success without changing anything. */
export function hideConfirmed(platform: string, readBack: Record<string, unknown> | null, wanted: boolean) {
  if (!readBack || readBack["error"]) return false;
  return readBack[hiddenField(platform)] === wanted;
}

/** A deleted comment can no longer be read; any readable id means it still exists. */
export function deleteConfirmed(readBack: Record<string, unknown> | null) {
  return !readBack || Boolean(readBack["error"]) || !readBack["id"];
}