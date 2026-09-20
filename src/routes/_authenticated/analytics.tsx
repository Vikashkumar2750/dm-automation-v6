import { createFileRoute } from "@tanstack/react-router";
import { BarChart3 } from "lucide-react";

import { PlaceholderPage } from "@/components/app/PlaceholderPage";

export const Route = createFileRoute("/_authenticated/analytics")({
  head: () => ({
    meta: [
      { title: "Analytics — DM FB-IG-YT by Techaasvik" },
      { name: "description", content: "Engagement, automation performance and ROI across your accounts." },
      { property: "og:title", content: "Analytics — DM FB-IG-YT by Techaasvik" },
      { property: "og:description", content: "Engagement, automation performance and ROI across your accounts." },
    ],
  }),
  component: AnalyticsPage,
});

function AnalyticsPage() {
  return (
    <PlaceholderPage
      title="Analytics"
      description="Engagement, automation performance and ROI across your accounts."
      icon={BarChart3}
      emptyTitle="Analytics coming next"
      emptyDescription="Cross-platform reporting with attribution from conversation to lead."
      phase="Phase 14"
    />
  );
}
