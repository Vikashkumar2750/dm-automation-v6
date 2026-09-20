import { createFileRoute } from "@tanstack/react-router";
import { Shield } from "lucide-react";

import { PlaceholderPage } from "@/components/app/PlaceholderPage";

export const Route = createFileRoute("/admin")({
  head: () => ({
    meta: [
      { title: "Platform Overview — DM FB-IG-YT by Techaasvik" },
      { name: "description", content: "Monitor, manage and scale your social automation platform." },
      { property: "og:title", content: "Platform Overview — DM FB-IG-YT by Techaasvik" },
      { property: "og:description", content: "Monitor, manage and scale your social automation platform." },
    ],
  }),
  component: AdminPage,
});

function AdminPage() {
  return (
    <PlaceholderPage
      title="Platform Overview"
      description="Monitor, manage and scale your social automation platform."
      icon={Shield}
      emptyTitle="Super Admin console coming next"
      emptyDescription="Organizations, users, plans, API health, webhook events and job queues."
      phase="Phase 15"
    />
  );
}
