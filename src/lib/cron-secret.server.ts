/**
 * Shared constant-time verification for scheduler (cron) endpoints.
 * Accepts the secret from the `x-cron-secret` header (preferred) or `?secret=`.
 * Supports rotation: CRON_SECRET (current) and CRON_SECRET_PREVIOUS (optional).
 * Never logs the provided or expected value.
 */

/** Constant-time string compare; length mismatch still walks the full expected length. */
export function safeSecretEqual(provided: string | null | undefined, expected: string | null | undefined): boolean {
  if (!expected || typeof provided !== "string" || provided.length === 0) return false;
  const enc = new TextEncoder();
  const a = enc.encode(provided);
  const b = enc.encode(expected);
  let diff = a.length ^ b.length;
  for (let i = 0; i < b.length; i++) diff |= (a[i % (a.length || 1)] ?? 0) ^ (b[i] ?? 0);
  return diff === 0;
}

export function readProvidedCronSecret(request: Request): string | null {
  return request.headers.get("x-cron-secret") ?? new URL(request.url).searchParams.get("secret");
}

/** True when the request carries the current or previous cron secret. */
export function verifyCronSecret(provided: string | null, current: string | undefined, previous?: string | undefined): boolean {
  const okCurrent = safeSecretEqual(provided, current);
  const okPrevious = safeSecretEqual(provided, previous);
  return okCurrent || okPrevious;
}

/** Returns a Response to send back when auth fails, or null when the caller is allowed. */
export function cronAuthFailure(request: Request, endpoint: string): Response | null {
  const current = process.env["CRON_SECRET"];
  const previous = process.env["CRON_SECRET_PREVIOUS"];
  if (!current) return new Response("Scheduler not configured", { status: 503 });
  if (!verifyCronSecret(readProvidedCronSecret(request), current, previous)) {
    console.warn(`[cron-auth] rejected call to ${endpoint}`);
    return new Response("Unauthorized", { status: 401 });
  }
  return null;
}
