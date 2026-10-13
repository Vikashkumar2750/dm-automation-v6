import { describe, expect, it } from "vitest";
import { combinedRule, fitTarget, paddedCanvas, ratioFits, ratioRule } from "./aspect-ratio";

describe("aspect ratio rules", () => {
  it("instagram feed rejects 9:16 and accepts 4:5", () => {
    const r = ratioRule("instagram", "feed");
    expect(ratioFits(9 / 16, r)).toBe(false);
    expect(ratioFits(0.8, r)).toBe(true);
    expect(ratioFits(2.5, r)).toBe(false);
  });
  it("story wants 9:16", () => {
    expect(ratioFits(1, ratioRule("instagram", "story"))).toBe(false);
    expect(ratioFits(9 / 16, ratioRule("facebook", "story"))).toBe(true);
  });
  it("instagram + facebook uses the stricter instagram range", () => {
    const r = combinedRule(["facebook", "instagram"], "feed")!;
    expect(r.min).toBe(0.8);
    expect(r.max).toBe(1.91);
  });
  it("fitting a tall photo pads the width and keeps the full height (no stretch)", () => {
    const r = ratioRule("instagram", "feed")!;
    const target = fitTarget(1080 / 1920, r);
    expect(target).toBe(0.8);
    expect(paddedCanvas(1080, 1920, target)).toEqual({ width: 1536, height: 1920 });
  });
  it("fitting a wide photo pads the height", () => {
    expect(paddedCanvas(3000, 1000, 1.91)).toEqual({ width: 3000, height: 1571 });
  });
});
