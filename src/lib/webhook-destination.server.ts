import ipaddr from "ipaddr.js";
import { request } from "node:https";

const destinationError = () => new Error("Webhook address must be a public HTTPS website on port 443.");

export function isPublicWebhookAddress(address: string): boolean {
  try {
    // Mapped IPv6 and transition ranges are deliberately not accepted.
    return ipaddr.parse(address).range() === "unicast";
  } catch { return false; }
}

export function webhookDestination(raw: string): URL {
  let url: URL;
  try { url = new URL(raw); } catch { throw destinationError(); }
  const host = url.hostname.replace(/^\[|\]$/g, "").toLowerCase();
  if (url.protocol !== "https:" || url.username || url.password || (url.port && url.port !== "443") || url.hash)
    throw destinationError();
  if (ipaddr.isValid(host)) {
    if (!isPublicWebhookAddress(host)) throw destinationError();
  } else if (!host.includes(".") || host.endsWith(".") ||
    /(^|\.)(localhost|local|internal|localhost\.localdomain|test|invalid|example|onion)$/.test(host) ||
    host === "metadata.google.internal") throw destinationError();
  return url;
}

/** Resolve through a fixed HTTPS resolver; reject mixed public/private answers. */
export async function resolveWebhookAddress(host: string, signal: AbortSignal): Promise<string> {
  if (ipaddr.isValid(host)) {
    if (!isPublicWebhookAddress(host)) throw destinationError();
    return host;
  }
  const answers = await Promise.all(["A", "AAAA"].map(async (type) => {
    const dns = new URL("https://cloudflare-dns.com/dns-query");
    dns.searchParams.set("name", host);
    dns.searchParams.set("type", type);
    const res = await fetch(dns, { headers: { accept: "application/dns-json" }, redirect: "error", signal });
    if (!res.ok) throw new Error("Webhook destination could not be resolved.");
    const body = await res.json() as { Status?: number; Answer?: Array<{ type: number; data: string }> };
    if (body.Status !== 0) throw new Error("Webhook destination could not be resolved.");
    return (body.Answer ?? []).filter((entry) => entry.type === 1 || entry.type === 28).map((entry) => entry.data);
  }));
  const addresses = answers.flat();
  const address = addresses[0];
  if (!address || addresses.some((value) => !isPublicWebhookAddress(value))) throw destinationError();
  return address;
}

/** Connect to the approved IP itself, retaining original TLS identity and Host.
 * No second hostname lookup, redirect, proxy or connection pool is allowed.
 * Unsupported transports fail closed; never fall back to unpinned fetch.
 */
export async function postWebhook(raw: string, body: string, headers: Record<string, string> = {}, timeoutMs = 10000): Promise<number> {
  const url = webhookDestination(raw);
  const host = url.hostname.replace(/^\[|\]$/g, "");
  const signal = AbortSignal.timeout(timeoutMs);
  const address = await resolveWebhookAddress(host, signal);
  return new Promise<number>((resolve, reject) => {
    const req = request({
      protocol: "https:", hostname: address, port: 443,
      servername: ipaddr.isValid(host) ? undefined : host,
      path: url.pathname + url.search, method: "POST", agent: false,
      rejectUnauthorized: true, signal,
      headers: { ...headers, "content-type": "application/json", host: url.host },
    }, (res) => {
      const status = res.statusCode;
      res.destroy(); // Receiver response bodies are not needed or retained.
      if (typeof status !== "number") reject(new Error("Webhook request failed."));
      else resolve(status);
    });
    req.on("error", () => reject(new Error("Webhook request failed.")));
    req.end(body);
  });
}