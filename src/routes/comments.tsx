import { createFileRoute } from "@tanstack/react-router";
import { MessageSquare } from "lucide-react";

import { PlaceholderPage } from "@/components/app/PlaceholderPage";

export const Route = createFileRoute("/comments")({
  head: () => ({
    meta: [
      { title: "Comments — DM FB-IG-YT by Techaasvik" },
      { name: "description", content: "Moderate, reply to and automate comments across all platforms." },
      { property: "og:title", content: "Comments — DM FB-IG-YT by Techaasvik" },
      { property: "og:description", content: "Moderate, reply to and automate comments across all platforms." },
    ],
  }),
  component: CommentsPage,
});

function CommentsPage() {
  return (
    <PlaceholderPage
      title="Comments"
      description="Moderate, reply to and automate comments across all platforms."
      icon={MessageSquare}
      emptyTitle="Comments inbox coming next"
      emptyDescription="Comment stream with filters, bulk moderation and private-reply eligibility."
      phase="Phase 7"
    />
  );
}
