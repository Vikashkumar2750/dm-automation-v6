import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { CloudUpload, RefreshCw, Save } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { getDriveBackup, updateDriveBackup } from "@/lib/drive-backup.functions";

export function DriveBackupPanel() {
  const get = useServerFn(getDriveBackup);
  const update = useServerFn(updateDriveBackup);
  const query = useQuery({ queryKey: ["admin-drive-backup"], queryFn: () => get(), refetchInterval: 15000 });
  const [draft, setDraft] = useState<{ enabled: boolean; intervalHours: 6 | 12 | 24 } | null>(null);
  const [busy, setBusy] = useState(false);
  const data = query.data;
  const enabled = draft?.enabled ?? data?.enabled ?? false;
  const intervalHours = draft?.intervalHours ?? data?.intervalHours ?? 24;
  const change = (patch: Partial<{ enabled: boolean; intervalHours: 6 | 12 | 24 }>) => setDraft({ enabled, intervalHours: intervalHours as 6 | 12 | 24, ...patch });
  const act = async (action: "save" | "run") => {
    if (action === "run" && !window.confirm("Save a private full database archive to the connected platform owner's Google Drive?")) return;
    setBusy(true);
    try {
      await update({ data: action === "run" ? { action } : { action, enabled, intervalHours: intervalHours as 6 | 12 | 24 } });
      if (action === "save") setDraft(null);
      await query.refetch();
      toast.success(action === "run" ? "Backup queued" : "Backup schedule saved");
    } catch (e) { toast.error(e instanceof Error ? e.message : "Backup request failed"); }
    finally { setBusy(false); }
  };
  const blocked = busy || !data?.connected || !data?.hostReady || data.status === "running" || data.status === "queued";
  return <section className="space-y-4 border-t py-5">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <h2 className="font-semibold">Google Drive backups</h2>
      <Button variant="ghost" size="icon" aria-label="Refresh Drive backup status" onClick={() => query.refetch()}><RefreshCw className="h-4 w-4" /></Button>
    </div>
    {query.isPending ? <p className="text-sm text-muted-foreground">Loading backup status…</p> : query.isError ? <p role="alert" className="text-sm text-destructive">Backup status unavailable. Refresh to retry.</p> : <>
      <p className="text-sm text-muted-foreground">{data?.connected ? "Platform owner’s Drive connected." : "Google Drive is not connected on this host."} {!data?.hostReady && "Full archive creation requires the Railway deployment."}</p>
      <div className="flex flex-wrap items-center gap-4">
        <label className="flex items-center gap-2 text-sm"><Switch checked={enabled} disabled={blocked} onCheckedChange={(value) => change({ enabled: value })} />Automatic backups</label>
        <label className="flex items-center gap-2 text-sm">Every<select aria-label="Backup interval" value={intervalHours} disabled={blocked} onChange={(e) => change({ intervalHours: Number(e.target.value) as 6 | 12 | 24 })} className="rounded-md border bg-background px-3 py-2"><option value={6}>6 hours</option><option value={12}>12 hours</option><option value={24}>24 hours</option></select></label>
        <Button variant="outline" disabled={blocked || !draft} onClick={() => act("save")}><Save className="mr-2 h-4 w-4" />Save schedule</Button>
        <Button disabled={blocked} onClick={() => act("run")}><CloudUpload className="mr-2 h-4 w-4" />Save backup now</Button>
      </div>
      <dl className="grid gap-2 text-sm sm:grid-cols-2"><div><dt className="text-muted-foreground">Status</dt><dd className="break-words">{data?.status.replaceAll("_", " ")}</dd></div><div><dt className="text-muted-foreground">Last confirmed upload</dt><dd>{data?.lastSuccessAt ? new Date(data.lastSuccessAt).toLocaleString() : "Not uploaded yet"}</dd></div></dl>
      {data?.lastError && <p role="alert" className="text-sm text-destructive">{data.lastError}</p>}
      {data?.lastFileName && <p className="break-all text-sm">{data.lastFileName}</p>}
      {data?.folderId && <a className="text-sm text-primary underline" href={`https://drive.google.com/drive/folders/${encodeURIComponent(data.folderId)}`} target="_blank" rel="noreferrer">Open private backup folder</a>}
    </>}
    <p className="text-xs text-muted-foreground">Private .dump archives; uploaded files, hosting secrets and provider settings are excluded. Archive readability and uploaded size are checked, not a full restore. Backups are retained until you delete them in Drive.</p>
  </section>;
}