import { createFileRoute, Link } from "@tanstack/react-router";
import { publicPageSchema } from "@/lib/public-page-seo";

import { PublicFooter } from "@/components/app/PublicFooter";
import { PublicHeader } from "@/components/app/PublicHeader";
import { listPublishedPosts } from "@/lib/blog.functions";

export const Route = createFileRoute("/blog/")({
  loader: () => listPublishedPosts(),
  head: () => ({
    meta: [
      { title: "Blog — Instagram & Facebook DM Automation Guides | AutoDM" },
      { name: "description", content: "Guides on Instagram comment-to-DM automation, Facebook Messenger replies, YouTube comment management and growing sales from social media." },
      { property: "og:title", content: "AutoDM Blog — Social DM Automation Guides" },
      { property: "og:description", content: "Practical guides to automate Instagram, Facebook and YouTube engagement and turn comments into leads." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [{ rel: "canonical", href: "https://autodm.techaasvik.com/blog" }],
    scripts: publicPageSchema("/blog", "AutoDM Blog", "Social media automation guides from AutoDM by Techaasvik.", "CollectionPage"),
  }),
  component: BlogIndex,
});

function BlogIndex() {
  const posts = Route.useLoaderData();
  return (
    <div className="min-h-screen bg-background">
      <PublicHeader />
      <main className="mx-auto max-w-6xl px-6 py-14">
        <h1 className="text-4xl font-bold tracking-tight">AutoDM Blog</h1>
        <p className="mt-3 max-w-2xl text-muted-foreground">
          Guides to automate Instagram, Facebook and YouTube conversations and turn comments into customers.
        </p>
        {posts.length === 0 ? (
          <p className="mt-12 text-muted-foreground">New articles are coming soon.</p>
        ) : (
          <div className="mt-10 grid gap-6 sm:grid-cols-2">
            {posts.map((p) => (
              <Link key={p.slug} to="/blog/$slug" params={{ slug: p.slug }} className="group overflow-hidden rounded-xl border bg-card transition-shadow hover:shadow-md">
                {p.cover_url && <img src={p.cover_url} alt={p.cover_alt ?? p.title} loading="lazy" className="aspect-video w-full object-cover" />}
                <div className="p-5">
                  <p className="text-xs text-muted-foreground">
                    {p.published_at ? new Date(p.published_at).toLocaleDateString("en-IN", { dateStyle: "medium" }) : ""}
                  </p>
                  <h2 className="mt-2 text-lg font-semibold group-hover:text-primary">{p.title}</h2>
                  <p className="mt-2 line-clamp-3 text-sm text-muted-foreground">{p.excerpt}</p>
                </div>
              </Link>
            ))}
          </div>
        )}
      </main>
      <PublicFooter />
    </div>
  );
}
