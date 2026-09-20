import { createFileRoute } from "@tanstack/react-router";
import { ShieldCheck } from "lucide-react";

import { PlaceholderPage } from "@/components/app/PlaceholderPage";

export const Route = createFileRoute("/_authenticated/account-health")({
  head: () => ({
    meta: [
      { title: "Account Health — DM FB-IG-YT by Techaasvik" },
      { name: "description", content: "Token status, API health and risk signals for every connected account." },
      { property: "og:title", content: "Account Health — DM FB-IG-YT by Techaasvik" },
      { property: "og:description", content: "Token status, API health and risk signals for every connected account." },
    ],
  }),
  component: AccountHealthPage,
});

function AccountHealthPage() {
  return (
    <PlaceholderPage
      title="Account Health"
      description="Token status, API health and risk signals for every connected account."
      icon={ShieldCheck}
      emptyTitle="Health monitor coming next"
      emptyDescription="Per-account health score, warnings and recovery actions."
      phase="Phase 10"
    />
  );
}
