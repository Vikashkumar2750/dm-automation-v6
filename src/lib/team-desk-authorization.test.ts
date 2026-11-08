import { beforeEach, expect, it, vi } from "vitest";

vi.mock("@tanstack/react-start", () => ({ createServerFn: () => {
  const builder = { middleware: () => builder, inputValidator: () => builder, handler: (fn: unknown) => fn };
  return builder;
} }));
vi.mock("@/integrations/supabase/auth-middleware", () => ({ requireSupabaseAuth: {} }));
import { assignConversation, getTeamDesk, requestApproval } from "./team-desk.functions";

let role: string | null;
let conversationExists: boolean;
let assigneeExists: boolean;
const writes = vi.fn();
const filters: unknown[][] = [];
function client() {
  return { from(table: string) {
    const conditions: Record<string, unknown> = {};
    const q = {
      select: () => q, eq: (key: string, value: unknown) => { conditions[key] = value; filters.push([table, key, value]); return q; },
      or: () => q, order: () => q, limit: () => q, maybeSingle: () => q,
      upsert: (value: unknown) => { writes(value); return q; }, insert: (value: unknown) => { writes(value); return q; },
      then: (resolve: (value: unknown) => unknown) => Promise.resolve(resolve({ error: null,
        data: table === "organization_members" ? (conditions.user_id === "assignee" ? (assigneeExists ? { role: "agent" } : null) : role ? { role } : null)
          : table === "conversations" ? (conditions.id ? (conversationExists ? { id: "chat" } : null) : []) : [],
      })),
    };
    return q;
  } };
}
const invoke = (fn: unknown, data: unknown) => (fn as (args: unknown) => Promise<unknown>)({ data, context: { supabase: client(), userId: "actor" } });
const assignment = { organizationId: "workspace", conversationId: "chat", assignedTo: "assignee" };
beforeEach(() => { role = "agent"; conversationExists = true; assigneeExists = true; writes.mockClear(); filters.length = 0; });

it("rejects a nonmember before returning Team Desk data", async () => {
  role = null;
  await expect(invoke(getTeamDesk, { organizationId: "workspace" })).rejects.toThrow();
});
it.each([null, "viewer"])("rejects assignment and draft writes for role %s", async (value) => {
  role = value;
  await expect(invoke(assignConversation, assignment)).rejects.toThrow();
  await expect(invoke(requestApproval, { ...assignment, body: "harmless draft" })).rejects.toThrow();
  expect(writes).not.toHaveBeenCalled();
});
it("rejects another workspace's conversation before either write", async () => {
  conversationExists = false;
  await expect(invoke(assignConversation, assignment)).rejects.toThrow();
  await expect(invoke(requestApproval, { ...assignment, body: "harmless draft" })).rejects.toThrow();
  expect(writes).not.toHaveBeenCalled();
});
it("rejects an assignee who is not in the active workspace", async () => {
  assigneeExists = false;
  await expect(invoke(assignConversation, assignment)).rejects.toThrow();
  expect(writes).not.toHaveBeenCalled();
});
it("allows an agent to assign a workspace conversation and submit an unsent draft", async () => {
  await expect(invoke(assignConversation, assignment)).resolves.toEqual({ ok: true });
  await expect(invoke(requestApproval, { ...assignment, body: "harmless draft" })).resolves.toEqual({ ok: true });
  expect(writes).toHaveBeenCalledTimes(2);
  expect(filters).toContainEqual(["conversations", "organization_id", "workspace"]);
  expect(filters).toContainEqual(["organization_members", "user_id", "assignee"]);
});