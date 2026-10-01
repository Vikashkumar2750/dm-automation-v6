import { useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  Bold, Code, Heading2, Heading3, ImagePlus, Italic, Link2, List, ListOrdered, Loader2, Minus, Quote, Table,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { adminUploadBlogImage } from "@/lib/blog.functions";

export function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(",")[1] ?? "");
    reader.onerror = () => reject(new Error("Could not read the file"));
    reader.readAsDataURL(file);
  });
}

export function useBlogImageUpload() {
  const upload = useServerFn(adminUploadBlogImage);
  const [busy, setBusy] = useState(false);
  const run = async (file: File) => {
    if (file.size > 5 * 1024 * 1024) throw new Error("Image must be under 5 MB");
    setBusy(true);
    try {
      return (await upload({ data: { name: file.name, type: file.type, base64: await fileToBase64(file) } })).url;
    } finally {
      setBusy(false);
    }
  };
  return { upload: run, busy };
}

export function MarkdownEditor({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const { upload, busy } = useBlogImageUpload();

  const apply = (before: string, after = "", placeholder = "text", linePrefix = false) => {
    const el = ref.current;
    if (!el) return;
    const s = el.selectionStart, e = el.selectionEnd;
    let sel = value.slice(s, e) || placeholder;
    if (linePrefix) sel = sel.split("\n").map((l, i) => before.replace("1.", `${i + 1}.`) + l).join("\n");
    const insert = linePrefix ? sel : before + sel + after;
    const needsBreak = linePrefix && s > 0 && value[s - 1] !== "\n" ? "\n" : "";
    const next = value.slice(0, s) + needsBreak + insert + value.slice(e);
    onChange(next);
    requestAnimationFrame(() => {
      el.focus();
      const start = s + needsBreak.length + (linePrefix ? 0 : before.length);
      el.setSelectionRange(start, start + (linePrefix ? insert.length : sel.length));
    });
  };

  const onImage = async (file?: File) => {
    if (!file) return;
    try {
      const url = await upload(file);
      const alt = file.name.replace(/\.[^.]+$/, "").replace(/[-_]+/g, " ");
      apply(`\n![${alt}](${url})\n`, "", "", false);
      toast.success("Image added");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Upload failed");
    }
  };

  const tools = [
    { icon: Heading2, label: "Heading 2", run: () => apply("## ", "", "Heading", true) },
    { icon: Heading3, label: "Heading 3", run: () => apply("### ", "", "Sub heading", true) },
    { icon: Bold, label: "Bold", run: () => apply("**", "**", "bold text") },
    { icon: Italic, label: "Italic", run: () => apply("_", "_", "italic text") },
    { icon: Link2, label: "Link", run: () => { const url = window.prompt("Link URL", "https://"); if (url) apply("[", `](${url})`, "link text"); } },
    { icon: List, label: "Bullet list", run: () => apply("- ", "", "List item", true) },
    { icon: ListOrdered, label: "Numbered list", run: () => apply("1. ", "", "List item", true) },
    { icon: Quote, label: "Quote", run: () => apply("> ", "", "Quote", true) },
    { icon: Code, label: "Code", run: () => apply("`", "`", "code") },
    { icon: Table, label: "Table", run: () => apply("\n| Column 1 | Column 2 |\n| --- | --- |\n| Value | Value |\n", "", "") },
    { icon: Minus, label: "Divider", run: () => apply("\n---\n", "", "") },
  ];

  return (
    <div className="rounded-md border">
      <div className="flex flex-wrap items-center gap-1 border-b bg-muted/40 p-1">
        {tools.map((t) => (
          <Button key={t.label} type="button" size="icon" variant="ghost" className="size-8" title={t.label} aria-label={t.label} onClick={t.run}>
            <t.icon className="size-4" />
          </Button>
        ))}
        <Button type="button" size="sm" variant="ghost" className="h-8" disabled={busy} onClick={() => fileRef.current?.click()}>
          {busy ? <Loader2 className="mr-1 size-4 animate-spin" /> : <ImagePlus className="mr-1 size-4" />}Add image
        </Button>
        <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp,image/gif" className="hidden"
          onChange={(e) => { void onImage(e.target.files?.[0]); e.target.value = ""; }} />
      </div>
      <Textarea ref={ref} rows={22} className="rounded-none border-0 font-mono text-sm focus-visible:ring-0" value={value}
        onChange={(e) => onChange(e.target.value)}
        onPaste={(e) => { const f = e.clipboardData.files?.[0]; if (f?.type.startsWith("image/")) { e.preventDefault(); void onImage(f); } }} />
    </div>
  );
}
