import { createFileRoute } from "@tanstack/react-router";

const SITE = "https://autodm.techaasvik.com";
const PAGES: { path: string; priority: string; freq: string }[] = [
  { path: "/", priority: "1.0", freq: "weekly" },
  { path: "/contact", priority: "0.6", freq: "monthly" },
  { path: "/privacy", priority: "0.3", freq: "yearly" },
  { path: "/terms", priority: "0.3", freq: "yearly" },
  { path: "/refund-policy", priority: "0.3", freq: "yearly" },
  { path: "/disclaimer", priority: "0.3", freq: "yearly" },
  { path: "/data-deletion", priority: "0.3", freq: "yearly" },
];

export const Route = createFileRoute("/sitemap.xml")({
  server: {
    handlers: {
      GET: async () => {
        const urls = PAGES.map(
          (p) =>
            `<url><loc>${SITE}${p.path}</loc><changefreq>${p.freq}</changefreq><priority>${p.priority}</priority></url>`,
        ).join("");
        return new Response(
          `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls}</urlset>`,
          { headers: { "content-type": "application/xml; charset=utf-8", "cache-control": "public, max-age=3600" } },
        );
      },
    },
  },
});
