import { createFileRoute, notFound } from "@tanstack/react-router";
import { DeliveryPageView } from "@/components/app/DeliveryPageView";

export const Route = createFileRoute("/o/$token")({
  loader: async ({ params }) => {
    if (!/^[0-9a-f-]{36}$/.test(params.token)) throw notFound();
    const { getOfferPage } = await import("@/lib/revenue.functions");
    const page = await getOfferPage({ data: { token: params.token } });
    if (!page) throw notFound();
    return page;
  },
  head: ({ loaderData }) => ({ meta: [
    { title: loaderData?.title ?? "Your offer" }, { name: "description", content: "Your personalised offer is ready." },
    { property: "og:title", content: loaderData?.title ?? "Your offer" }, { property: "og:description", content: "Your personalised offer is ready." },
    { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }, { name: "robots", content: "noindex" },
  ] }),
  notFoundComponent: () => <div className="grid min-h-screen place-items-center p-6 text-muted-foreground">This offer is not available.</div>,
  component: OfferPage,
});

function OfferPage() {
  const page = Route.useLoaderData();
  const { token } = Route.useParams();
  return <main className="min-h-screen"><DeliveryPageView {...page} buttonHref={`/api/public/offer/${token}`} /></main>;
}