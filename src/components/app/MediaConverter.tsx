import { useEffect, useRef, useState } from "react";
import { Download, FileUp, Loader2, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { convertAny, formatBytes, savedPercent, type Converted } from "@/lib/media-convert";

/** Per-file limit of the free converter. */
export const CONVERTER_MAX_MB = 800;
const MAX_BYTES = CONVERTER_MAX_MB * 1024 * 1024;
const BIG_VIDEO_BYTES = 200 * 1024 * 1024;

type Item = { name: string; status: "working" | "done" | "error" | "downloaded"; progress: number; size: number; result?: Converted; url?: string; error?: string };

/** Free converter: files never leave the visitor's browser; converted copies are freed right after download. */
export function MediaConverter() {
  const [items, setItems] = useState<Item[]>([]);
  const urls = useRef<Set<string>>(new Set());
  const update = (i: number, patch: Partial<Item>) => setItems((list) => list.map((it, k) => (k === i ? { ...it, ...patch } : it)));

  useEffect(() => () => { urls.current.forEach((u) => URL.revokeObjectURL(u)); }, []);

  const onFiles = async (files: FileList | null) => {
    if (!files) return;
    const start = items.length;
    const list = Array.from(files).slice(0, 10);
    setItems((v) => [...v, ...list.map((f) => ({ name: f.name, size: f.size, status: "working" as const, progress: 0 }))]);
    for (let n = 0; n < list.length; n++) {
      const i = start + n;
      const file = list[n]!;
      try {
        if (file.size > MAX_BYTES) throw new Error(`Max ${CONVERTER_MAX_MB} MB per file`);
        const result = await convertAny(file, (p) => update(i, { progress: p }));
        const url = URL.createObjectURL(result.blob);
        urls.current.add(url);
        update(i, { status: "done", result, url, progress: 100 });
      } catch (e) {
        update(i, { status: "error", error: e instanceof Error ? e.message : "Could not convert" });
      }
    }
  };

  const release = (i: number) => {
    const url = items[i]?.url;
    // Give the browser a moment to start the download before freeing the memory.
    window.setTimeout(() => {
      if (url) { URL.revokeObjectURL(url); urls.current.delete(url); }
      setItems((list) => list.map((it, k) => {
        if (k !== i) return it;
        const { url: _u, ...rest } = it;
        return { ...rest, status: "downloaded" as const, ...(it.result ? { result: { ...it.result, blob: new Blob() } } : {}) };
      }));
    }, 1500);
  };

  const clearAll = () => {
    urls.current.forEach((u) => URL.revokeObjectURL(u));
    urls.current.clear();
    setItems([]);
  };

  return (
    <div className="space-y-4">
      <label className="flex cursor-pointer flex-col items-center gap-3 rounded-2xl border-2 border-dashed border-border bg-card p-10 text-center transition-colors hover:border-primary">
        <FileUp className="size-8 text-primary" />
        <span className="text-lg font-semibold">Choose photos, videos or audio</span>
        <span className="text-sm text-muted-foreground">JPG, PNG, GIF, HEIC* → WebP · MP4, MOV, MP3, WAV → WebM · up to 10 files · max {CONVERTER_MAX_MB} MB each</span>
        <input type="file" multiple accept="image/*,video/*,audio/*" className="sr-only" onChange={(e) => { void onFiles(e.target.files); e.target.value = ""; }} />
      </label>
      {items.length > 0 && (
        <div className="flex justify-end">
          <Button type="button" variant="outline" size="sm" onClick={clearAll}><Trash2 className="size-4" /> Clear all</Button>
        </div>
      )}
      {items.map((it, i) => (
        <div key={i} className="flex flex-wrap items-center gap-3 rounded-xl border border-border bg-card p-4">
          <div className="min-w-0 flex-1">
            <p className="truncate font-medium">{it.name}</p>
            {it.status === "working" && (
              <>
                <p className="text-sm text-muted-foreground">Converting… {it.progress ? `${it.progress}%` : ""}</p>
                <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-muted"><div className="h-full bg-primary transition-all" style={{ width: `${it.progress || 2}%` }} /></div>
                {it.size > BIG_VIDEO_BYTES && <p className="mt-1 text-xs text-muted-foreground">Large file — this can take about as long as the clip. Keep this tab open.</p>}
              </>
            )}
            {it.status === "error" && <p className="text-sm text-destructive">{it.error}</p>}
            {it.status === "downloaded" && <p className="text-sm text-muted-foreground">Downloaded — converted copy cleared from this browser.</p>}
            {it.result && it.status === "done" && (
              <p className="text-sm text-muted-foreground">
                {formatBytes(it.result.originalBytes)} → <span className="font-semibold text-foreground">{formatBytes(it.result.optimizedBytes)}</span>{" "}
                <span className={savedPercent(it.result.originalBytes, it.result.optimizedBytes) > 0 ? "text-primary" : ""}>
                  ({savedPercent(it.result.originalBytes, it.result.optimizedBytes)}% smaller)
                </span>
              </p>
            )}
          </div>
          {it.status === "working" && <Loader2 className="size-5 animate-spin text-primary" />}
          {it.url && it.result && it.status === "done" && (
            <Button asChild size="sm">
              <a href={it.url} onClick={() => release(i)} download={it.name.replace(/\.[^.]+$/, "") + "." + it.result.ext}><Download className="size-4" /> Download .{it.result.ext}</a>
            </Button>
          )}
        </div>
      ))}
      <p className="text-xs text-muted-foreground">Your files are converted on your own device and are never uploaded or stored on our servers. After you download, the converted copy is removed from this browser. *HEIC works only in Safari.</p>
    </div>
  );
}
