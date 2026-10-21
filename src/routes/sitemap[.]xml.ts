import { createFileRoute } from "@tanstack/react-router";

const SITE = "https://autodm.techaasvik.com";
const PAGES: { path: string; priority: string; freq: string }[] = [
  { path: "/", priority: "1.0", freq: "weekly" },
  { path: "/blog", priority: "0.8", freq: "daily" },
  { path: "/tools/webp-converter", priority: "0.7", freq: "monthly" },
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
        let posts: { slug: string; updated_at: string }[] = [];
        try {
          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          const { data } = await supabaseAdmin.from("blog_posts").select("slug, updated_at").eq("status", "published").eq("noindex", false).limit(1000);
          posts = data ?? [];
        } catch { /* sitemap still serves static pages */ }
        const urls = PAGES.map(
          (p) =>
            `<url><loc>${SITE}${p.path}</loc><changefreq>${p.freq}</changefreq><priority>${p.priority}</priority></url>`,
        ).join("") + posts.map((p) => `<url><loc>${SITE}/blog/${p.slug}</loc><lastmod>${p.updated_at.slice(0, 10)}</lastmod><priority>0.7</priority></url>`).join("");
        return new Response(
          `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls}</urlset>`,
          { headers: { "content-type": "application/xml; charset=utf-8", "cache-control": "public, max-age=3600" } },
        );
      },
    },
  },
});
