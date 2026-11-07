import { createFileRoute } from "@tanstack/react-router";
import { publicPageSchema } from "@/lib/public-page-seo";
import { ClientOnly } from "@tanstack/react-router";
import { PublicFooter } from "@/components/app/PublicFooter";
import { PublicHeader } from "@/components/app/PublicHeader";
import { MediaConverter } from "@/components/app/MediaConverter";

const TITLE = "Free WebP & WebM Converter — Image, Video & Audio | AutoDM";
const DESC = "Convert JPG, PNG, MP4, MOV and MP3 to WebP and WebM free in your browser. Smaller files, faster pages and better Core Web Vitals — no upload.";

export const Route = createFileRoute("/tools/webp-converter")({
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESC },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: DESC },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
    links: [{ rel: "canonical", href: "https://autodm.techaasvik.com/tools/webp-converter" }],
    scripts: publicPageSchema("/tools/webp-converter", TITLE, DESC),
  }),
  component: ConverterPage,
});

function ConverterPage() {
  return (
    <div className="min-h-screen bg-background">
      <PublicHeader />
      <main className="mx-auto max-w-6xl px-6 py-14">
        <p className="text-sm font-semibold uppercase tracking-wide text-primary">Free tool</p>
        <h1 className="mt-2 text-4xl font-bold tracking-tight">Any image to WebP, any video or audio to WebM</h1>
        <p className="mt-3 max-w-2xl text-muted-foreground">
          WebP photos are usually 25–80% smaller than JPG or PNG, and WebM videos load faster than MP4 — which helps your PageSpeed and Core Web Vitals scores.
        </p>
        <div className="mt-8 max-w-3xl">
          <ClientOnly fallback={<div className="h-48 rounded-2xl border border-border bg-card" />}>
            <MediaConverter />
          </ClientOnly>
        </div>
        <section className="mt-12 max-w-3xl space-y-3 text-sm text-muted-foreground">
          <h2 className="text-xl font-semibold text-foreground">How it works</h2>
          <ol className="list-decimal space-y-1 pl-5">
            <li>Choose up to 10 photos, videos or audio files, up to 800 MB each.</li>
            <li>Each one is converted right on your device — nothing is uploaded or stored.</li>
            <li>See the size before and after, then download the WebP or WebM file. The converted copy is cleared from your browser right after.</li>
          </ol>
        </section>
      </main>
      <PublicFooter />
    </div>
  );
}
