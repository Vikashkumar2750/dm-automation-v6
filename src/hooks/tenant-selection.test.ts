import { describe, expect, it, vi } from "vitest";
import { createTenantSelection } from "./tenant-selection";

describe("shared workspace selection", () => {
  it("updates every subscriber immediately when the selected workspace changes", () => {
    const store = createTenantSelection();
    const shell = vi.fn();
    const page = vi.fn();
    store.subscribe(shell);
    store.subscribe(page);
    store.set("owner", "ARTH");
    expect(store.get("owner")).toBe("ARTH");
    expect(shell).toHaveBeenCalledTimes(1);
    expect(page).toHaveBeenCalledTimes(1);
  });
  it("keeps selections separate between authenticated users", () => {
    const store = createTenantSelection();
    store.set("owner", "ARTH");
    expect(store.get("other")).toBeNull();
    store.set("other", "another-workspace");
    expect(store.get("owner")).toBe("ARTH");
  });
});