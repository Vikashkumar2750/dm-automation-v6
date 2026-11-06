import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { Loader2, RefreshCw, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { fileToBase64 } from "@/components/app/MarkdownEditor";
import { adminCleanupTempMedia, adminDeleteMedia, adminListMedia, adminReplaceMedia } from "@/lib/media.functions";
import { formatBytes, savedPercent } from "@/lib/media-convert";

export const Route = createFileRoute("/_authenticated/admin/media")({
  head: () => ({
    meta: [
      { title: "Media Library — Techaasvik Operations" },
      { name: "description", content: "All uploaded media per user with WebP/WebM savings, replace and delete." },
      { property: "og:title", content: "Media Library — Techaasvik Operations" },
      { property: "og:description", content: "Super-admin media library with optimization stats." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AdminMediaPage,
});

function AdminMediaPage() {
  const [userId, setUserId] = useState<string>("");
  const list = useServerFn(adminListMedia);
  const del = useServerFn(adminDeleteMedia);
  const replace = useServerFn(adminReplaceMedia);
  const cleanup = useServerFn(adminCleanupTempMedia);
  const onCleanup = async () => {
    if (!confirm("Delete converted/temporary files older than 7 days?")) return;
    try { const r = await cleanup({ data: { days: 7 } }); toast.success(r.removed ? `Removed ${r.removed} old temporary files` : "Nothing to clean — no temporary files older than 7 days"); await qc.invalidateQueries({ queryKey: ["admin-media"] }); }
    catch (e) { toast.error(e instanceof Error ? e.message : "Cleanup failed"); }
  };
  const qc = useQueryClient();
  const [busy, setBusy] = useState<string | null>(null);
  const q = useQuery({ queryKey: ["admin-media", userId], queryFn: () => list({ data: { userId: userId || null } }) });
  const users = q.data?.users ?? [];
  const nameOf = (id: string | null) => users.find((u: any) => u.id === id)?.email ?? "—";

  const onReplace = async (row: any, file: File) => {
    setBusy(row.id);
    try {
      let out: Blob = file;
      const keepFormat = row.bucket === "post-media"; // Instagram/Facebook need JPEG/MP4
      if (!keepFormat) {
        const { convertAny } = await import("@/lib/media-convert");
        const c = await convertAny(file).catch(() => null);
        if (c && c.optimizedBytes < file.size) out = c.blob;
      }
      if (out.size > 20 * 1024 * 1024) throw new Error("File is over 20 MB");
      await replace({ data: { id: row.id, type: out.type || file.type, base64: await fileToBase64(out as File), originalBytes: file.size } });
      toast.success("Replaced");
      await qc.invalidateQueries({ queryKey: ["admin-media"] });
    } catch (e) { toast.error(e instanceof Error ? e.message : "Could not replace"); }
    finally { setBusy(null); }
  };

  const onDelete = async (row: any) => {
    if (!confirm("Delete this file permanently? Pages using it will lose the image.")) return;
    setBusy(row.id);
    try { await del({ data: { id: row.id } }); toast.success("Deleted"); await qc.invalidateQueries({ queryKey: ["admin-media"] }); }
    catch (e) { toast.error(e instanceof Error ? e.message : "Could not delete"); }
    finally { setBusy(null); }
  };

  const t = q.data?.totals;
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Media Library</h1>
          <p className="text-sm text-muted-foreground">Website images are saved as WebP automatically. Post media keeps its format because Instagram/Facebook require JPEG/MP4.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
        <button type="button" onClick={() => void onCleanup()} className="h-9 rounded-md border border-input bg-background px-3 text-sm font-medium hover:bg-muted">Clean up temp files (7+ days)</button>
        <select className="h-9 rounded-md border border-input bg-background px-3 text-sm" value={userId} onChange={(e) => setUserId(e.target.value)}>
          <option value="">All users</option>
          {users.map((u: any) => <option key={u.id} value={u.id}>{u.email ?? u.full_name ?? u.id}</option>)}
        </select>
        </div>
      </div>
      {t && (
        <div className="grid gap-3 sm:grid-cols-3">
          <Stat label="Original size (all)" value={formatBytes(t.before)} />
          <Stat label="Stored size now" value={formatBytes(t.after)} />
          <Stat label="Saved" value={`${formatBytes(Math.max(0, t.before - t.after))} (${savedPercent(t.before, t.after)}%)`} />
        </div>
      )}
      {q.isLoading ? <Loader2 className="size-5 animate-spin" /> : q.error ? <p className="text-destructive">{(q.error as Error).message}</p> : (
        <div className="overflow-x-auto rounded-xl border border-border">
          <table className="w-full min-w-[860px] text-sm">
            <thead className="bg-muted text-left"><tr>
              <th className="p-3">Preview</th><th className="p-3">User</th><th className="p-3">Where</th><th className="p-3">Before</th><th className="p-3">After</th><th className="p-3">Date</th><th className="p-3" />
            </tr></thead>
            <tbody>
              {(q.data?.items ?? []).map((r: any) => (
                <tr key={r.id} className="border-t border-border">
                  <td className="p-3">
                    {r.kind === "image" ? <img src={r.url} alt="" loading="lazy" className="size-14 rounded object-cover" />
                      : r.kind === "video" ? <video src={r.url} className="size-14 rounded object-cover" muted preload="metadata" />
                      : <span className="text-xs">{r.kind}</span>}
                  </td>
                  <td className="p-3">{nameOf(r.user_id)}</td>
                  <td className="p-3">{r.source}</td>
                  <td className="p-3">{formatBytes(Number(r.original_bytes))}<div className="text-xs text-muted-foreground">{r.original_type}</div></td>
                  <td className="p-3">{formatBytes(Number(r.optimized_bytes))}<div className="text-xs text-primary">{r.optimized_type} · {savedPercent(Number(r.original_bytes), Number(r.optimized_bytes))}% smaller</div></td>
                  <td className="p-3">{new Date(r.created_at).toLocaleDateString()}</td>
                  <td className="p-3">
                    <div className="flex gap-2">
                      <Button asChild size="sm" variant="outline" disabled={busy === r.id}>
                        <label className="cursor-pointer">
                          {busy === r.id ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" />} Replace
                          <input type="file" accept="image/*,video/*,audio/*" className="sr-only" onChange={(e) => { const f = e.target.files?.[0]; if (f) void onReplace(r, f); e.target.value = ""; }} />
                        </label>
                      </Button>
                      <Button size="sm" variant="outline" disabled={busy === r.id} onClick={() => onDelete(r)}><Trash2 className="size-4" /></Button>
                    </div>
                  </td>
                </tr>
              ))}
              {!q.data?.items.length && <tr><td colSpan={7} className="p-6 text-center text-muted-foreground">No media yet — new uploads appear here.</td></tr>}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return <div className="rounded-xl border border-border bg-card p-4"><p className="text-xs text-muted-foreground">{label}</p><p className="text-lg font-semibold">{value}</p></div>;
}
