import { WorkspaceFeatureGate } from "@/components/app/WorkspaceFeatureGate";
import { Pager, pageSlice } from "@/components/app/Pager";
import { PlatformAccountFilter } from "@/components/app/PlatformAccountFilter";
import { csvCell } from "@/lib/csv-safe";
import { contactLabel } from "@/lib/contact-name";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Copy, Download, Inbox, ShieldCheck, RefreshCw } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { AppShell } from "@/components/app/AppShell";
import { GuideButton } from "@/components/app/GuideButton";
import { EmptyState, PageHeader, Panel, PlatformBadge } from "@/components/app/primitives";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { useTenant } from "@/hooks/useTenant";
import { sendReply } from "@/lib/inbox.functions";
import type { SocialPlatform } from "@/lib/social";
import { listTeam } from "@/lib/team.functions";
import { canReview, matchesAssignment, summarizeInvoices, mustRequestApproval, type AssignmentFilter } from "@/lib/team-desk";
import {
  assignConversation, createApiKey, createClientInvoice, listClientInvoices, setClientInvoiceStatus, createWebhook, getClientReports, getTeamDesk, listIntegrations,
  requestApproval, reviewApproval, revokeApiKey, saveTeamSettings, updateWebhook,
} from "@/lib/team-desk.functions";

export const Route = createFileRoute("/_authenticated/team-desk")({
  head: () => ({
    meta: [
      { title: "Team desk — AutoDM by Techaasvik" },
      { name: "description", content: "Shared inbox with assignment, reply approvals, client reports, public API and outgoing webhooks." },
      { property: "og:title", content: "Team desk — AutoDM by Techaasvik" },
      { property: "og:description", content: "Team and agency tools for Instagram and Facebook DMs." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => <WorkspaceFeatureGate feature="team_desk"><TeamDeskPage /></WorkspaceFeatureGate>,
});

const sel = "h-9 rounded-md border border-input bg-background px-2 text-sm";
const errMsg = (e: unknown) => {
  const m = (e as Error).message;
  if (m === "approval_required") return "Your workspace needs approval — use Send for approval.";
  return m;
};

function TeamDeskPage() {
  const { activeOrg } = useTenant();
  const orgId = activeOrg?.id ?? null;
  const fetchDesk = useServerFn(getTeamDesk);
  const fetchTeam = useServerFn(listTeam);
  const [accountId, setAccountId] = useState("all");
  const [platform, setPlatform] = useState<"all" | "instagram" | "facebook" | "youtube">("all");
  const desk = useQuery({ queryKey: ["team-desk", orgId, accountId, platform], enabled: !!orgId, refetchInterval: 30_000, queryFn: () => fetchDesk({ data: { organizationId: orgId!, ...(accountId !== "all" ? { socialAccountId: accountId } : {}), ...(platform !== "all" ? { platform } : {}) } }) });
  const team = useQuery({ queryKey: ["team", orgId], enabled: !!orgId, queryFn: () => fetchTeam({ data: { organizationId: orgId! } }) });
  const names = useMemo(() => Object.fromEntries((team.data ?? []).map((m) => [m.user_id, m.name || m.email])), [team.data]);
  const reviewer = canReview(desk.data?.role);
  const pending = (desk.data?.approvals ?? []).filter((a) => a.status === "pending").length;

  return (
    <AppShell>
      <PageHeader title="Team desk" description="Shared inbox, approvals, client reports and integrations for teams and agencies." actions={<div className="flex flex-wrap items-center gap-2"><PlatformAccountFilter orgId={orgId ?? null} platform={platform} onPlatformChange={setPlatform} accountId={accountId} onAccountChange={setAccountId} /><Button variant="outline" size="icon" aria-label="Refresh Team Desk" disabled={desk.isFetching || team.isFetching} onClick={() => { void desk.refetch(); void team.refetch(); }}><RefreshCw className="size-4" /></Button><GuideButton guide="team-desk" /></div>} />
      {(desk.isError || team.isError) && <p role="alert" className="mb-4 text-sm text-destructive">Team Desk or teammate details could not be refreshed. Previously loaded results may be out of date.</p>}
      {!orgId || !desk.data ? (
        <p role="status" className="text-sm text-muted-foreground">{desk.isError ? "Team Desk unavailable. Refresh to retry." : "Loading Team Desk…"}</p>
      ) : (
        <Tabs key={orgId} defaultValue="inbox">
          <TabsList className="h-auto max-w-full flex-wrap">
            <TabsTrigger value="inbox">Shared inbox</TabsTrigger>
            <TabsTrigger value="approvals">Approvals{pending ? ` (${pending})` : ""}</TabsTrigger>
            <TabsTrigger value="reports">Client reports</TabsTrigger>
            {reviewer && <TabsTrigger value="api">API & webhooks</TabsTrigger>}
          </TabsList>
          <TabsContent value="inbox">{team.data ? <SharedInbox key={`${orgId}:${platform}:${accountId}`} orgId={orgId} desk={{ ...desk.data, conversations: desk.data.conversations.filter((c) => platform === "all" || c.platform === platform) }} names={names} members={team.data} /> : <p role="status" className="text-sm text-muted-foreground">{team.isError ? "Teammate details unavailable. Refresh to retry." : "Loading teammate details…"}</p>}</TabsContent>
          <TabsContent value="approvals"><Approvals orgId={orgId} desk={desk.data} names={names} reviewer={reviewer} /></TabsContent>
          <TabsContent value="reports"><Reports />{reviewer && <ClientBilling orgId={orgId} />}</TabsContent>
          {reviewer && <TabsContent value="api"><Integrations orgId={orgId} /></TabsContent>}
        </Tabs>
      )}
    </AppShell>
  );
}

type Desk = Awaited<ReturnType<typeof getTeamDesk>>;

function SharedInbox({ orgId, desk, names, members }: { orgId: string; desk: Desk; names: Record<string, string>; members: { user_id: string; name: string; email: string; role: string }[] }) {
  const qc = useQueryClient();
  const [filter, setFilter] = useState<AssignmentFilter>("all");
  const [openId, setOpenId] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [text, setText] = useState("");
  const assign = useServerFn(assignConversation);
  const send = useServerFn(sendReply);
  const ask = useServerFn(requestApproval);
  const saveSettings = useServerFn(saveTeamSettings);
  const refresh = () => qc.invalidateQueries({ queryKey: ["team-desk", orgId] });
  const needApproval = mustRequestApproval(desk.role, desk.requireApproval);

  const assignM = useMutation({ mutationFn: (v: { conversationId: string; assignedTo: string | null }) => assign({ data: { organizationId: orgId, ...v } }), onSuccess: refresh, onError: (e) => toast.error(errMsg(e)) });
  const replyM = useMutation({
    mutationFn: async (conversationId: string) =>
      needApproval ? ask({ data: { organizationId: orgId, conversationId, body: text } }) : send({ data: { conversationId, body: text } }),
    onSuccess: () => { toast.success(needApproval ? "Sent for approval" : "Reply sent"); setText(""); refresh(); },
    onError: (e) => toast.error(errMsg(e)),
  });
  const settingsM = useMutation({ mutationFn: (v: boolean) => saveSettings({ data: { organizationId: orgId, requireApproval: v } }), onSuccess: refresh, onError: (e) => toast.error(errMsg(e)) });

  const rows = desk.conversations.filter((c) => matchesAssignment(desk.assignment[c.id], filter, desk.me));
  const canWrite = desk.role !== "viewer";

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <select className={sel} value={filter} onChange={(e) => setFilter(e.target.value as AssignmentFilter)}>
          <option value="all">All chats</option>
          <option value="mine">Assigned to me</option>
          <option value="unassigned">Unassigned</option>
        </select>
        {canReview(desk.role) && (
          <label className="flex items-center gap-2 text-sm">
            <Switch checked={desk.requireApproval} onCheckedChange={(v) => settingsM.mutate(v)} /> Agents need approval before sending
          </label>
        )}
        {needApproval && <span className="text-xs text-muted-foreground">Your replies go to a manager for approval.</span>}
      </div>
      <Panel bodyClassName="p-0">
        {!rows.length ? (
          <EmptyState icon={Inbox} title="No conversations here" description="Change the filter or wait for new messages." />
        ) : (
          <ul className="divide-y divide-border">
            {pageSlice(rows, page, 10).map((c) => (
              <li key={c.id} className="p-3">
                <div className="grid min-w-0 grid-cols-[auto_minmax(0,1fr)] items-center gap-3 sm:flex">
                  <PlatformBadge platform={c.platform as SocialPlatform} size="sm" />
                  <button className="min-w-0 flex-1 text-left" onClick={() => setOpenId(openId === c.id ? null : c.id)}>
                    <div className="truncate text-sm font-medium">{contactLabel(c)} <span className="text-xs text-muted-foreground">· {c.channel}</span></div>
                    <div className="truncate text-xs text-muted-foreground">{c.last_message_preview}</div>
                  </button>
                  <select
                    className={`${sel} col-span-2 w-full sm:w-auto`}
                    disabled={!canWrite}
                    value={desk.assignment[c.id] ?? ""}
                    onChange={(e) => assignM.mutate({ conversationId: c.id, assignedTo: e.target.value || null })}
                    aria-label="Assign to"
                  >
                    <option value="">Unassigned</option>
                    {members.map((m) => <option key={m.user_id} value={m.user_id}>{m.name || m.email}</option>)}
                  </select>
                </div>
                {openId === c.id && canWrite && c.channel === "dm" && (
                  <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                    <Textarea value={text} onChange={(e) => setText(e.target.value)} placeholder="Write a reply…" maxLength={1000} className="min-h-[60px]" />
                    <Button disabled={!text.trim() || replyM.isPending} onClick={() => replyM.mutate(c.id)}>
                      {needApproval ? "Send for approval" : "Send"}
                    </Button>
                  </div>
                )}
                {openId === c.id && desk.assignment[c.id] && (
                  <p className="mt-2 text-xs text-muted-foreground">Assigned to {names[desk.assignment[c.id]!] ?? "teammate"}</p>
                )}
              </li>
            ))}
          </ul>
        )}
        <div className="border-t px-3 pb-3"><Pager page={page} total={rows.length} perPage={10} onPage={setPage} /></div>
      </Panel>
    </div>
  );
}

function Approvals({ orgId, desk, names, reviewer }: { orgId: string; desk: Desk; names: Record<string, string>; reviewer: boolean }) {
  const qc = useQueryClient();
  const review = useServerFn(reviewApproval);
  const send = useServerFn(sendReply);
  const conv = Object.fromEntries(desk.conversations.map((c) => [c.id, c]));
  const m = useMutation({
    mutationFn: async (v: { id: string; conversationId: string; body: string; decision: "approved" | "rejected" }) => {
      if (v.decision === "approved") await send({ data: { conversationId: v.conversationId, body: v.body } });
      const note = v.decision === "rejected" ? window.prompt("Reason (optional)") ?? undefined : undefined;
      await review({ data: { organizationId: orgId, id: v.id, decision: v.decision, note } });
    },
    onSuccess: () => { toast.success("Done"); qc.invalidateQueries({ queryKey: ["team-desk", orgId] }); },
    onError: (e) => toast.error(errMsg(e)),
  });
  if (!desk.approvals.length) return <EmptyState icon={ShieldCheck} title="No approval requests" description="When agents need approval, their replies appear here." />;
  return (
    <Panel bodyClassName="p-0">
      <ul className="divide-y divide-border">
        {desk.approvals.map((a) => (
          <li key={a.id} className="space-y-2 p-3">
            <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <span className="font-medium text-foreground">{names[a.requested_by] ?? "Teammate"}</span>
              → {conv[a.conversation_id] ? contactLabel(conv[a.conversation_id]!) : "contact"} · {new Date(a.created_at).toLocaleString()}
              <span className="rounded bg-muted px-1.5 py-0.5 capitalize">{a.status}</span>
              {a.note && <span>· “{a.note}”</span>}
            </div>
            <p className="whitespace-pre-wrap break-words text-sm">{a.body}</p>
            {reviewer && a.status === "pending" && (
              <div className="flex gap-2">
                <Button size="sm" disabled={m.isPending} onClick={() => m.mutate({ id: a.id, conversationId: a.conversation_id, body: a.body, decision: "approved" })}>Approve & send</Button>
                <Button size="sm" variant="outline" disabled={m.isPending} onClick={() => m.mutate({ id: a.id, conversationId: a.conversation_id, body: a.body, decision: "rejected" })}>Reject</Button>
              </div>
            )}
          </li>
        ))}
      </ul>
    </Panel>
  );
}

function Reports() {
  const [days, setDays] = useState(30);
  const fetchReports = useServerFn(getClientReports);
  const q = useQuery({ queryKey: ["client-reports", days], queryFn: () => fetchReports({ data: { days } }) });
  const csv = () => {
    const head = "workspace,type,plan,plan_expires,messages_in,replies_out,automation_runs,active_chats";
    const lines = (q.data ?? []).map((r) => [r.name, r.isClient ? "client" : "own", r.plan, r.planExpiresAt ?? "", r.inbound, r.outbound, r.runs, r.conversations].map(csvCell).join(","));
    const url = URL.createObjectURL(new Blob([[head, ...lines].join("\n")], { type: "text/csv" }));
    const a = document.createElement("a"); a.href = url; a.download = `client-report-${days}d.csv`; a.click(); URL.revokeObjectURL(url);
  };
  return (
    <Panel
      title="Workspaces you manage"
      action={
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="outline" aria-label="Refresh client reports" disabled={q.isFetching} onClick={() => void q.refetch()}><RefreshCw className="size-4" /></Button>
          <select className={sel} value={days} onChange={(e) => setDays(Number(e.target.value))}>
            <option value={7}>Last 7 days</option><option value={30}>Last 30 days</option><option value={90}>Last 90 days</option>
          </select>
          <Button size="sm" variant="outline" onClick={csv} disabled={!q.data?.length}><Download className="mr-1 h-4 w-4" />Download CSV</Button>
        </div>
      }
    >
      {q.isError && <p role="alert" className="mb-3 text-sm text-destructive">Client reports could not be refreshed. Previously loaded results may be out of date.</p>}
      {!q.data ? <p role="status" className="text-sm text-muted-foreground">{q.isError ? "Client reports unavailable. Refresh to retry." : "Loading client reports…"}</p> : q.data.length === 0 ? <p className="text-sm text-muted-foreground">No managed workspaces in this report.</p> : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-xs text-muted-foreground"><tr><th className="py-2">Workspace</th><th>Plan</th><th>Messages in</th><th>Replies out</th><th>Automation runs</th><th>Active chats</th></tr></thead>
            <tbody>
              {(q.data ?? []).map((r) => (
                <tr key={r.id} className="border-t border-border">
                  <td className="py-2 font-medium">{r.name} {r.isClient && <span className="text-xs text-muted-foreground">(client)</span>}</td>
                  <td className="capitalize">{r.plan}{r.planExpiresAt ? <span className="block text-xs text-muted-foreground">till {new Date(r.planExpiresAt).toLocaleDateString()}</span> : null}</td>
                  <td>{r.inbound}</td><td>{r.outbound}</td><td>{r.runs}</td><td>{r.conversations}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Panel>
  );
}

function ClientBilling({ orgId }: { orgId: string }) {
  const qc = useQueryClient();
  const fetchList = useServerFn(listClientInvoices);
  const fetchReports = useServerFn(getClientReports);
  const create = useServerFn(createClientInvoice);
  const setStatus = useServerFn(setClientInvoiceStatus);
  const list = useQuery({ queryKey: ["client-invoices", orgId], queryFn: () => fetchList({ data: { organizationId: orgId } }) });
  const ws = useQuery({ queryKey: ["client-reports", 30], queryFn: () => fetchReports({ data: { days: 30 } }) });
  const clients = (ws.data ?? []).filter((w) => w.id !== orgId);
  const nameOf = (id: string) => (ws.data ?? []).find((w) => w.id === id)?.name ?? "Workspace";
  const [form, setForm] = useState({ client: "", period: new Date().toLocaleDateString("en-IN", { month: "long", year: "numeric" }), amount: "", link: "", notes: "" });
  const refresh = () => qc.invalidateQueries({ queryKey: ["client-invoices", orgId] });
  const add = useMutation({
    mutationFn: () => create({ data: { organizationId: orgId, clientOrganizationId: form.client, periodLabel: form.period, amountInr: Number(form.amount), paymentUrl: form.link, notes: form.notes } }),
    onSuccess: () => { toast.success("Invoice added"); setForm((f) => ({ ...f, amount: "", link: "", notes: "" })); refresh(); },
    onError: (e) => toast.error(errMsg(e)),
  });
  const mark = useMutation({ mutationFn: (v: { id: string; status: "unpaid" | "paid" | "void" }) => setStatus({ data: { organizationId: orgId, ...v } }), onSuccess: refresh, onError: (e) => toast.error(errMsg(e)) });
  const rows = list.data ?? [];
  const sum = summarizeInvoices(rows as { amount_inr: number; status: "unpaid" | "paid" | "void" }[]);
  const csv = () => {
    const head = "client,period,amount_inr,status,paid_at,payment_link,notes";
    const lines = rows.map((r) => [nameOf(r.client_organization_id), r.period_label, r.amount_inr, r.status, r.paid_at ?? "", r.payment_url ?? "", r.notes ?? ""].map(csvCell).join(","));
    const url = URL.createObjectURL(new Blob([[head, ...lines].join("\n")], { type: "text/csv" }));
    const a = document.createElement("a"); a.href = url; a.download = "client-invoices.csv"; a.click(); URL.revokeObjectURL(url);
  };
  return (
    <div className="mt-4">
      <Panel title="Client billing" action={<div className="flex flex-wrap gap-2"><Button size="sm" variant="outline" aria-label="Refresh client billing" disabled={list.isFetching || ws.isFetching} onClick={() => { void list.refetch(); void ws.refetch(); }}><RefreshCw className="size-4" /></Button><Button size="sm" variant="outline" onClick={csv} disabled={!rows.length || !ws.data}><Download className="mr-1 h-4 w-4" />Invoices CSV</Button></div>}>
        {(list.isError || ws.isError) && <p role="alert" className="mb-3 text-sm text-destructive">Invoice or client details could not be refreshed. Previously loaded results may be out of date.</p>}
        <p className="mb-3 text-sm text-muted-foreground">Recorded invoices: due <b>{list.data ? `₹${sum.due}` : "—"}</b> · marked paid <b>{list.data ? `₹${sum.paid}` : "—"}</b>. Paid status is manually recorded, not a verified payment settlement.</p>
        {!ws.data ? <p role="status" className="text-sm text-muted-foreground">{ws.isError ? "Client workspaces unavailable." : "Loading client workspaces…"}</p> : clients.length === 0 ? <p className="text-sm text-muted-foreground">No client workspaces yet. Create or join a client workspace to bill it.</p> : (
          <div className="mb-4 grid gap-2 md:grid-cols-6">
            <select className={sel + " md:col-span-2"} value={form.client} onChange={(e) => setForm({ ...form, client: e.target.value })}>
              <option value="">Choose client…</option>
              {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <Input placeholder="Period (e.g. October 2026)" value={form.period} onChange={(e) => setForm({ ...form, period: e.target.value })} />
            <Input type="number" min={1} placeholder="Amount ₹" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} />
            <Input placeholder="https://payment-link (optional)" value={form.link} onChange={(e) => setForm({ ...form, link: e.target.value })} />
            <Button disabled={!form.client || !(Number(form.amount) > 0) || add.isPending} onClick={() => add.mutate()}>Add invoice</Button>
            <Input className="md:col-span-6" placeholder="Note (optional)" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          </div>
        )}
        {!list.data ? <p role="status" className="text-sm text-muted-foreground">{list.isError ? "Invoices unavailable. Refresh to retry." : "Loading invoices…"}</p> : rows.length === 0 ? <p className="text-sm text-muted-foreground">No invoices yet.</p> : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-xs text-muted-foreground"><tr><th className="py-2">Client</th><th>Period</th><th>Amount</th><th>Status</th><th></th></tr></thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className="border-t border-border">
                    <td className="py-2 font-medium">{nameOf(r.client_organization_id)}{r.notes ? <span className="block text-xs text-muted-foreground">{r.notes}</span> : null}</td>
                    <td>{r.period_label}</td>
                    <td>₹{Number(r.amount_inr)}</td>
                    <td className="capitalize">{r.status}{r.paid_at ? <span className="block text-xs text-muted-foreground">{new Date(r.paid_at).toLocaleDateString()}</span> : null}</td>
                    <td className="space-x-1 text-right">
                      {r.payment_url && <Button size="sm" variant="ghost" onClick={() => { navigator.clipboard.writeText(r.payment_url!); toast.success("Payment link copied"); }}><Copy className="h-4 w-4" /></Button>}
                      {r.status !== "paid" && <Button size="sm" variant="outline" onClick={() => mark.mutate({ id: r.id, status: "paid" })}>Mark paid</Button>}
                      {r.status === "paid" && <Button size="sm" variant="ghost" onClick={() => mark.mutate({ id: r.id, status: "unpaid" })}>Undo</Button>}
                      {r.status === "unpaid" && <Button size="sm" variant="ghost" onClick={() => mark.mutate({ id: r.id, status: "void" })}>Cancel</Button>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </div>
  );
}

function Integrations({ orgId }: { orgId: string }) {
  const qc = useQueryClient();
  const fetchI = useServerFn(listIntegrations);
  const mkKey = useServerFn(createApiKey);
  const rmKey = useServerFn(revokeApiKey);
  const mkHook = useServerFn(createWebhook);
  const upHook = useServerFn(updateWebhook);
  const q = useQuery({ queryKey: ["integrations", orgId], queryFn: () => fetchI({ data: { organizationId: orgId } }) });
  const refresh = () => qc.invalidateQueries({ queryKey: ["integrations", orgId] });
  const [keyName, setKeyName] = useState("");
  const [hookUrl, setHookUrl] = useState("");
  const [outbound, setOutbound] = useState(false);
  const [shown, setShown] = useState<string | null>(null);
  const run = (p: Promise<unknown>, ok?: (r: any) => void) => p.then((r) => { ok?.(r); refresh(); }).catch((e) => toast.error(errMsg(e)));
  const base = typeof window !== "undefined" ? window.location.origin : "";

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <div className="flex flex-wrap items-center gap-3 lg:col-span-2"><Button size="sm" variant="outline" disabled={q.isFetching} onClick={() => void q.refetch()}><RefreshCw className="size-4" /> Refresh integrations</Button>{q.isError && <p role="alert" className="text-sm text-destructive">Integrations could not be refreshed. Previously loaded results may be out of date.</p>}{!q.data && <p role="status" className="text-sm text-muted-foreground">{q.isError ? "Integrations unavailable." : "Loading integrations…"}</p>}</div>
      {shown && (
        <div className="rounded-md border border-primary bg-primary/5 p-3 text-sm lg:col-span-2">
          Copy this now — it will not be shown again:
          <div className="mt-2 flex items-center gap-2"><code className="break-all font-mono text-xs">{shown}</code>
            <Button size="sm" variant="outline" onClick={() => { navigator.clipboard.writeText(shown); toast.success("Copied"); }}><Copy className="h-4 w-4" /></Button>
            <Button size="sm" variant="ghost" onClick={() => setShown(null)}>Done</Button>
          </div>
        </div>
      )}
      <Panel title="API keys">
        <p className="mb-3 text-xs text-muted-foreground">Read conversations, messages and contacts from your own tools. Send the key in the <code>X-API-Key</code> header to <code className="break-all">{base}/api/public/v1/conversations</code></p>
        <div className="mb-3 flex gap-2">
          <Input placeholder="Key name, e.g. Zapier" value={keyName} onChange={(e) => setKeyName(e.target.value)} />
          <Button disabled={!keyName.trim()} onClick={() => run(mkKey({ data: { organizationId: orgId, name: keyName } }), (r) => { setShown(r.key); setKeyName(""); })}>Create</Button>
        </div>
        <ul className="space-y-2 text-sm">
          {(q.data?.keys ?? []).map((k) => (
            <li key={k.id} className="flex items-center justify-between gap-2 rounded border border-border p-2">
              <div className="min-w-0 break-words"><div className="font-medium">{k.name}</div><div className="font-mono text-xs text-muted-foreground">{k.prefix}… · {k.revoked_at ? "revoked" : k.last_used_at ? `used ${new Date(k.last_used_at).toLocaleString()}` : "never used"}</div></div>
              {!k.revoked_at && <Button size="sm" variant="outline" onClick={() => run(rmKey({ data: { organizationId: orgId, id: k.id } }))}>Revoke</Button>}
            </li>
          ))}
        </ul>
      </Panel>
      <Panel title="Outgoing webhooks">
        <p className="mb-3 text-xs text-muted-foreground">New messages are sent to your address every minute, signed with <code>X-AutoDM-Signature</code>.</p>
        <div className="mb-2 flex gap-2">
          <Input placeholder="https://hooks.zapier.com/..." value={hookUrl} onChange={(e) => setHookUrl(e.target.value)} />
          <Button disabled={!hookUrl.startsWith("https://")} onClick={() => run(mkHook({ data: { organizationId: orgId, url: hookUrl, events: outbound ? ["message.received", "message.sent"] : ["message.received"] } }), (r) => { setShown(r.secret); setHookUrl(""); })}>Add</Button>
        </div>
        <label className="mb-3 flex items-center gap-2 text-xs"><Switch checked={outbound} onCheckedChange={setOutbound} /> Also send our replies (message.sent)</label>
        <ul className="space-y-2 text-sm">
          {(q.data?.hooks ?? []).map((h) => (
            <li key={h.id} className="space-y-1 rounded border border-border p-2">
              <div className="flex items-center justify-between gap-2">
                <span className="truncate font-mono text-xs">{h.url}</span>
                <div className="flex items-center gap-2">
                  <Switch checked={h.enabled} onCheckedChange={(v) => run(upHook({ data: { organizationId: orgId, id: h.id, enabled: v } }))} />
                  <Button size="sm" variant="ghost" onClick={() => run(upHook({ data: { organizationId: orgId, id: h.id, remove: true } }))}>Delete</Button>
                </div>
              </div>
              <div className="text-xs text-muted-foreground">{h.events.join(", ")} · {h.last_sent_at ? `last ${h.last_error ? `failed (${h.last_error})` : "OK"} ${new Date(h.last_sent_at).toLocaleString()}` : "nothing sent yet"}</div>
            </li>
          ))}
        </ul>
      </Panel>
    </div>
  );
}
