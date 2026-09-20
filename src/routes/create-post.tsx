import { createFileRoute } from "@tanstack/react-router";
import { PenSquare } from "lucide-react";

import { PlaceholderPage } from "@/components/app/PlaceholderPage";

export const Route = createFileRoute("/create-post")({
  head: () => ({
    meta: [
      { title: "Create Post — DM FB-IG-YT by Techaasvik" },
      { name: "description", content: "Compose once and publish to Instagram, Facebook and YouTube." },
      { property: "og:title", content: "Create Post — DM FB-IG-YT by Techaasvik" },
      { property: "og:description", content: "Compose once and publish to Instagram, Facebook and YouTube." },
    ],
  }),
  component: CreatePostPage,
});

function CreatePostPage() {
  return (
    <PlaceholderPage
      title="Create Post"
      description="Compose once and publish to Instagram, Facebook and YouTube."
      icon={PenSquare}
      emptyTitle="Composer coming next"
      emptyDescription="The publishing composer with media upload, per-platform previews and scheduling."
      phase="Phase 11"
    />
  );
}
