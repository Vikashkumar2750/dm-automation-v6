import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, RefreshCw } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Panel, PlatformBadge } from "@/components/app/primitives";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getAccountSafety, saveAccountSafety } from "@/lib/account-safety.functions";
import type { SocialPlatform } from "@/lib/social";

const tone = (used: number, max: number) => (max > 0 && used >= max ? "text-destructive" : max > 0 && used >= max * 0.8 ? "text-warning" : "");

/** Per-account usage table; with `editable`, each row can set its own limits (up to the Super Admin max). */
export function AccountSafetyPanel({ orgId, editable = false, planLimit }: { orgId: string; editable?: boolean; planLimit?: number | null }) {
  const fetchIt = useServerFn(getAccountSafety);
  const q = useQuery({ queryKey: ["account-safety", orgId], queryFn: () => fetchIt({ data: { organizationId: orgId } }), refetchInterval: 60_000 });
  const d = q.data;
  return (
    <Panel title="Per account" bodyClassName="p-0" action={<Button variant="outline" size="icon" aria-label="Refresh per-account usage" disabled={q.isFetching} onClick={() => void q.refetch()}><RefreshCw className="size-4" /></Button>}>
      {q.isError && <p role="alert" className="px-5 pt-4 text-sm text-destructive">Per-account usage could not be refreshed. Previously loaded values may be out of date.</p>}
      {!d ? (
        <p className="p-5 text-sm text-muted-foreground">{q.isError ? "Couldn't load per-account usage." : "Loading…"}</p>
      ) : d.accounts.length === 0 ? (
        <p className="p-5 text-sm text-muted-foreground">No connected accounts yet.</p>
      ) : (
        <div className="min-w-0 max-w-full overflow-x-auto">
          <table className="w-full min-w-[640px] text-sm">
            <thead className="text-left text-xs text-muted-foreground">
              <tr className="border-b">
                <th className="px-4 py-2 font-medium">Account</th>
                <th className="px-4 py-2 font-medium">Runs this month</th>
                <th className="px-4 py-2 font-medium">Last hour</th>
                <th className="px-4 py-2 font-medium">Last 24 hours</th>
                {editable && <th className="px-4 py-2 font-medium">Limits</th>}
              </tr>
            </thead>
            <tbody className="divide-y">
              {d.accounts.map((a) => (
                <tr key={a.id}>
                  <td className="px-4 py-3"><div className="flex items-center gap-2"><PlatformBadge platform={a.platform as SocialPlatform} size="sm" /><span className="max-w-48 truncate" title={a.handle ?? a.name}>{a.handle ? `@${a.handle.replace(/^@/, "")}` : a.name}</span></div></td>
                  <td className="num px-4 py-3">{a.runsThisMonth}{planLimit ? <span className="text-muted-foreground"> · {Math.round((a.runsThisMonth / planLimit) * 100)}% of plan</span> : null}</td>
                  <td className={`num px-4 py-3 ${tone(a.sentThisHour, a.limits.hourly)}`}>{a.sentThisHour} / {a.limits.hourly}</td>
                  <td className={`num px-4 py-3 ${tone(a.sentToday, a.limits.daily)}`}>{a.sentToday} / {a.limits.daily}</td>
                  {editable && <td className="px-4 py-3"><LimitEditor orgId={orgId} account={a} caps={d.caps} workspace={d.workspace} /></td>}
                </tr>
              ))}
            </tbody>
          </table>
          <p className="px-4 py-3 text-xs text-muted-foreground">
            Each account has its own hourly and daily limits, so one busy account can't block the others. The monthly plan quota is shared by all accounts.
            {editable ? ` Max allowed: ${d.caps.hourly}/hour, ${d.caps.daily}/day, ${d.caps.perContact} journeys per contact per day.` : ""}
          </p>
        </div>
      )}
    </Panel>
  );
}

type Row = Awaited<ReturnType<typeof getAccountSafety>>["accounts"][number];

function LimitEditor({ orgId, account, caps, workspace }: { orgId: string; account: Row; caps: { hourly: number; daily: number; perContact: number }; workspace: { hourly: number; daily: number; perContact: number } }) {
  const qc = useQueryClient();
  const save = useServerFn(saveAccountSafety);
  const [h, setH] = useState(account.override?.hourly ? String(account.override.hourly) : "");
  const [dy, setDy] = useState(account.override?.daily ? String(account.override.daily) : "");
  const [pc, setPc] = useState(account.override?.perContact ? String(account.override.perContact) : "");
  const m = useMutation({
    mutationFn: (clear: boolean) => {
      const n = (v: string) => (v.trim() ? Number(v) : null);
      return save({ data: { organizationId: orgId, socialAccountId: account.id, override: clear ? null : { hourly: n(h), daily: n(dy), perContact: n(pc) } } });
    },
    onSuccess: (_r, clear) => { if (clear) { setH(""); setDy(""); setPc(""); } toast.success("Limits saved"); void qc.invalidateQueries({ queryKey: ["account-safety", orgId] }); },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Couldn't save"),
  });
  const field = (v: string, set: (s: string) => void, max: number, ph: number, label: string) => (
    <Input aria-label={label} title={`${label} · max ${max}`} type="number" min={1} max={max} value={v} placeholder={String(ph)} onChange={(e) => set(e.target.value)} className="h-8 w-20 text-xs" />
  );
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {field(h, setH, caps.hourly, workspace.hourly, "Per hour")}
      {field(dy, setDy, caps.daily, workspace.daily, "Per day")}
      {field(pc, setPc, caps.perContact, workspace.perContact, "Journeys per contact")}
      <Button size="sm" variant="outline" disabled={m.isPending} onClick={() => m.mutate(false)}>{m.isPending && m.variables === false ? <Loader2 className="size-3.5 animate-spin" /> : null}Save</Button>
      {account.override && <Button size="sm" variant="ghost" disabled={m.isPending} onClick={() => m.mutate(true)}>Use default</Button>}
    </div>
  );
}
