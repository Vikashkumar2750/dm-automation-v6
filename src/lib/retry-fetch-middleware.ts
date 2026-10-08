import { createMiddleware } from "@tanstack/react-start";

// Retries server-function calls that fail at the network level ("Failed to fetch"),
// e.g. while the server briefly restarts, so pages don't blank on a transient drop.
export const retryNetworkMiddleware = createMiddleware({ type: "function" }).client(
  async ({ next }) => {
    const delays = [300, 800, 1600];
    for (let attempt = 0; ; attempt++) {
      try {
        return await next();
      } catch (error) {
        const isNetwork = error instanceof TypeError && /fetch|network|load failed/i.test(error.message);
        if (!isNetwork || attempt >= delays.length) throw error;
        await new Promise((r) => setTimeout(r, delays[attempt]));
      }
    }
  },
);
