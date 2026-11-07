import { act, create, type ReactTestRenderer } from "react-test-renderer";
import { describe, expect, it } from "vitest";
import { WorkspaceAccountFilterProvider, useWorkspaceAccountFilter } from "./useWorkspaceAccountFilter";

globalThis.IS_REACT_ACT_ENVIRONMENT = true;
let current: ReturnType<typeof useWorkspaceAccountFilter>;
function Consumer({ org }: { org: string }) { current = useWorkspaceAccountFilter(org); return null; }
function Tree({ org, session = "user" }: { org: string; session?: string }) {
  return <WorkspaceAccountFilterProvider key={session}><Consumer key={org} org={org} /></WorkspaceAccountFilterProvider>;
}
describe("workspace account selection", () => {
  it("survives page remounts, isolates workspaces and resets for another user", async () => {
    let renderer: ReactTestRenderer | undefined;
    await act(async () => { renderer = create(<Tree org="a" />); });
    await act(async () => { current.setPlatform("instagram"); current.setAccountId("account-a"); });
    await act(async () => { renderer?.update(<Tree org="b" />); });
    expect(current.accountId).toBe("all");
    expect(current.platform).toBe("all");
    await act(async () => { current.setAccountId("account-b"); });
    await act(async () => { renderer?.update(<Tree org="a" />); });
    expect(current.accountId).toBe("account-a");
    expect(current.platform).toBe("instagram");
    await act(async () => { current.setPlatform("facebook"); });
    expect(current.accountId).toBe("all");
    await act(async () => { renderer?.update(<Tree org="a" session="other-user" />); });
    expect(current.accountId).toBe("all");
    expect(current.platform).toBe("all");
    await act(async () => { renderer?.unmount(); });
  });
});