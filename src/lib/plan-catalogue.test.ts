import { describe, it, expect } from "vitest";
import { findConfiguredOption } from "./platform-config.server";
import { PLANS } from "./plans";
import { planPrice } from "./plan-presentation";

function client(plans: typeof PLANS) {
  return {
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => ({
            data: { feature_flags: { __config: { plans } } },
            error: null,
          }),
        }),
      }),
    }),
  } as never;
}
describe("Saved plan pricing", () => {
  it("uses the saved amount on public price and configured checkout", async () => {
    const plans = structuredClone(PLANS);
    const pro = plans.find((p) => p.key === "pro");
    if (!pro || !pro.options[0]) throw new Error("Missing fixture");
    pro.options[0].amountPaise = 123400;
    expect(planPrice(pro)).toBe("₹1,234 / month");
    expect((await findConfiguredOption(client(plans), "pro", "monthly"))?.amountPaise).toBe(123400);
  });
  it("cannot buy a plan switched to contact-only", async () => {
    const plans = structuredClone(PLANS);
    const pro = plans.find((p) => p.key === "pro");
    if (!pro) throw new Error("Missing fixture");
    pro.contactOnly = true;
    expect(await findConfiguredOption(client(plans), "pro", "monthly")).toBeNull();
  });
  it("rejects removed checkout options rather than offering a default price", async () => {
    const plans = structuredClone(PLANS);
    const pro = plans.find((p) => p.key === "pro");
    if (!pro) throw new Error("Missing fixture");
    pro.options = [];
    expect(await findConfiguredOption(client(plans), "pro", "monthly")).toBeNull();
  });
  it("shares the configured access duration with checkout", async () => {
    const plans = structuredClone(PLANS);
    const pro = plans.find((p) => p.key === "pro");
    if (!pro?.options[0]) throw new Error("Missing fixture");
    pro.options[0].months = 2;
    expect(planPrice(pro)).toBe("₹59 / 2 months");
    expect((await findConfiguredOption(client(plans), "pro", "monthly"))?.months).toBe(2);
  });
  it("does not offer fallback checkout when the saved catalogue read fails", async () => {
    const failing = {
      from: () => ({
        select: () => ({
          eq: () => ({ maybeSingle: async () => ({ data: null, error: { code: "unavailable" } }) }),
        }),
      }),
    } as never;
    await expect(findConfiguredOption(failing, "pro", "monthly")).rejects.toThrow(
      "Plan catalogue unavailable",
    );
  });
});
