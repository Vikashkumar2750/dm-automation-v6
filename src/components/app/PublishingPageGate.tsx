import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { CalendarDays, PenSquare, Clock, ArrowLeft, Loader2 } from "lucide-react";
import { getPlatformStatus } from "@/lib/platform-status.functions";
import type { PublishingFeature } from "@/lib/publishing-availability";
import { useWorkspaceFeatures } from "@/hooks/useWorkspaceFeatures";
import { AppShell } from "@/components/app/AppShell";
import { Button } from "@/components/ui/button";

export function PublishingPageGate({ feature, children }: { feature: PublishingFeature; children: ReactNode }) {
  const fetchStatus = useServerFn(getPlatformStatus);
  const status = useQuery({ queryKey: ["platform-status"], queryFn: () => fetchStatus(), staleTime: 60_000, refetchInterval: 60_000 });
  const features = useWorkspaceFeatures().data;
  const mode = features ? features[feature] : feature === "calendar" ? status.data?.calendarMode : status.data?.createPostMode;
  if (mode === "enabled") return children;
  const Icon = feature === "calendar" ? CalendarDays : PenSquare;
  return <AppShell>
    <section className="flex min-h-80 flex-col items-center justify-center gap-4 text-center">
      {!status.isFetched ? <Loader2 aria-label="Loading availability" className="size-8 animate-spin text-muted-foreground" /> : <>
        <Icon className="size-10 text-primary" />
        <h1 className="text-2xl font-semibold">{feature === "calendar" ? "Calendar" : "Create Post"}</h1>
        <p className="flex items-center gap-2 text-muted-foreground"><Clock className="size-4" />{mode === "coming_soon" ? "Coming soon" : "Currently unavailable"}</p>
        <Button variant="outline" asChild><Link to="/dashboard"><ArrowLeft className="mr-2 size-4" />Back to dashboard</Link></Button>
      </>}
    </section>
  </AppShell>;
}