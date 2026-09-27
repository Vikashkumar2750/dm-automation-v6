import { createFileRoute } from "@tanstack/react-router";
import { LegalPage, SUPPORT_EMAIL } from "@/components/app/LegalPage";

const title = "Refund & Cancellation Policy — AutoDM by Techaasvik";
const description = "Refund, cancellation, trial, and billing terms for AutoDM by Techaasvik subscriptions.";

export const Route = createFileRoute("/refund-policy")({
  head: () => ({ meta: [
    { title }, { name: "description", content: description }, { property: "og:title", content: title },
    { property: "og:description", content: description }, { property: "og:type", content: "article" },
    { name: "twitter:card", content: "summary" },
  ] }), component: RefundPolicy,
});

function RefundPolicy() {
  return <LegalPage title="Refund & Cancellation Policy" updated="27 September 2026">
    <p>This policy applies to purchases made directly for AutoDM by Techaasvik. It should be read with our Terms of Service.</p>
    <h2>Trial and one-time access</h2>
    <p>The ₹9 three-day trial provides immediate access for the stated period. Because access begins immediately, the trial charge is normally non-refundable once activated, except where required by law or where a duplicate charge occurred.</p>
    <h2>Subscriptions and cancellation</h2>
    <p>You may cancel a recurring plan before its next renewal. Cancellation stops future renewals; access continues until the end of the paid period. Cancelling does not automatically refund the current period.</p>
    <h2>When a refund may be approved</h2>
    <ul><li>A verified duplicate or incorrect charge.</li><li>A payment was completed but paid access was not provided and support could not restore it.</li><li>A refund is required under applicable Indian consumer law.</li></ul>
    <h2>When refunds are normally unavailable</h2>
    <ul><li>Unused time after cancellation or a change of mind.</li><li>Restrictions imposed by Meta, Google, or another connected platform.</li><li>Results such as followers, reach, leads, or sales not meeting expectations.</li><li>Suspension caused by prohibited use or a breach of our terms.</li></ul>
    <h2>Request process</h2>
    <p>Contact {SUPPORT_EMAIL} within seven days of the charge with the account email, payment reference, charge date, and reason. Do not send card details. Approved refunds are returned to the original payment method; bank processing times may vary.</p>
  </LegalPage>;
}