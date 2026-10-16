import { createFileRoute, notFound } from "@tanstack/react-router";

import { DeliveryPageView } from "@/components/app/DeliveryPageView";
import { getPublicPage } from "@/lib/revenue.functions";

const plain = (s: string) => s.replace(/[#>*?|•-]/g, " ").replace(/\s+/g, " ").trim().slice(0, 150);

export const Route = createFileRoute("/p/$slug")({
  loader: async ({ params }) => {
    const page = await getPublicPage({ data: { slug: params.slug } });
    if (!page) throw notFound();
    return page;
  },
  head: ({ loaderData }) => ({
    meta: [
      { title: loaderData?.title ?? "Page" },
      { name: "description", content: plain(loaderData?.body ?? "") || "Your link is ready." },
      { property: "og:title", content: loaderData?.title ?? "Page" },
      { property: "og:description", content: plain(loaderData?.body ?? "") || "Your link is ready." },
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
    <main className="min-h-screen">
      <DeliveryPageView title={page.title} body={page.body} buttonLabel={page.buttonLabel} buttonHref={page.hasButton ? `/api/public/pg/${slug}` : null}
        imageUrl={page.imageUrl} imageAlt={page.imageAlt} countdownAt={page.countdownAt} expiryAction={page.expiryAction} expiryMessage={page.expiryMessage} price={page.price} leadForm={{ slug, config: page.formConfig }} buyerSlug={slug} />
    </main>
  );
}
