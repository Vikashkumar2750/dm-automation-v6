import { describe, expect, it } from "vitest";
import { dumpRequestSchema } from "./db-dump-request";

describe("database dump request", () => {
  it("accepts exactly the three available download modes", () => {
    for (const mode of ["full", "schema", "data"]) expect(dumpRequestSchema.parse({ mode })).toEqual({ mode });
  });
  it("rejects unknown modes rather than downloading a full dump", () => {
    for (const mode of ["invalid", "constructor", "toString", "__proto__"]) expect(dumpRequestSchema.safeParse({ mode }).success).toBe(false);
    expect(dumpRequestSchema.safeParse({}).success).toBe(false);
  });
});