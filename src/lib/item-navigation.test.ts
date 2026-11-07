import { describe, expect, it } from "vitest";
import { findWorkspaceItem, itemSearch, workspaceItemId } from "./item-navigation";

const workspace = "11111111-1111-4111-8111-111111111111";
const id = "22222222-2222-4222-8222-222222222222";

describe("workspace item navigation", () => {
  it("preserves the requested conversation instead of choosing the first row", () => {
    const requested = { id, organization_id: workspace };
    expect(findWorkspaceItem([{ id: "first", organization_id: workspace }, requested], id, workspace)).toBe(requested);
  });
  it("never selects an item from another workspace", () => {
    expect(findWorkspaceItem([{ id, organization_id: "other" }], id, workspace)).toBeUndefined();
    expect(workspaceItemId(id, workspace, "other")).toBeUndefined();
  });
  it("does not fall back when the requested item was deleted", () => {
    expect(findWorkspaceItem([{ id: "first", organization_id: workspace }], id, workspace)).toBeUndefined();
  });
  it("keeps valid post links and rejects malformed identifiers", () => {
    expect(itemSearch({ post: id, workspace }, "post")).toEqual({ post: id, workspace });
    expect(itemSearch({ conversation: "invalid", workspace: 42 }, "conversation")).toEqual({ conversation: undefined, workspace: undefined });
    expect(workspaceItemId(id, workspace, workspace)).toBe(id);
  });
});