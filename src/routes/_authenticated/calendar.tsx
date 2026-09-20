import { createFileRoute } from "@tanstack/react-router";
import { CalendarDays } from "lucide-react";

import { PlaceholderPage } from "@/components/app/PlaceholderPage";

export const Route = createFileRoute("/_authenticated/calendar")({
  head: () => ({
    meta: [
      { title: "Content Calendar — DM FB-IG-YT by Techaasvik" },
      { name: "description", content: "Plan and schedule your content across every connected platform." },
      { property: "og:title", content: "Content Calendar — DM FB-IG-YT by Techaasvik" },
      { property: "og:description", content: "Plan and schedule your content across every connected platform." },
    ],
  }),
  component: CalendarPage,
});

function CalendarPage() {
  return (
    <PlaceholderPage
      title="Content Calendar"
      description="Plan and schedule your content across every connected platform."
      icon={CalendarDays}
      emptyTitle="Calendar coming next"
      emptyDescription="A month and week calendar with drag-to-reschedule and queue health."
      phase="Phase 11"
    />
  );
}
