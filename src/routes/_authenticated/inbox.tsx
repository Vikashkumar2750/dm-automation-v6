import { createFileRoute } from "@tanstack/react-router";
import { Inbox } from "lucide-react";

import { PlaceholderPage } from "@/components/app/PlaceholderPage";

export const Route = createFileRoute("/_authenticated/inbox")({
  head: () => ({
    meta: [
      { title: "Unified Inbox — DM FB-IG-YT by Techaasvik" },
      { name: "description", content: "Every conversation from Instagram, Facebook and YouTube in one place." },
      { property: "og:title", content: "Unified Inbox — DM FB-IG-YT by Techaasvik" },
      { property: "og:description", content: "Every conversation from Instagram, Facebook and YouTube in one place." },
    ],
  }),
  component: InboxPage,
});

function InboxPage() {
  return (
    <PlaceholderPage
      title="Unified Inbox"
      description="Every conversation from Instagram, Facebook and YouTube in one place."
      icon={Inbox}
      emptyTitle="Inbox coming next"
      emptyDescription="Conversation list, message thread, contact panel and human handoff."
      phase="Phase 7"
    />
  );
}
