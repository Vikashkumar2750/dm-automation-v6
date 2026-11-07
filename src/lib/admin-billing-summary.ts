export function summarizePlanOrders(orders: { amount_paise: number; status: string; mode: string }[]) {
  const payments = orders.filter((order) => order.status === "paid" && order.mode !== "grant" && order.amount_paise > 0);
  return { cashPaise: payments.reduce((sum, order) => sum + order.amount_paise, 0), payments: payments.length, grants: orders.filter((order) => order.mode === "grant").length };
}