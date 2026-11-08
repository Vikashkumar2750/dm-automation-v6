import { afterEach, expect, it, vi } from "vitest";
const state = vi.hoisted(() => ({ url: "https://169.254.169.254/events", error: false }));
import { syncContactToWebhook } from "./nudges.server";
afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });
const payload = { platform: "instagram", external_user_id: "test-contact", email: null, phone: null };
function admin() {
  const query = { select: () => query, eq: () => query, maybeSingle: async () => ({ data: { webhook_url: state.url }, error: state.error ? { message: "private diagnostic" } : null }) };
  return { from: () => query } as unknown as Parameters<typeof syncContactToWebhook>[0];
}
it("never sends CRM contact data to a stored private URL", async () => {
  state.error = false;
  const fetchMock = vi.fn(); vi.stubGlobal("fetch", fetchMock);
  const log = vi.spyOn(console, "error").mockImplementation(() => undefined);
  await syncContactToWebhook(admin(), "workspace", payload);
  expect(fetchMock).not.toHaveBeenCalled();
  expect(log).toHaveBeenCalledWith("CRM webhook sync failed.");
});
it("never hides unavailable settings behind raw network diagnostics", async () => {
  state.error = true;
  const fetchMock = vi.fn(); vi.stubGlobal("fetch", fetchMock);
  const log = vi.spyOn(console, "error").mockImplementation(() => undefined);
  await syncContactToWebhook(admin(), "workspace", payload);
  expect(fetchMock).not.toHaveBeenCalled();
  expect(log).toHaveBeenCalledWith("CRM webhook sync failed.");
});