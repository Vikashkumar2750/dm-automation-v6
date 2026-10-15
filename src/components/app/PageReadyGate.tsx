import { useIsFetching } from "@tanstack/react-query";
import { useRouterState } from "@tanstack/react-router";
import { useEffect, useState, type ReactNode } from "react";

/**
 * Keeps a freshly opened page hidden until its first data has arrived, so users never
 * see placeholder values (wrong plan highlighted, zero counts, default names) that
 * switch to the real values a moment later. Pages stay mounted underneath so their
 * queries run; once a page has been revealed, later refetches never hide it again.
 */
const SETTLE_MS = 40; // lets dependent queries start before we decide the page is ready
const SKELETON_AFTER_MS = 180; // fast (cached) pages never show a skeleton at all
const MAX_WAIT_MS = 1200; // slow requests show their own loading state instead of hiding the page

// Pages already shown in this tab have their data cached, so going back to them
// opens instantly instead of waiting again.
const shownPaths = new Set<string>();

export function PageReadyGate({ ready = true, children }: { ready?: boolean; children: ReactNode }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  // Only first loads count: queries that already have data refresh silently.
  const pendingFirstLoads = useIsFetching({ predicate: (q) => q.state.data === undefined && !q.meta?.["background"] });
  const [revealedPath, setRevealedPath] = useState<string | null>(() =>
    ready && shownPaths.has(pathname) ? pathname : null,
  );
  const [skeletonPath, setSkeletonPath] = useState<string | null>(null);

  // After the first page of this tab is shown, moving to another section opens it
  // straight away; each page then shows its own loading state for slow data.
  const revealed =
    revealedPath === pathname || (ready && (shownPaths.has(pathname) || shownPaths.size > 0));
  const settled = ready && pendingFirstLoads === 0;


  useEffect(() => {
    if (revealed) {
      shownPaths.add(pathname);
      return;
    }
    if (!settled) return;
    const t = setTimeout(() => setRevealedPath(pathname), SETTLE_MS);
    return () => clearTimeout(t);
  }, [revealed, settled, pathname]);

  useEffect(() => {
    if (revealed) return;
    const skel = setTimeout(() => setSkeletonPath(pathname), SKELETON_AFTER_MS);
    const max = setTimeout(() => setRevealedPath(pathname), MAX_WAIT_MS);
    return () => {
      clearTimeout(skel);
      clearTimeout(max);
    };
  }, [revealed, pathname]);

  return (
    <>
      {!revealed && skeletonPath === pathname && <PageSkeleton />}
      <div
        aria-busy={!revealed}
        className={revealed ? undefined : "pointer-events-none invisible fixed inset-x-0 top-0 h-0 overflow-hidden"}
      >
        {children}
      </div>
    </>
  );
}

export function PageSkeleton() {
  return (
    <div className="animate-pulse space-y-6" role="status" aria-label="Loading">
      <div className="space-y-2">
        <div className="h-7 w-56 rounded-md bg-surface-secondary" />
        <div className="h-4 w-80 max-w-full rounded-md bg-surface-secondary" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-24 rounded-xl border bg-surface" />
        ))}
      </div>
      <div className="h-72 rounded-xl border bg-surface" />
    </div>
  );
}
