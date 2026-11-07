import { act, create, type ReactTestRenderer } from "react-test-renderer";
import { describe, expect, it } from "vitest";
import { useSidebarGroup } from "./useSidebarGroup";

function Probe() {
  const { openGroup, toggleGroup } = useSidebarGroup();
  return <button onClick={() => toggleGroup("Engage")}>{openGroup ?? "closed"}</button>;
}

describe("sidebar navigation", () => {
  it("keeps an explicitly opened group after the sidebar remounts", async () => {
    let tree: ReactTestRenderer | undefined;
    await act(async () => { tree = create(<Probe key="inbox" />); });
    await act(async () => { tree?.root.findByType("button").props.onClick(); });
    expect(tree?.root.findByType("button").children).toEqual(["Engage"]);
    await act(async () => { tree?.update(<Probe key="contacts" />); });
    expect(tree?.root.findByType("button").children).toEqual(["Engage"]);
    await act(async () => { tree?.unmount(); });
  });
});