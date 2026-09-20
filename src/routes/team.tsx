import { createFileRoute } from "@tanstack/react-router";
import { UsersRound } from "lucide-react";

import { PlaceholderPage } from "@/components/app/PlaceholderPage";

export const Route = createFileRoute("/team")({
  head: () => ({
    meta: [
      { title: "Team — DM FB-IG-YT by Techaasvik" },
      { name: "description", content: "Invite teammates and control what each role can do." },
      { property: "og:title", content: "Team — DM FB-IG-YT by Techaasvik" },
      { property: "og:description", content: "Invite teammates and control what each role can do." },
    ],
  }),
  component: TeamPage,
});

function TeamPage() {
  return (
    <PlaceholderPage
      title="Team"
      description="Invite teammates and control what each role can do."
      icon={UsersRound}
      emptyTitle="Team management coming next"
      emptyDescription="Invitations, roles and per-workspace permissions."
      phase="Phase 2"
    />
  );
}
