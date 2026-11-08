import { afterEach, beforeEach, expect, it, vi } from "vitest";

const transport = vi.hoisted(() => ({ status: 204, calls: [] as Array<Record<string, unknown>>, bodies: [] as string[] }));
vi.mock("node:https", () => ({ request: (options: Record<string, unknown>, callback: (res: unknown) => void) => {
  transport.calls.push(options);
  return { on: () => undefined, end: (body: string) => {
    transport.bodies.push(body);
    callback({ statusCode: transport.status, destroy: () => undefined });
  } };
} }));
import { isPublicWebhookAddress, postWebhook, resolveWebhookAddress, webhookDestination } from "./webhook-destination.server";

beforeEach(() => { transport.calls = []; transport.bodies = []; transport.status = 204; });
afterEach(() => vi.unstubAllGlobals());

it.each(["127.0.0.1", "10.0.0.1", "172.16.0.1", "192.168.0.1", "169.254.169.254", "100.64.0.1", "0.0.0.0", "224.0.0.1", "240.0.0.1", "192.0.2.1", "198.18.0.1", "::1", "fe80::1", "fc00::1", "::ffff:127.0.0.1", "2001:db8::1"])("rejects non-global address %s", (address) => {
  expect(isPublicWebhookAddress(address)).toBe(false);
});
it.each(["https://2130706433/", "https://0x7f000001/", "https://127.1/", "https://[::ffff:7f00:1]/", "https://user:pass@public.com/", "https://public.com:8443/", "http://public.com/", "https://localhost/", "https://service.internal/", "https://public.com/#fragment"])("rejects unsafe URL %s", (url) => {
  expect(() => webhookDestination(url)).toThrow();
});
it("accepts public IPv4 and IPv6 addresses", () => {
  expect(isPublicWebhookAddress("1.1.1.1")).toBe(true);
  expect(isPublicWebhookAddress("2606:4700:4700::1111")).toBe(true);
});
it("rejects mixed public and private DNS answers before any connection", async () => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ Status: 0, Answer: [{ type: 1, data: "1.1.1.1" }, { type: 1, data: "10.0.0.1" }] }))));
  await expect(postWebhook("https://receiver.autodm.dev/events", "private-payload")).rejects.toThrow();
  expect(transport.calls).toHaveLength(0);
});
it("fails closed on unavailable DNS", async () => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(null, { status: 503 })));
  await expect(resolveWebhookAddress("receiver.autodm.dev", AbortSignal.timeout(1000))).rejects.toThrow();
  expect(transport.calls).toHaveLength(0);
});
it("pins the connection to public IP while preserving TLS identity and host", async () => {
  const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ Status: 0, Answer: [{ type: 1, data: "1.1.1.1" }] })));
  vi.stubGlobal("fetch", fetchMock);
  await expect(postWebhook("https://receiver.autodm.dev/events?q=1", "payload", { "x-autodm-signature": "fixture" })).resolves.toBe(204);
  expect(transport.calls[0]).toMatchObject({ hostname: "1.1.1.1", servername: "receiver.autodm.dev", path: "/events?q=1", agent: false, rejectUnauthorized: true, headers: { host: "receiver.autodm.dev", "x-autodm-signature": "fixture" } });
  expect(fetchMock).toHaveBeenCalledTimes(2);
  expect(transport.bodies).toEqual(["payload"]);
});
it("resolves again on delivery and blocks a hostname that changed to private", async () => {
  const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ Status: 0, Answer: [{ type: 1, data: "1.1.1.1" }] })));
  vi.stubGlobal("fetch", fetchMock);
  await postWebhook("https://receiver.autodm.dev/", "first");
  fetchMock.mockImplementation(async () => new Response(JSON.stringify({ Status: 0, Answer: [{ type: 1, data: "127.0.0.1" }] })));
  await expect(postWebhook("https://receiver.autodm.dev/", "second")).rejects.toThrow();
  expect(transport.bodies).toEqual(["first"]);
});
it("returns redirects without following them", async () => {
  transport.status = 302;
  await expect(postWebhook("https://1.1.1.1/", "payload")).resolves.toBe(302);
  expect(transport.calls).toHaveLength(1);
});