import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Panel, StatusBadge } from "@/components/app/primitives";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FEATURE_KEYS, FEATURE_OPTIONS } from "@/lib/workspace-features";
import { adminGetWorkspaceFeatures, adminSetWorkspaceFeatures, adminWorkspaceHealth } from "@/lib/workspace-features.functions";
import { formatInr } from "@/lib/revenue";

const DEFAULT = "__default";

/** Super Admin: switch features on/off/coming soon for one workspace. */
export function AdminWorkspaceFeaturesPanel({ orgId }: { orgId: string }) {
  const get = useServerFn(adminGetWorkspaceFeatures);
  const set = useServerFn(adminSetWorkspaceFeatures);
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["admin-ws-features", orgId], queryFn: () => get({ data: { orgId } }) });
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [cap, setCap] = useState("");
  useEffect(() => {
    if (!q.data) return;
    const o = q.data.overrides as Record<string, unknown>;
    setDraft(Object.fromEntries(FEATURE_KEYS.map((k) => [k, typeof o[k] === "string" ? (o[k] as string) : DEFAULT])));
    setCap(o["ai_monthly_cap"] != null ? String(o["ai_monthly_cap"]) : "");
  }, [q.data]);
  const save = useMutation({
    mutationFn: () => {
      const overrides: Record<string, unknown> = Object.fromEntries(Object.entries(draft).filter(([, v]) => v !== DEFAULT));
      if (cap.trim() !== "") overrides["ai_monthly_cap"] = Number(cap);
      return set({ data: { orgId, overrides } });
    },
    onSuccess: async () => { toast.success("Workspace features saved"); await qc.invalidateQueries({ queryKey: ["admin-ws-features", orgId] }); },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not save"),
  });
  const platform = q.data?.platform as Record<string, string> | undefined;
  return (
    <Panel title="Features & access" description="Switch sections for this workspace only. “Platform default” follows System Settings.">
      {!q.data ? <p className="text-sm text-muted-foreground">Loading…</p> : (
        <div className="space-y-4">
          <div className="grid gap-3 md:grid-cols-2">
            {FEATURE_KEYS.map((k) => {
              const meta = FEATURE_OPTIONS[k];
              const def = meta.options.find((o) => o.value === platform?.[k])?.label ?? "—";
              return (
                <div key={k} className="flex items-center justify-between gap-3 rounded-lg border border-border p-3">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold">{meta.label}</p>
                    <p className="text-xs text-muted-foreground">{meta.description}</p>
                  </div>
                  <Select value={draft[k] ?? DEFAULT} onValueChange={(v) => setDraft((d) => ({ ...d, [k]: v }))}>
                    <SelectTrigger className="h-9 w-[170px] shrink-0" aria-label={meta.label}><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value={DEFAULT}>Platform default ({def})</SelectItem>
                      {meta.options.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              );
            })}
          </div>
          <div className="flex flex-wrap items-end justify-between gap-3 rounded-lg border border-border p-3">
            <div>
              <p className="text-sm font-semibold">Monthly AI request cap</p>
              <p className="text-xs text-muted-foreground">Leave empty to use the plan limit.</p>
            </div>
            <Input type="number" min={0} className="h-9 w-40" value={cap} onChange={(e) => setCap(e.target.value)} placeholder="Plan default" />
          </div>
          <div className="flex justify-end"><Button onClick={() => save.mutate()} disabled={save.isPending}>{save.isPending ? "Saving…" : "Save features"}</Button></div>
        </div>
      )}
    </Panel>
  );
}

/** Super Admin: read-only health summary for one workspace. */
export function AdminWorkspaceHealthPanel({ orgId }: { orgId: string }) {
  const fetch = useServerFn(adminWorkspaceHealth);
  const q = useQuery({ queryKey: ["admin-ws-health", orgId], queryFn: () => fetch({ data: { orgId } }) });
  const h = q.data;
  return (
    <Panel title="Workspace health" description="Connections, leads, sales and recent failures. Message contents are never shown.">
      {!h ? <p className="text-sm text-muted-foreground">{q.error ? (q.error as Error).message : "Loading…"}</p> : (
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Item label="Razorpay" value={<StatusBadge tone={h.razorpayConnected ? "success" : "warning"}>{h.razorpayConnected ? "Connected" : "Not connected"}</StatusBadge>} />
            <Item label="WhatsApp OTP" value={<StatusBadge tone={h.whatsappOtpConnected ? "success" : "neutral"}>{h.whatsappOtpConnected ? "Connected" : "Not set up"}</StatusBadge>} />
            <Item label="Leads" value={`${h.leads.completed} completed · ${h.leads.dropped} dropped`} />
            <Item label="Paid orders" value={`${h.paidOrders} · ${formatInr(h.revenuePaise)}`} />
          </div>
          <div>
            <p className="mb-2 text-sm font-semibold">Last 10 failed automation runs</p>
            {h.recentErrors.length === 0 ? <p className="text-sm text-muted-foreground">No failures recorded.</p> : (
              <ul className="divide-y divide-border rounded-lg border border-border text-sm">
                {h.recentErrors.map((e) => <li key={e.id} className="flex flex-wrap justify-between gap-2 px-3 py-2"><span className="text-muted-foreground">{new Date(e.at).toLocaleString()}</span><span className="min-w-0 flex-1 truncate text-right">{e.error}</span></li>)}
              </ul>
            )}
          </div>
        </div>
      )}
    </Panel>
  );
}

function Item({ label, value }: { label: string; value: React.ReactNode }) {
  return <div className="rounded-lg border border-border p-3"><p className="text-xs text-muted-foreground">{label}</p><div className="mt-1 text-sm font-semibold">{value}</div></div>;
}
