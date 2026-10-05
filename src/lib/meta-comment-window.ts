/** Meta allows a private reply to a comment only within 7 days of it being posted. */
export const PRIVATE_REPLY_WINDOW_MS = 7 * 24 * 3600_000;

/** Returns false only when the comment time is known and older than 7 days. */
export function withinPrivateReplyWindow(createdTime: unknown, now = Date.now()) {
  if (createdTime == null || createdTime === "") return true;
  const t =
    typeof createdTime === "number"
      ? createdTime < 1e12 ? createdTime * 1000 : createdTime
      : Date.parse(String(createdTime));
  if (!Number.isFinite(t)) return true;
  return now - t <= PRIVATE_REPLY_WINDOW_MS;
}
