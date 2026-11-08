import { describe, expect, it, vi } from "vitest";
import { resolveContentUrl } from "./product-files.server";

describe("private content URL boundaries", () => {
  it("does not sign a different workspace's file", async () => {
    const from = vi.fn();
    expect(await resolveContentUrl({ storage: { from } }, "file:other-workspace/guide.pdf", "workspace")).toBeNull();
    expect(from).not.toHaveBeenCalled();
  });
  it("signs the authorized workspace file for ten minutes", async () => {
    const sign = vi.fn(async () => ({ data: { signedUrl: "https://files.example/download" } }));
    const admin = { storage: { from: () => ({ createSignedUrl: sign }) } };
    expect(await resolveContentUrl(admin, "file:workspace/guide.pdf", "workspace")).toBe("https://files.example/download");
    expect(sign).toHaveBeenCalledWith("workspace/guide.pdf", 600, { download: "guide.pdf" });
  });
  it("does not return an access URL when signing fails", async () => {
    const admin = { storage: { from: () => ({ createSignedUrl: async () => ({ data: null }) }) } };
    expect(await resolveContentUrl(admin, "file:workspace/guide.pdf", "workspace")).toBeNull();
  });
});