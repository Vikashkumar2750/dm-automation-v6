import { describe, expect, it } from "vitest";
import { contactLabel, fillSiblingNames } from "./contact-name";

describe("contact names", () => {
  it("shows the handle with @ instead of the id", () => {
    expect(contactLabel({ platform: "instagram", external_user_id: "1784001", external_user_name: "riya.k" })).toBe("@riya.k");
  });
  it("falls back to a readable label, never the full id", () => {
    expect(contactLabel({ platform: "instagram", external_user_id: "17840012345678", external_user_name: null })).toBe("Instagram user · 345678");
  });
  it("DM thread borrows the handle from the same person's comment", () => {
    const out = fillSiblingNames([
      { platform: "instagram", external_user_id: "u1", external_user_name: null, channel: "dm" },
      { platform: "instagram", external_user_id: "u1", external_user_name: "riya.k", channel: "comment" },
    ]);
    expect(out[0]!.external_user_name).toBe("riya.k");
  });
});
