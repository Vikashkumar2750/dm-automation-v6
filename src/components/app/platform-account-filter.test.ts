import { describe, expect, it } from "vitest";
import { matchesPlatformAccount } from "./PlatformAccountFilter";

describe("matchesPlatformAccount", () => {
  it("hides rows of another account when an account is chosen", () => {
    expect(matchesPlatformAccount({ platform: "instagram", social_account_id: "b" }, "instagram", "a")).toBe(false);
  });
  it("hides rows with no account when an account is chosen", () => {
    expect(matchesPlatformAccount({ platform: "instagram", social_account_id: null }, "instagram", "a")).toBe(false);
  });
  it("hides other platforms when a platform is chosen", () => {
    expect(matchesPlatformAccount({ platform: "facebook", social_account_id: "a" }, "instagram", "all")).toBe(false);
  });
  it("keeps the exact account", () => {
    expect(matchesPlatformAccount({ platform: "instagram", social_account_id: "a" }, "instagram", "a")).toBe(true);
  });
});
