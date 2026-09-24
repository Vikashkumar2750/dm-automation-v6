import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Click tracking for final-DM links and attachments.
 * The DM button points at /api/public/t/<token>; the route logs the click
 * and redirects to the real URL. If anything is missing (no public origin,
 * no key) we return null and the caller keeps the original URL, so delivery
 * never depends on tracking.
 */
let publicOrigin: string | null = process.env["PUBLIC_APP_URL"]?.replace(/\/$/, "") ?? null;

export function setPublicOriginFromRequest(request: Request) {
  try {
    const h = request.headers;
    const host = h.get("x-forwarded-host") ?? h.get("host");
    if (!host || /localhost|127\.0\.0\.1/.test(host)) return;
    const proto = (h.get("x-forwarded-proto") ?? "https").split(",")[0]!.trim();
    publicOrigin = `${proto === "http" ? "https" : proto}://${host.split(",")[0]!.trim()}`;
  } catch {
    /* ignore */
  }
}

export type ClickPayload = {
  o: string; // organization
  r: string | null; // rule
  c: string | null; // conversation
  k: "link" | "attachment";
  u: string; // destination
};

function key() {
  return process.env["SUPABASE_SERVICE_ROLE_KEY"] ?? process.env["CRON_SECRET"] ?? null;
}

const b64 = (s: string) => Buffer.from(s).toString("base64url");

function sign(data: string, k: string) {
  return createHmac("sha256", k).update(`click:${data}`).digest("base64url").slice(0, 22);
}

export function trackedUrl(p: ClickPayload): string | null {
  const k = key();
  if (!publicOrigin || !k || !/^https?:\/\//i.test(p.u)) return null;
  const data = b64(JSON.stringify(p));
  return `${publicOrigin}/api/public/t/${data}.${sign(data, k)}`;
}

export function readToken(token: string): ClickPayload | null {
  const k = key();
  const [data, sig] = token.split(".");
  if (!k || !data || !sig) return null;
  const expected = sign(data, k);
  if (expected.length !== sig.length || !timingSafeEqual(Buffer.from(expected), Buffer.from(sig))) {
    return null;
  }
  try {
    const p = JSON.parse(Buffer.from(data, "base64url").toString()) as ClickPayload;
    return /^https?:\/\//i.test(p.u) ? p : null;
  } catch {
    return null;
  }
}
