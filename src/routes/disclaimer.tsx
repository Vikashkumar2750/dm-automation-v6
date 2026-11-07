import { createFileRoute } from "@tanstack/react-router";
import { publicPageSchema } from "@/lib/public-page-seo";
import { LegalPage } from "@/components/app/LegalPage";

import { DisclaimerContent } from "@/components/app/DisclaimerContent";

const title = "Disclaimer — AutoDM by Techaasvik";
const description = "Important limitations and third-party platform information for AutoDM by Techaasvik.";

export const Route = createFileRoute("/disclaimer")({
  head: () => ({ meta: [
    { title }, { name: "description", content: description }, { property: "og:title", content: title },
    { property: "og:description", content: description }, { property: "og:type", content: "article" },
    { name: "twitter:card", content: "summary" },
  ], links: [{ rel: "canonical", href: "https://autodm.techaasvik.com/disclaimer" }], scripts: publicPageSchema("/disclaimer", title, description) }), component: Disclaimer,
});

function Disclaimer() {
  return <LegalPage title="Disclaimer" updated="27 September 2026">
    <DisclaimerContent />
  </LegalPage>;
}