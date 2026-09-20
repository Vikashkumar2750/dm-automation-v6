import { createFileRoute } from "@tanstack/react-router";
import { Workflow } from "lucide-react";

import { PlaceholderPage } from "@/components/app/PlaceholderPage";

export const Route = createFileRoute("/automations")({
  head: () => ({
    meta: [
      { title: "Automations — DM FB-IG-YT by Techaasvik" },
      { name: "description", content: "Visual workflows guarded by eligibility, rate limits and anti-loop checks." },
      { property: "og:title", content: "Automations — DM FB-IG-YT by Techaasvik" },
      { property: "og:description", content: "Visual workflows guarded by eligibility, rate limits and anti-loop checks." },
    ],
  }),
  component: AutomationsPage,
});

function AutomationsPage() {
  return (
    <PlaceholderPage
      title="Automations"
      description="Visual workflows guarded by eligibility, rate limits and anti-loop checks."
      icon={Workflow}
      emptyTitle="Automation builder coming next"
      emptyDescription="Trigger, condition and action nodes with a validation panel before publish."
      phase="Phase 8"
    />
  );
}
