import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { marked } from "marked";

import { PublicFooter } from "@/components/app/PublicFooter";
import { PublicHeader } from "@/components/app/PublicHeader";
import { getPublishedPost } from "@/lib/blog.functions";

const SITE = "https://autodm.techaasvik.com";

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

export const Route = createFileRoute("/blog/$slug")({
  loader: async ({ params }) => {
    const post = await getPublishedPost({ data: { slug: params.slug } });
    if (!post) throw notFound();
    // Raw HTML in Markdown is escaped; only super admins author posts, but stay safe.
    const html = await marked.parse(post.content.replace(/<[^>]*>/g, (m) => escapeHtml(m)));
    return { post, html };
  },
  head: ({ loaderData }) => {
    const p = loaderData?.post;
    if (!p) return { meta: [{ title: "Article not found — AutoDM" }, { name: "description", content: "This AutoDM article is unavailable." }, { property: "og:title", content: "Article not found — AutoDM" }, { property: "og:description", content: "This AutoDM article is unavailable." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }, { name: "robots", content: "noindex" }] };
    const title = p.seo_title || p.title;
    const desc = p.meta_description || p.excerpt;
    const url = p.canonical_url || `${SITE}/blog/${p.slug}`;
    const absCover = p.cover_url?.startsWith("https://") ? p.cover_url : null;
    const ld: Record<string, unknown>[] = [
      {
        "@context": "https://schema.org",
        "@type": "BlogPosting",
        headline: p.title,
        description: desc,
        datePublished: p.published_at,
        dateModified: p.updated_at,
        author: { "@type": "Person", name: p.author_name },
        publisher: { "@type": "Organization", name: "Techaasvik", url: SITE },
        mainEntityOfPage: url,
        ...(absCover ? { image: absCover } : {}),
      },
    ];
    if (p.faq.length) {
      ld.push({
        "@context": "https://schema.org",
        "@type": "FAQPage",
        mainEntity: p.faq.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })),
      });
    }
    return {
      meta: [
        { title },
        { name: "description", content: desc },
        { property: "og:title", content: title },
        { property: "og:description", content: desc },
        { property: "og:type", content: "article" },
        { name: "twitter:card", content: "summary_large_image" },
        ...(absCover ? [{ property: "og:image", content: absCover }, { name: "twitter:image", content: absCover }] : []),
        ...(p.noindex ? [{ name: "robots", content: "noindex" }] : []),
      ],
      links: [{ rel: "canonical", href: url }],
      scripts: ld.map((j) => ({ type: "application/ld+json", children: JSON.stringify(j).replace(/</g, "\\u003c") })),
    };
  },
  component: BlogPostPage,
});

function BlogPostPage() {
  const { post, html } = Route.useLoaderData();
  return (
    <div className="min-h-screen bg-background">
      <PublicHeader />
      <main className="mx-auto max-w-6xl px-6 py-12">
        <Link to="/blog" className="text-sm text-muted-foreground hover:text-foreground">← All articles</Link>
        <h1 className="mt-4 text-4xl font-bold tracking-tight">{post.title}</h1>
        <p className="mt-3 text-sm text-muted-foreground">
          {post.author_name}
          {post.published_at ? ` · ${new Date(post.published_at).toLocaleDateString("en-IN", { dateStyle: "long" })}` : ""}
        </p>
        {post.cover_url && <img src={post.cover_url} alt={post.cover_alt ?? post.title} className="mt-8 w-full rounded-xl" />}
        <article className="blog-content mt-8" dangerouslySetInnerHTML={{ __html: html }} />
        {post.faq.length > 0 && (
          <section className="mt-12">
            <h2 className="text-2xl font-semibold">Frequently asked questions</h2>
            <div className="mt-4 space-y-4">
              {post.faq.map((f, i) => (
                <details key={i} className="rounded-lg border p-4">
                  <summary className="cursor-pointer font-medium">{f.q}</summary>
                  <p className="mt-2 text-muted-foreground">{f.a}</p>
                </details>
              ))}
            </div>
          </section>
        )}
        <div className="mt-12 rounded-xl border bg-muted/40 p-6">
          <p className="font-semibold">Automate your Instagram & Facebook replies</p>
          <p className="mt-1 text-sm text-muted-foreground">Turn every comment into a DM conversation with AutoDM by Techaasvik.</p>
          <Link to="/auth" className="mt-4 inline-flex rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground">Start free</Link>
        </div>
      </main>
      <PublicFooter />
    </div>
  );
}
