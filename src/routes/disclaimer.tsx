import { createFileRoute } from "@tanstack/react-router";
import { LegalPage, SUPPORT_EMAIL } from "@/components/app/LegalPage";

const title = "Disclaimer — AutoDM by Techaasvik";
const description = "Important limitations and third-party platform information for AutoDM by Techaasvik.";

export const Route = createFileRoute("/disclaimer")({
  head: () => ({ meta: [
    { title }, { name: "description", content: description }, { property: "og:title", content: title },
    { property: "og:description", content: description }, { property: "og:type", content: "article" },
    { name: "twitter:card", content: "summary" },
  ], links: [{ rel: "canonical", href: "https://autodm.techaasvik.com/disclaimer" }] }), component: Disclaimer,
});

function Disclaimer() {
  return <LegalPage title="Disclaimer" updated="27 September 2026">
    <p>AutoDM by Techaasvik is an independent software service. It is not owned, operated, endorsed, or guaranteed by Meta Platforms, Inc. or Google LLC.</p>
    <h2>Third-party platforms</h2>
    <p>Instagram, Facebook, YouTube, payment services, and other connected services control their own APIs, permissions, availability, policies, and account decisions. Their changes or outages may limit features temporarily or permanently.</p>
    <h2>Automation results</h2>
    <p>Automation can improve response speed, but it does not guarantee followers, leads, sales, reach, delivery, or uninterrupted operation. You remain responsible for reviewing your rules, messages, permissions, audience consent, and compliance with applicable platform policies and laws.</p>
    <h2>Account safety</h2>
    <p>Our safety controls reduce risk but cannot guarantee that a third-party platform will never restrict an account. Do not use the Service for spam, unsolicited bulk messaging, deceptive content, or prohibited products.</p>
    <h2>Information</h2>
    <p>Information in the Service and on this website is general product information, not legal, financial, or professional advice.</p>
    <h2>Contact</h2><p>Questions may be sent to {SUPPORT_EMAIL}.</p>
  </LegalPage>;
}