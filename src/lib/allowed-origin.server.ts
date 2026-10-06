/** Returns the caller origin only if it is on the app's allowlist; otherwise the canonical app origin. */
export function trustedOrigin(raw: string | undefined | null): string {
  const canonical = (process.env["PUBLIC_APP_URL"] || "https://autodm.techaasvik.com").replace(/\/$/, "");
  let origin: string;
  try {
    origin = new URL(raw ?? "").origin;
  } catch {
    return canonical;
  }
  let host: string;
  try {
    host = new URL(origin).hostname;
  } catch {
    return canonical;
  }
  const extra = (process.env["ALLOWED_APP_ORIGINS"] ?? "").split(",").map((s) => s.trim().replace(/\/$/, "")).filter(Boolean);
  const ok =
    origin === canonical ||
    origin === "https://autodm.techaasvik.com" ||
    extra.includes(origin) ||
    (origin.startsWith("https://") && host.endsWith(".lovable.app")) ||
    origin === "http://localhost:8080";
  return ok ? origin : canonical;
}
