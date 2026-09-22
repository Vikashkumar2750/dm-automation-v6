/**
 * Page-level webhook subscription helpers.
 *
 * Meta only delivers comment/DM webhooks for a Page (and its linked Instagram
 * business account) once the app is installed on that Page via
 * POST /{page-id}/subscribed_apps. Without this call the app receives nothing,
 * even with a perfectly configured webhook callback URL.
 */

const GRAPH = "https://graph.facebook.com/v21.0";

/** Fields that cover comments, feed activity, DMs and postback taps. */
export const PAGE_SUBSCRIBED_FIELDS = [
  "feed",
  "messages",
  "messaging_postbacks",
  "messaging_optins",
  "message_reactions",
  "mention",
];

export type SubscribeResult = { ok: boolean; error?: string };

export async function subscribePageWebhooks(
  pageId: string,
  pageAccessToken: string,
): Promise<SubscribeResult> {
  try {
    const res = await fetch(`${GRAPH}/${pageId}/subscribed_apps`, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        subscribed_fields: PAGE_SUBSCRIBED_FIELDS.join(","),
        access_token: pageAccessToken,
      }),
    });
    const json = (await res.json()) as {
      success?: boolean;
      error?: { message?: string };
    };
    if (!res.ok || json.error) {
      return { ok: false, error: json.error?.message ?? `HTTP ${res.status}` };
    }
    return { ok: Boolean(json.success ?? true) };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Request failed" };
  }
}

/** Reads back which fields the app is currently subscribed to for a Page. */
export async function readPageSubscription(
  pageId: string,
  pageAccessToken: string,
): Promise<{ fields: string[]; error?: string }> {
  try {
    const res = await fetch(
      `${GRAPH}/${pageId}/subscribed_apps?${new URLSearchParams({
        access_token: pageAccessToken,
      })}`,
    );
    const json = (await res.json()) as {
      data?: Array<{ subscribed_fields?: string[] }>;
      error?: { message?: string };
    };
    if (json.error) return { fields: [], error: json.error.message };
    return { fields: json.data?.[0]?.subscribed_fields ?? [] };
  } catch (error) {
    return {
      fields: [],
      error: error instanceof Error ? error.message : "Request failed",
    };
  }
}
