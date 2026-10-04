import { QueryClient } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";

export const getRouter = () => {
  // Network blips (e.g. "Failed to fetch" during a server restart) are retried
  // instead of surfacing as a crash.
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: (count, error) =>
          count < (error instanceof TypeError && /fetch/i.test(error.message) ? 4 : 1),
        retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 8000),
        refetchOnWindowFocus: false,
      },
    },
  });

  const router = createRouter({
    routeTree,
    context: { queryClient },
    scrollRestoration: true,
    defaultPreloadStaleTime: 0,
  });

  return router;
};
