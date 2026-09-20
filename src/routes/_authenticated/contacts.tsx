import { createFileRoute } from "@tanstack/react-router";
import { Users } from "lucide-react";

import { PlaceholderPage } from "@/components/app/PlaceholderPage";

export const Route = createFileRoute("/_authenticated/contacts")({
  head: () => ({
    meta: [
      { title: "Contacts — DM FB-IG-YT by Techaasvik" },
      { name: "description", content: "Everyone who engaged with your accounts, unified across platforms." },
      { property: "og:title", content: "Contacts — DM FB-IG-YT by Techaasvik" },
      { property: "og:description", content: "Everyone who engaged with your accounts, unified across platforms." },
    ],
  }),
  component: ContactsPage,
});

function ContactsPage() {
  return (
    <PlaceholderPage
      title="Contacts"
      description="Everyone who engaged with your accounts, unified across platforms."
      icon={Users}
      emptyTitle="Contacts coming next"
      emptyDescription="Unified contact profiles, tags, lead scoring and conversation history."
      phase="Phase 7"
    />
  );
}
