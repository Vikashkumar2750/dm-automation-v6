import { createFileRoute } from "@tanstack/react-router";
import { Gauge } from "lucide-react";

import { PlaceholderPage } from "@/components/app/PlaceholderPage";

export const Route = createFileRoute("/_authenticated/usage")({
  head: () => ({
    meta: [
      { title: "Usage & Limits — DM FB-IG-YT by Techaasvik" },
      { name: "description", content: "Track plan quotas, API consumption and rate-limit headroom." },
      { property: "og:title", content: "Usage & Limits — DM FB-IG-YT by Techaasvik" },
      { property: "og:description", content: "Track plan quotas, API consumption and rate-limit headroom." },
    ],
  }),
  component: UsagePage,
});

function UsagePage() {
  return (
    <PlaceholderPage
      title="Usage & Limits"
      description="Track plan quotas, API consumption and rate-limit headroom."
      icon={Gauge}
      emptyTitle="Quota center coming next"
      emptyDescription="Live quota meters, burst protection and viral-mode controls."
      phase="Phase 10"
    />
  );
}
