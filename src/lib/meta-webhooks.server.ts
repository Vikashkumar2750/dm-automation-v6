/**
 * Page-level webhook subscription helpers.
 *
 * Meta only delivers comment/DM webhooks for a Page (and its linked Instagram
 * business account) once the app is installed on that Page via
 * POST /{page-id}/subscribed_apps. Without this call the app receives nothing,
 * even with a perfectly configured webhook callback URL.
 */

const GRAPH = "https://graph.facebook.com/v21.0";

/** Minimum Page fields required by this app's comment and Messenger flows. */
export const PAGE_SUBSCRIBED_FIELDS = ["feed", "messages", "messaging_postbacks"];

/** Instagram professional-account fields are a separate subscription. */
export const INSTAGRAM_SUBSCRIBED_FIELDS = ["comments", "messages"];

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

const IG_GRAPH = "https://graph.instagram.com";

async function postSubscribedApps(
  base: string,
  objectId: string,
  fields: string[],
  accessToken: string,
): Promise<{ ok: boolean; error?: string; errorCode?: number }> {
  try {
    const res = await fetch(`${base}/${objectId}/subscribed_apps`, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        subscribed_fields: fields.join(","),
        access_token: accessToken,
      }),
    });
    const json = (await res.json()) as {
      success?: boolean;
      error?: { message?: string; code?: number };
    };
    if (!res.ok || json.error) {
      const result: { ok: boolean; error?: string; errorCode?: number } = {
        ok: false,
        error: json.error?.message ?? `HTTP ${res.status}`,
      };
      if (typeof json.error?.code === "number") result.errorCode = json.error.code;
      return result;
    }
    return { ok: Boolean(json.success ?? true) };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Request failed" };
  }
}

/**
 * Installs this app on an Instagram professional account for comments and DMs.
 *
 * Subscribes field-by-field so a partially granted app (e.g. comments allowed,
 * messages not yet approved) still picks up what it can. Meta rejects this call
 * with error (#3) when the token belongs to an Instagram-Business-Login flow;
 * in that case the same call is retried against graph.instagram.com.
 */
export async function subscribeInstagramWebhooks(
  instagramUserId: string,
  accessToken: string,
): Promise<SubscribeResult> {
  const errors: string[] = [];
  let subscribedAny = false;

  for (const field of INSTAGRAM_SUBSCRIBED_FIELDS) {
    let attempt = await postSubscribedApps(GRAPH, instagramUserId, [field], accessToken);
    if (!attempt.ok && attempt.errorCode === 3) {
      attempt = await postSubscribedApps(IG_GRAPH, instagramUserId, [field], accessToken);
    }
    if (attempt.ok) {
      subscribedAny = true;
    } else {
      errors.push(`${field}: ${attempt.error ?? "subscribe failed"}`);
    }
  }

  if (errors.length === 0) return { ok: true };
  return {
    ok: subscribedAny ? true : false,
    error: errors.join("; "),
  };
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
    if (json.error) return { fields: [], error: json.error.message ?? "Request failed" };
    return { fields: json.data?.[0]?.subscribed_fields ?? [] };
  } catch (error) {
    return {
      fields: [],
      error: error instanceof Error ? error.message : "Request failed",
    };
  }
}

export async function readInstagramSubscription(
  instagramUserId: string,
  pageAccessToken: string,
) {
  return readPageSubscription(instagramUserId, pageAccessToken);
}
