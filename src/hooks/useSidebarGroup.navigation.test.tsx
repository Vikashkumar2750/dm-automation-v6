import { act, create, type ReactTestRenderer } from "react-test-renderer";
import { describe, expect, it, vi } from "vitest";
import { SidebarGroupProvider, useSidebarGroup } from "./useSidebarGroup";

vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);

function Probe({ scope = "user" }: { scope?: "user" | "admin" }) {
  const { openGroup, toggleGroup } = useSidebarGroup(scope);
  return <button onClick={() => toggleGroup("Engage")}>{openGroup ?? "closed"}</button>;
}

describe.each(["user", "admin"] as const)("%s sidebar navigation", (scope) => {
  it("keeps an explicitly opened group after the sidebar remounts", async () => {
    let tree: ReactTestRenderer | undefined;
    await act(async () => { tree = create(<SidebarGroupProvider><Probe scope={scope} key="inbox" /></SidebarGroupProvider>); });
    await act(async () => { tree?.root.findByType("button").props["onClick"](); });
    expect(tree?.root.findByType("button").children).toEqual(["Engage"]);
    await act(async () => { tree?.update(<SidebarGroupProvider><Probe scope={scope} key="contacts" /></SidebarGroupProvider>); });
    expect(tree?.root.findByType("button").children).toEqual(["Engage"]);
    await act(async () => { tree?.root.findByType("button").props["onClick"](); });
    expect(tree?.root.findByType("button").children).toEqual(["closed"]);
    await act(async () => { tree?.unmount(); });
  });
});