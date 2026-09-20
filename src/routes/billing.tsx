import { createFileRoute } from "@tanstack/react-router";
import { CreditCard } from "lucide-react";

import { PlaceholderPage } from "@/components/app/PlaceholderPage";

export const Route = createFileRoute("/billing")({
  head: () => ({
    meta: [
      { title: "Billing — DM FB-IG-YT by Techaasvik" },
      { name: "description", content: "Plans, invoices and payment methods for this workspace." },
      { property: "og:title", content: "Billing — DM FB-IG-YT by Techaasvik" },
      { property: "og:description", content: "Plans, invoices and payment methods for this workspace." },
    ],
  }),
  component: BillingPage,
});

function BillingPage() {
  return (
    <PlaceholderPage
      title="Billing"
      description="Plans, invoices and payment methods for this workspace."
      icon={CreditCard}
      emptyTitle="Billing coming next"
      emptyDescription="Plan selection, usage-based charges, invoices and payment methods."
      phase="Phase 15"
    />
  );
}
