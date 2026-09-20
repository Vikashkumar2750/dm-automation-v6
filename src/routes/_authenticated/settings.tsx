import { createFileRoute } from "@tanstack/react-router";
import { Settings } from "lucide-react";

import { PlaceholderPage } from "@/components/app/PlaceholderPage";

export const Route = createFileRoute("/_authenticated/settings")({
  head: () => ({
    meta: [
      { title: "Settings — DM FB-IG-YT by Techaasvik" },
      { name: "description", content: "Workspace preferences, branding, notifications and security." },
      { property: "og:title", content: "Settings — DM FB-IG-YT by Techaasvik" },
      { property: "og:description", content: "Workspace preferences, branding, notifications and security." },
    ],
  }),
  component: SettingsPage,
});

function SettingsPage() {
  return (
    <PlaceholderPage
      title="Settings"
      description="Workspace preferences, branding, notifications and security."
      icon={Settings}
      emptyTitle="Settings coming next"
      emptyDescription="Workspace profile, notification rules, audit log and security controls."
      phase="Phase 2"
    />
  );
}
