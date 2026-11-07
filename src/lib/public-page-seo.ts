const SITE = "https://autodm.techaasvik.com";

export function publicPageSchema(path: string, name: string, description: string, type = "WebPage") {
  return [{ type: "application/ld+json", children: JSON.stringify({
    "@context": "https://schema.org", "@type": type,
    name, description, url: `${SITE}${path}`,
    isPartOf: { "@type": "WebSite", name: "AutoDM by Techaasvik", url: SITE },
  }).replace(/</g, "\\u003c") }];
}