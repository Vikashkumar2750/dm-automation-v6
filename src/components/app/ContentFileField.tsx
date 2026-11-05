import { FileText, Loader2, Upload, X } from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { isProductFile, productFileName, PRODUCT_FILE_ACCEPT, PRODUCT_FILE_MAX_MB, uploadProductFile } from "@/lib/product-files";

/** Link input with an "Upload file" option; uploaded files are private and only released to paying/eligible buyers. */
export function ContentFileField({ orgId, value, onChange, placeholder, id }: { orgId: string; value: string; onChange: (v: string) => void; placeholder: string; id?: string }) {
  const ref = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const pick = async (file?: File) => {
    if (!file) return;
    setBusy(true);
    try { onChange(await uploadProductFile(orgId, file)); toast.success("File uploaded — save to apply"); }
    catch (e) { toast.error(e instanceof Error ? e.message : "Upload failed"); }
    finally { setBusy(false); if (ref.current) ref.current.value = ""; }
  };
  return (
    <div className="w-full space-y-1">
      {isProductFile(value) ? (
        <div className="flex items-center gap-2 rounded-md border border-border bg-muted/40 px-3 py-2 text-sm">
          <FileText className="size-4 shrink-0 text-primary" />
          <span className="truncate">{productFileName(value)}</span>
          <Button type="button" size="icon" variant="ghost" className="ml-auto size-7" aria-label="Remove file" onClick={() => onChange("")}><X className="size-4" /></Button>
        </div>
      ) : (
        <div className="flex gap-2">
          <Input id={id} placeholder={placeholder} value={value} onChange={(e) => onChange(e.target.value)} />
          <Button type="button" variant="outline" disabled={busy} onClick={() => ref.current?.click()}>
            {busy ? <Loader2 className="size-4 animate-spin" /> : <Upload className="size-4" />}<span className="ml-1">Upload</span>
          </Button>
        </div>
      )}
      <input ref={ref} type="file" hidden accept={PRODUCT_FILE_ACCEPT} onChange={(e) => pick(e.target.files?.[0])} />
      <p className="text-xs text-muted-foreground">Paste a link or upload a file — max {PRODUCT_FILE_MAX_MB} MB (PDF, ZIP, EPUB, DOC/DOCX, XLS/XLSX, PPT, CSV, TXT, MP3/WAV, images). For bigger videos/courses, paste a link.</p>
    </div>
  );
}
