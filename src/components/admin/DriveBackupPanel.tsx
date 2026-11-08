import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { CloudUpload, Link2, Link2Off, RefreshCw, Save } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { connectDrive, disconnectDriveFn, getDriveBackup, updateDriveBackup } from "@/lib/drive-backup.functions";

export function DriveBackupPanel() {
  const get = useServerFn(getDriveBackup);
  const update = useServerFn(updateDriveBackup);
  const query = useQuery({ queryKey: ["admin-drive-backup"], queryFn: () => get(), refetchInterval: 15000 });
  const [draft, setDraft] = useState<{ enabled: boolean; intervalHours: 6 | 12 | 24 } | null>(null);
  const [busy, setBusy] = useState(false);
  const connect = useServerFn(connectDrive);
  const disconnect = useServerFn(disconnectDriveFn);
  useEffect(() => {
    const result = new URLSearchParams(window.location.search).get("drive");
    if (!result) return;
    const messages: Record<string, string> = { ok: "Google Drive connected", cancelled: "Drive connection cancelled", expired: "Connection link expired. Try again.", scope: "Drive permission was not granted. Allow access and try again.", config: "Google sign-in or encryption key missing on this host.", exchange: "Google rejected the connection. Check the redirect address in Google Cloud.", state: "Connection link invalid. Start again from this page.", store: "Drive connection could not be saved." };
    (result === "ok" ? toast.success : toast.error)(messages[result] ?? "Drive connection failed");
    window.history.replaceState(null, "", window.location.pathname);
  }, []);
  const startConnect = async () => {
    setBusy(true);
    try { const { url } = await connect(); window.location.assign(url); }
    catch (e) { toast.error(e instanceof Error ? e.message : "Drive connection failed"); setBusy(false); }
  };
  const stopConnect = async () => {
    if (!window.confirm("Disconnect Google Drive? Existing backup files stay in Drive.")) return;
    setBusy(true);
    try { await disconnect(); await query.refetch(); toast.success("Google Drive disconnected"); }
    catch (e) { toast.error(e instanceof Error ? e.message : "Disconnect failed"); }
    finally { setBusy(false); }
  };
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
      <div className="flex flex-wrap items-center gap-3">
        <p className="text-sm text-muted-foreground">{data?.directConnected ? `Connected to ${data.accountEmail ?? "Google Drive"}.` : data?.connected ? "Linked Drive connection in use." : "Google Drive is not connected."} {!data?.hostReady && "Full archive creation requires the Railway deployment."}</p>
        {data?.directConnected
          ? <Button variant="outline" size="sm" disabled={busy} onClick={stopConnect}><Link2Off className="mr-2 h-4 w-4" />Disconnect Drive</Button>
          : <Button size="sm" disabled={busy || !data?.connectReady} onClick={startConnect}><Link2 className="mr-2 h-4 w-4" />Connect Google Drive</Button>}
      </div>
      {!data?.directConnected && !data?.connectReady && <p className="text-xs text-muted-foreground">Connect needs Google sign-in credentials and the latest database update on this host.</p>}
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