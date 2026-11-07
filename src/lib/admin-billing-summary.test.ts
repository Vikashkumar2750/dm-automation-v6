import { expect, it } from "vitest";
import { summarizePlanOrders } from "./admin-billing-summary";
it("counts confirmed cash separately from grants and unpaid orders", () => {
  expect(summarizePlanOrders([
    { amount_paise: 5900, status: "paid", mode: "live" },
    { amount_paise: 0, status: "paid", mode: "grant" },
    { amount_paise: 59900, status: "created", mode: "live" },
    { amount_paise: 5900, status: "failed", mode: "live" },
  ])).toEqual({ cashPaise: 5900, payments: 1, grants: 1 });
});