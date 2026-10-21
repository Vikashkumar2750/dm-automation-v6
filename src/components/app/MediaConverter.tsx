import { useState } from "react";
import { Download, FileUp, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { convertAny, formatBytes, savedPercent, type Converted } from "@/lib/media-convert";

type Item = { name: string; status: "working" | "done" | "error"; progress: number; result?: Converted; url?: string; error?: string };

/** Free converter: files never leave the visitor's browser. */
export function MediaConverter() {
  const [items, setItems] = useState<Item[]>([]);
  const update = (i: number, patch: Partial<Item>) => setItems((list) => list.map((it, k) => (k === i ? { ...it, ...patch } : it)));

  const onFiles = async (files: FileList | null) => {
    if (!files) return;
    const start = items.length;
    const list = Array.from(files).slice(0, 10);
    setItems((v) => [...v, ...list.map((f) => ({ name: f.name, status: "working" as const, progress: 0 }))]);
    for (let n = 0; n < list.length; n++) {
      const i = start + n;
      const file = list[n]!;
      try {
        if (file.size > 200 * 1024 * 1024) throw new Error("Max 200 MB per file");
        const result = await convertAny(file, (p) => update(i, { progress: p }));
        update(i, { status: "done", result, url: URL.createObjectURL(result.blob), progress: 100 });
      } catch (e) {
        update(i, { status: "error", error: e instanceof Error ? e.message : "Could not convert" });
      }
    }
  };

  return (
    <div className="space-y-4">
      <label className="flex cursor-pointer flex-col items-center gap-3 rounded-2xl border-2 border-dashed border-border bg-card p-10 text-center transition-colors hover:border-primary">
        <FileUp className="size-8 text-primary" />
        <span className="font-semibold">Choose photos, videos or audio</span>
        <span className="text-sm text-muted-foreground">JPG, PNG, GIF, HEIC* → WebP · MP4, MOV, MP3, WAV → WebM · up to 10 files</span>
        <input type="file" multiple accept="image/*,video/*,audio/*" className="sr-only" onChange={(e) => { void onFiles(e.target.files); e.target.value = ""; }} />
      </label>
      {items.map((it, i) => (
        <div key={i} className="flex flex-wrap items-center gap-3 rounded-xl border border-border bg-card p-4">
          <div className="min-w-0 flex-1">
            <p className="truncate font-medium">{it.name}</p>
            {it.status === "working" && <p className="text-sm text-muted-foreground">Converting… {it.progress ? `${it.progress}%` : ""}</p>}
            {it.status === "error" && <p className="text-sm text-destructive">{it.error}</p>}
            {it.result && (
              <p className="text-sm text-muted-foreground">
                {formatBytes(it.result.originalBytes)} → <span className="font-semibold text-foreground">{formatBytes(it.result.optimizedBytes)}</span>{" "}
                <span className={savedPercent(it.result.originalBytes, it.result.optimizedBytes) > 0 ? "text-primary" : ""}>
                  ({savedPercent(it.result.originalBytes, it.result.optimizedBytes)}% smaller)
                </span>
              </p>
            )}
          </div>
          {it.status === "working" && <Loader2 className="size-5 animate-spin text-primary" />}
          {it.url && it.result && (
            <Button asChild size="sm">
              <a href={it.url} download={it.name.replace(/\.[^.]+$/, "") + "." + it.result.ext}><Download className="size-4" /> Download .{it.result.ext}</a>
            </Button>
          )}
        </div>
      ))}
      <p className="text-xs text-muted-foreground">Your files are converted on your own device and are never uploaded. Videos take about as long as the clip to convert. *HEIC works only in Safari.</p>
    </div>
  );
}
