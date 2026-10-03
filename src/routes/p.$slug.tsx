import { createFileRoute, notFound } from "@tanstack/react-router";

import { Button } from "@/components/ui/button";
import { getPublicPage } from "@/lib/revenue.functions";

export const Route = createFileRoute("/p/$slug")({
  loader: async ({ params }) => {
    const page = await getPublicPage({ data: { slug: params.slug } });
    if (!page) throw notFound();
    return page;
  },
  head: ({ loaderData }) => ({
    meta: [
      { title: loaderData?.title ?? "Page" },
      { name: "description", content: (loaderData?.body ?? "").slice(0, 150) || "Your link is ready." },
      { property: "og:title", content: loaderData?.title ?? "Page" },
      { property: "og:description", content: (loaderData?.body ?? "").slice(0, 150) || "Your link is ready." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  notFoundComponent: () => <div className="grid min-h-screen place-items-center p-6 text-muted-foreground">This page is not available.</div>,
  component: DeliveryPage,
});

function DeliveryPage() {
  const page = Route.useLoaderData();
  const { slug } = Route.useParams();
  return (
    <main className="grid min-h-screen place-items-center bg-muted/30 p-6">
      <div className="w-full max-w-md rounded-2xl border border-border bg-card p-8 text-center shadow-sm">
        <h1 className="text-2xl font-semibold text-foreground">{page.title}</h1>
        {page.body && <p className="mt-3 whitespace-pre-line text-sm text-muted-foreground">{page.body}</p>}
        {page.hasButton && (
          <Button asChild size="lg" className="mt-6 w-full">
            <a href={`/api/public/pg/${slug}`} rel="nofollow">{page.buttonLabel || "Open"}</a>
          </Button>
        )}
      </div>
    </main>
  );
}
