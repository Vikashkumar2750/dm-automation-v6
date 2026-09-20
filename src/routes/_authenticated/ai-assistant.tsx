import { createFileRoute } from "@tanstack/react-router";
import { Sparkles } from "lucide-react";

import { PlaceholderPage } from "@/components/app/PlaceholderPage";

export const Route = createFileRoute("/_authenticated/ai-assistant")({
  head: () => ({
    meta: [
      { title: "AI Assistant — DM FB-IG-YT by Techaasvik" },
      { name: "description", content: "Draft replies, build automations and surface insights with AI." },
      { property: "og:title", content: "AI Assistant — DM FB-IG-YT by Techaasvik" },
      { property: "og:description", content: "Draft replies, build automations and surface insights with AI." },
    ],
  }),
  component: AiAssistantPage,
});

function AiAssistantPage() {
  return (
    <PlaceholderPage
      title="AI Assistant"
      description="Draft replies, build automations and surface insights with AI."
      icon={Sparkles}
      emptyTitle="AI layer coming next"
      emptyDescription="Reply drafting, intent detection and automation suggestions."
      phase="Phase 13"
    />
  );
}
