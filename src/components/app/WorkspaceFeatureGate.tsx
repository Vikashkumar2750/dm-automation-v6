import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowLeft, Loader2, Lock } from "lucide-react";
import { AppShell } from "@/components/app/AppShell";
import { Button } from "@/components/ui/button";
import { useWorkspaceFeatures } from "@/hooks/useWorkspaceFeatures";
import { FEATURE_OPTIONS, featureOn, type FeatureKey } from "@/lib/workspace-features";

/** Shows the page only when this workspace has the feature on (Super Admin can switch it per workspace). */
export function WorkspaceFeatureGate({ feature, children }: { feature: FeatureKey; children: ReactNode }) {
  const q = useWorkspaceFeatures();
  if (q.data && featureOn(q.data, feature)) return children;
  if (!q.data && !q.isFetched) {
    return <AppShell><div className="flex min-h-80 items-center justify-center"><Loader2 aria-label="Loading" className="size-8 animate-spin text-muted-foreground" /></div></AppShell>;
  }
  if (!q.data) return children; // could not load switches: fall back to the normal page (server still checks)
  return (
    <AppShell>
      <section className="flex min-h-80 flex-col items-center justify-center gap-4 text-center">
        <Lock className="size-10 text-primary" />
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{FEATURE_OPTIONS[feature].label}</h1>
        <p className="max-w-md text-sm text-muted-foreground">This section isn't available for this workspace right now. Contact support if you need it.</p>
        <Button variant="outline" asChild><Link to="/dashboard"><ArrowLeft className="mr-2 size-4" />Back to dashboard</Link></Button>
      </section>
    </AppShell>
  );
}
