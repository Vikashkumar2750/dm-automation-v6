import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Panel } from "@/components/app/primitives";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getSafetyCaps, saveSafetyCaps } from "@/lib/account-safety.functions";

/** Super Admin: highest safety values users may set (global when orgId is null, or for one workspace). */
export function AdminSafetyCapsPanel({ orgId }: { orgId: string | null }) {
  const qc = useQueryClient();
  const fetchIt = useServerFn(getSafetyCaps);
  const save = useServerFn(saveSafetyCaps);
  const q = useQuery({ queryKey: ["safety-caps", orgId], queryFn: () => fetchIt({ data: { organizationId: orgId } }) });
  const [f, setF] = useState({ hourly: "", daily: "", perContact: "" });
  useEffect(() => {
    if (!q.data) return;
    const v = q.data.own ?? q.data.effective;
    setF({ hourly: String(v.hourly ?? ""), daily: String(v.daily ?? ""), perContact: String(v.perContact ?? "") });
  }, [q.data]);
  const m = useMutation({
    mutationFn: (clear: boolean) => save({ data: { organizationId: orgId, caps: clear ? null : { hourly: Number(f.hourly), daily: Number(f.daily), perContact: Number(f.perContact) } } }),
    onSuccess: () => { toast.success("Max values saved"); void qc.invalidateQueries({ queryKey: ["safety-caps"] }); },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Couldn't save"),
  });
  const row = (k: keyof typeof f, label: string, max?: number) => (
    <label className="grid gap-1 text-xs">
      <span className="text-muted-foreground">{label}</span>
      <Input type="number" min={1} max={max} value={f[k]} onChange={(e) => setF({ ...f, [k]: e.target.value })} className="h-9" />
    </label>
  );
  return (
    <Panel title={orgId ? "Safety max values (this workspace)" : "Safety max values (all workspaces)"}>
      <p className="mb-3 text-xs text-muted-foreground">
        Users can set per-account limits only up to these values. {orgId ? "Leave as global to follow the platform setting." : "Workspace overrides take priority."} 200/hour is a hard stop.
      </p>
      <div className="grid gap-3 sm:grid-cols-3">
        {row("hourly", "DMs per hour per account", 200)}
        {row("daily", "DMs per day per account")}
        {row("perContact", "Journeys per contact per day")}
      </div>
      <div className="mt-3 flex gap-2">
        <Button size="sm" disabled={m.isPending || !q.data} onClick={() => m.mutate(false)}>Save</Button>
        {q.data?.own && <Button size="sm" variant="ghost" disabled={m.isPending} onClick={() => m.mutate(true)}>{orgId ? "Use global" : "Reset to defaults"}</Button>}
      </div>
    </Panel>
  );
}
