import { afterEach, beforeEach, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  hooksError: false, messagesError: false, writeError: false,
  url: "https://receiver.example/events",
  updates: [] as Record<string, unknown>[], filters: [] as unknown[][],
  messages: [{ id: "message", conversation_id: "chat", direction: "inbound", body: "test", sent_at: "2026-11-08", created_at: "2026-11-08T11:00:00Z", conversations: { platform: "instagram", channel: "dm", external_user_id: "contact", external_user_name: null } }],
}));
vi.mock("@/integrations/supabase/client.server", () => ({ supabaseAdmin: {
  from(table: string) {
    let write = false;
    const q = {
      select: () => q, limit: () => q, order: () => q,
      eq: (...args: unknown[]) => { state.filters.push(args); return q; },
      gt: (...args: unknown[]) => { state.filters.push(args); return q; },
      update: (values: Record<string, unknown>) => { write = true; state.updates.push(values); return q; },
      then: (resolve: (value: unknown) => unknown) => Promise.resolve(resolve({
        data: write ? null : table === "messages" ? state.messages : [{ id: "hook", organization_id: "workspace", url: state.url, secret: "test-fixture-only", events: ["message.received"], cursor_at: "2026-11-08T10:00:00Z" }],
        error: (write ? state.writeError : table === "messages" ? state.messagesError : state.hooksError) ? { code: "TEST" } : null,
      })),
    };
    return q;
  },
} }));
import { dispatchOutgoingWebhooks } from "./team-desk.server";

beforeEach(() => { state.url = "https://receiver.example/events"; state.hooksError = false; state.messagesError = false; state.writeError = false; state.updates = []; state.filters = []; });
afterEach(() => vi.unstubAllGlobals());

it("blocks an existing private-network destination before sending contact data", async () => {
  state.url = "https://169.254.169.254/events";
  const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 204 }));
  vi.stubGlobal("fetch", fetchMock);
  await expect(dispatchOutgoingWebhooks()).resolves.toEqual({ hooks: 1, sent: 0, failed: 1 });
  expect(fetchMock).not.toHaveBeenCalled();
  expect(state.updates[0]).not.toHaveProperty("cursor_at");
});

it("rejects failed hook reads instead of reporting an empty successful dispatch", async () => {
  state.hooksError = true;
  await expect(dispatchOutgoingWebhooks()).rejects.toThrow();
});
it("rejects failed message reads without advancing the cursor", async () => {
  state.messagesError = true;
  await expect(dispatchOutgoingWebhooks()).rejects.toThrow();
  expect(state.updates).toHaveLength(0);
});
it("sends only workspace-scoped messages and refuses receiver redirects", async () => {
  const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 302 }));
  vi.stubGlobal("fetch", fetchMock);
  await expect(dispatchOutgoingWebhooks()).resolves.toEqual({ hooks: 1, sent: 0, failed: 1 });
  expect(fetchMock.mock.calls[0]?.[1]).toMatchObject({ redirect: "error" });
  expect(state.filters).toContainEqual(["conversations.organization_id", "workspace"]);
  expect(state.updates[0]).not.toHaveProperty("cursor_at");
});
it("retains failed batches for retry without exposing network error details", async () => {
  vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("private receiver diagnostic")));
  await expect(dispatchOutgoingWebhooks()).resolves.toEqual({ hooks: 1, sent: 0, failed: 1 });
  expect(state.updates[0]).toMatchObject({ last_error: "Webhook request failed." });
  expect(state.updates[0]).not.toHaveProperty("cursor_at");
});
it("advances a confirmed delivered batch only after the status write succeeds", async () => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(null, { status: 204 })));
  await expect(dispatchOutgoingWebhooks()).resolves.toEqual({ hooks: 1, sent: 1, failed: 0 });
  expect(state.updates[0]).toMatchObject({ cursor_at: "2026-11-08T11:00:00Z", last_status: 204 });
  state.writeError = true;
  await expect(dispatchOutgoingWebhooks()).rejects.toThrow();
});