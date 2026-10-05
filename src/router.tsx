import { QueryClient } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";

// After a new deploy, old page files disappear and an already-open tab fails with
// "Failed to fetch dynamically imported module". Reload once to pick up the new version.
if (typeof window !== "undefined") {
  const KEY = "chunk-reload-at";
  const reloadOnce = () => {
    const last = Number(sessionStorage.getItem(KEY) || 0);
    if (Date.now() - last < 10_000) return;
    sessionStorage.setItem(KEY, String(Date.now()));
    window.location.reload();
  };
  window.addEventListener("vite:preloadError", (e) => {
    e.preventDefault();
    reloadOnce();
  });
  window.addEventListener("unhandledrejection", (e) => {
    const msg = String((e.reason as Error | undefined)?.message ?? e.reason ?? "");
    if (/Failed to fetch dynamically imported module|Importing a module script failed|error loading dynamically imported module/i.test(msg)) {
      reloadOnce();
    }
  });
}

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
