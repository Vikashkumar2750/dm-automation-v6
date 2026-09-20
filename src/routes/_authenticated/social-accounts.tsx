import { createFileRoute } from "@tanstack/react-router";
import { Share2 } from "lucide-react";

import { PlaceholderPage } from "@/components/app/PlaceholderPage";

export const Route = createFileRoute("/_authenticated/social-accounts")({
  head: () => ({
    meta: [
      { title: "Social Accounts — DM FB-IG-YT by Techaasvik" },
      { name: "description", content: "Connect and manage Instagram, Facebook and YouTube accounts." },
      { property: "og:title", content: "Social Accounts — DM FB-IG-YT by Techaasvik" },
      { property: "og:description", content: "Connect and manage Instagram, Facebook and YouTube accounts." },
    ],
  }),
  component: SocialAccountsPage,
});

function SocialAccountsPage() {
  return (
    <PlaceholderPage
      title="Social Accounts"
      description="Connect and manage Instagram, Facebook and YouTube accounts."
      icon={Share2}
      emptyTitle="Account Center coming next"
      emptyDescription="Real OAuth connection, token health, permission scopes and reconnect flows."
      phase="Phase 3"
    />
  );
}
