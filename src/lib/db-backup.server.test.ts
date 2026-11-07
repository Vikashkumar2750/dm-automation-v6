import { describe, expect, it } from "vitest";
import { rejectLegacyDatabaseOperation } from "./db-backup.server";

describe("Retired privileged database operations", () => {
  it("rejects in-app full exports and arbitrary SQL instead of returning credentials or data", () => {
    expect(() => rejectLegacyDatabaseOperation()).toThrow("In-app database export, restore and arbitrary SQL are unavailable");
  });
});
