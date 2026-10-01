import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { Loader2, Plus, Sparkles, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { MarkdownEditor, useBlogImageUpload } from "@/components/app/MarkdownEditor";
import { PageHeader, Panel, StatusBadge } from "@/components/app/primitives";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { adminBlogAi, adminDeletePost, adminListPosts, adminSavePost, type BlogPost, type FaqItem } from "@/lib/blog.functions";
import { geoChecks, scoreOf, seoChecks, slugify, type Check } from "@/lib/seo-score";

export const Route = createFileRoute("/_authenticated/admin/blog")({
  head: () => ({
    meta: [
      { title: "Blog CMS — Techaasvik Operations" },
      { name: "description", content: "Write, score and publish blog articles with SEO and GEO checks." },
      { property: "og:title", content: "Blog CMS — Techaasvik Operations" },
      { property: "og:description", content: "Super-admin blog editor with SEO and GEO scoring." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AdminBlogPage,
});

type Draft = Omit<BlogPost, "id" | "published_at" | "updated_at"> & { id?: string };

const EMPTY: Draft = {
  slug: "", title: "", seo_title: "", meta_description: "", excerpt: "", content: "", focus_keyword: "",
  cover_url: "", cover_alt: "", author_name: "Techaasvik Team", status: "draft", tags: [], faq: [], noindex: false, canonical_url: "",
};

function ScoreList({ title, checks }: { title: string; checks: Check[] }) {
  const score = scoreOf(checks);
  return (
    <div>
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold">{title}</p>
        <StatusBadge tone={score >= 80 ? "success" : score >= 50 ? "warning" : "danger"}>{score}/100</StatusBadge>
      </div>
      <ul className="mt-2 space-y-1">
        {checks.map((c) => (
          <li key={c.label} className="text-xs">
            <span className={c.pass ? "text-success" : "text-destructive"}>{c.pass ? "✓" : "✗"}</span> {c.label}
            {!c.pass && <span className="block pl-4 text-muted-foreground">{c.tip}</span>}
          </li>
        ))}
      </ul>
    </div>
  );
}

function AdminBlogPage() {
  const list = useServerFn(adminListPosts);
  const save = useServerFn(adminSavePost);
  const del = useServerFn(adminDeletePost);
  const ai = useServerFn(adminBlogAi);
  const qc = useQueryClient();
  const { data: posts = [] } = useQuery({ queryKey: ["admin-blog"], queryFn: () => list() });
  const [d, setD] = useState<Draft | null>(null);

  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setD((p) => (p ? { ...p, [k]: v } : p));

  const input = d && {
    title: d.title, seoTitle: d.seo_title ?? "", metaDescription: d.meta_description ?? "", slug: d.slug,
    content: d.content, focusKeyword: d.focus_keyword ?? "", excerpt: d.excerpt, coverAlt: d.cover_alt ?? "", faqCount: d.faq.length,
  };
  const seo = useMemo(() => (input ? seoChecks(input) : []), [JSON.stringify(input)]);
  const geo = useMemo(() => (input ? geoChecks(input) : []), [JSON.stringify(input)]);

  const saveM = useMutation({
    mutationFn: (draft: Draft) =>
      save({ data: { ...draft, slug: draft.slug || slugify(draft.title), seo_title: draft.seo_title || null, meta_description: draft.meta_description || null, focus_keyword: draft.focus_keyword || null, cover_alt: draft.cover_alt || null, cover_url: draft.cover_url || null, canonical_url: draft.canonical_url || null } }),
    onSuccess: (r) => {
      toast.success("Saved");
      setD((p) => (p ? { ...p, id: r.id } : p));
      void qc.invalidateQueries({ queryKey: ["admin-blog"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const aiM = useMutation({
    mutationFn: (task: "outline" | "improve" | "meta" | "faq") =>
      ai({ data: { task, title: d!.title, focusKeyword: d!.focus_keyword ?? "", content: d!.content.slice(0, 20000) } }).then((r) => ({ task, text: r.text })),
    onSuccess: ({ task, text }) => {
      if (task === "outline" || task === "improve") return set("content", text);
      try {
        const j = JSON.parse(text.match(/\{[\s\S]*\}/)?.[0] ?? text);
        if (task === "meta") setD((p) => p && { ...p, seo_title: j.seoTitle ?? p.seo_title, meta_description: j.metaDescription ?? p.meta_description, excerpt: j.excerpt ?? p.excerpt });
        else set("faq", (j.faq as FaqItem[]).slice(0, 10));
        toast.success("AI suggestions added");
      } catch {
        toast.error("AI reply was not in the expected format — try again");
      }
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (!d) {
    return (
      <div className="space-y-6">
        <PageHeader title="Blog" description="Write and publish articles with live SEO and GEO scores." />
        <Button onClick={() => setD({ ...EMPTY })}><Plus className="mr-2 size-4" /> New article</Button>
        <Panel title={`Articles (${posts.length})`}>
          <ul className="divide-y">
            {posts.map((p) => {
              const s = scoreOf(seoChecks({ title: p.title, seoTitle: p.seo_title ?? "", metaDescription: p.meta_description ?? "", slug: p.slug, content: p.content, focusKeyword: p.focus_keyword ?? "", excerpt: p.excerpt, coverAlt: p.cover_alt ?? "", faqCount: p.faq.length }));
              return (
                <li key={p.id} className="flex items-center justify-between gap-3 py-3">
                  <button className="min-w-0 flex-1 text-left" onClick={() => setD({ ...p, faq: p.faq ?? [] })}>
                    <p className="truncate font-medium">{p.title}</p>
                    <p className="text-xs text-muted-foreground">/blog/{p.slug} · SEO {s}</p>
                  </button>
                  <StatusBadge tone={p.status === "published" ? "success" : "neutral"}>{p.status}</StatusBadge>
                  <Button size="icon" variant="ghost" aria-label="Delete article" onClick={async () => {
                    if (!confirm(`Delete "${p.title}"?`)) return;
                    await del({ data: { id: p.id } });
                    void qc.invalidateQueries({ queryKey: ["admin-blog"] });
                  }}><Trash2 className="size-4" /></Button>
                </li>
              );
            })}
          </ul>
        </Panel>
      </div>
    );
  }

  const busy = aiM.isPending;
  return (
    <div className="space-y-6">
      <PageHeader title={d.id ? "Edit article" : "New article"} description="Scores update as you type." />
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" onClick={() => setD(null)}>Back</Button>
        <Button variant="outline" disabled={saveM.isPending} onClick={() => saveM.mutate({ ...d, status: "draft" })}>Save draft</Button>
        <Button disabled={saveM.isPending || d.title.length < 3} onClick={() => saveM.mutate({ ...d, status: "published" })}>
          {d.status === "published" ? "Update" : "Publish"}
        </Button>
        {d.status === "published" && <a className="self-center text-sm underline" href={`/blog/${d.slug}`} target="_blank" rel="noreferrer">View live</a>}
      </div>
      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <div className="space-y-4">
          <Panel title="Content">
            <div className="space-y-4">
              <div className="space-y-2"><Label>Title</Label><Input value={d.title} onChange={(e) => setD({ ...d, title: e.target.value, slug: d.id ? d.slug : slugify(e.target.value) })} /></div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2"><Label>Focus keyword</Label><Input value={d.focus_keyword ?? ""} onChange={(e) => set("focus_keyword", e.target.value)} placeholder="instagram dm automation" /></div>
                <div className="space-y-2"><Label>URL slug</Label><Input value={d.slug} onChange={(e) => set("slug", slugify(e.target.value))} /></div>
              </div>
              <div className="flex flex-wrap gap-2">
                {([["outline", "Write full article"], ["improve", "Improve for SEO/GEO"], ["meta", "Generate title & description"], ["faq", "Generate FAQs"]] as const).map(([t, l]) => (
                  <Button key={t} size="sm" variant="secondary" disabled={busy || d.title.length < 3} onClick={() => aiM.mutate(t)}>
                    {busy && aiM.variables === t ? <Loader2 className="mr-1 size-3 animate-spin" /> : <Sparkles className="mr-1 size-3" />}{l}
                  </Button>
                ))}
              </div>
              <div className="space-y-2"><Label>Article</Label><MarkdownEditor value={d.content} onChange={(v) => set("content", v)} /></div>
              <div className="space-y-2"><Label>Excerpt / summary</Label><Textarea rows={2} value={d.excerpt} onChange={(e) => set("excerpt", e.target.value)} /></div>
            </div>
          </Panel>
          <Panel title="Search appearance">
            <div className="space-y-4">
              <div className="space-y-2"><Label>SEO title ({(d.seo_title || d.title).length}/60)</Label><Input value={d.seo_title ?? ""} onChange={(e) => set("seo_title", e.target.value)} /></div>
              <div className="space-y-2"><Label>Meta description ({(d.meta_description ?? "").length}/160)</Label><Textarea rows={2} value={d.meta_description ?? ""} onChange={(e) => set("meta_description", e.target.value)} /></div>
              <div className="rounded-lg border p-3">
                <p className="truncate text-sm text-primary">{d.seo_title || d.title || "Title"}</p>
                <p className="text-xs text-success">autodm.techaasvik.com/blog/{d.slug}</p>
                <p className="line-clamp-2 text-xs text-muted-foreground">{d.meta_description || d.excerpt}</p>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2"><Label>Cover image</Label><div className="flex gap-2"><Input value={d.cover_url ?? ""} onChange={(e) => set("cover_url", e.target.value)} placeholder="https://…" /><CoverUpload onUrl={(u) => set("cover_url", u)} /></div></div>
                <div className="space-y-2"><Label>Cover alt text</Label><Input value={d.cover_alt ?? ""} onChange={(e) => set("cover_alt", e.target.value)} /></div>
                <div className="space-y-2"><Label>Tags (comma separated)</Label><Input value={d.tags.join(", ")} onChange={(e) => set("tags", e.target.value.split(",").map((t) => t.trim()).filter(Boolean))} /></div>
                <div className="space-y-2"><Label>Canonical URL (optional)</Label><Input value={d.canonical_url ?? ""} onChange={(e) => set("canonical_url", e.target.value)} /></div>
                <div className="space-y-2"><Label>Author</Label><Input value={d.author_name} onChange={(e) => set("author_name", e.target.value)} /></div>
                <div className="flex items-center gap-3 pt-6"><Switch checked={d.noindex} onCheckedChange={(v) => set("noindex", v)} /><Label>Hide from Google (noindex)</Label></div>
              </div>
            </div>
          </Panel>
          <Panel title={`FAQ (${d.faq.length})`}>
            <div className="space-y-3">
              {d.faq.map((f, i) => (
                <div key={i} className="space-y-2 rounded-lg border p-3">
                  <Input value={f.q} placeholder="Question" onChange={(e) => set("faq", d.faq.map((x, j) => (j === i ? { ...x, q: e.target.value } : x)))} />
                  <Textarea rows={2} value={f.a} placeholder="Answer" onChange={(e) => set("faq", d.faq.map((x, j) => (j === i ? { ...x, a: e.target.value } : x)))} />
                  <Button size="sm" variant="ghost" onClick={() => set("faq", d.faq.filter((_, j) => j !== i))}>Remove</Button>
                </div>
              ))}
              <Button size="sm" variant="outline" onClick={() => set("faq", [...d.faq, { q: "", a: "" }])}><Plus className="mr-1 size-3" /> Add question</Button>
            </div>
          </Panel>
        </div>
        <div className="space-y-4 lg:sticky lg:top-4 lg:self-start">
          <Panel title="Scores"><div className="space-y-6"><ScoreList title="SEO" checks={seo} /><ScoreList title="GEO (AI search)" checks={geo} /></div></Panel>
        </div>
      </div>
    </div>
  );
}

function CoverUpload({ onUrl }: { onUrl: (url: string) => void }) {
  const { upload, busy } = useBlogImageUpload();
  return (
    <Button asChild type="button" variant="outline" size="sm" className="h-9 shrink-0" disabled={busy}>
      <label className="cursor-pointer">
        {busy ? <Loader2 className="size-4 animate-spin" /> : "Upload"}
        <input type="file" accept="image/png,image/jpeg,image/webp,image/gif" className="hidden"
          onChange={async (e) => {
            const f = e.target.files?.[0]; e.target.value = "";
            if (!f) return;
            try { onUrl(await upload(f)); toast.success("Cover uploaded"); } catch (err) { toast.error(err instanceof Error ? err.message : "Upload failed"); }
          }} />
      </label>
    </Button>
  );
}
