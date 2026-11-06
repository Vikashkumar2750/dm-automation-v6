import { PlatformAccountFilter, matchesPlatformAccount } from "@/components/app/PlatformAccountFilter";
import { contactLabel } from "@/lib/contact-name";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Download, Users, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { AppShell } from "@/components/app/AppShell";
import { GuideButton } from "@/components/app/GuideButton";
import { EmptyState, PageHeader, Panel, PlatformBadge, StatusBadge } from "@/components/app/primitives";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Sparkles } from "lucide-react";
import { useTenant } from "@/hooks/useTenant";
import { Pager, pageSlice } from "@/components/app/Pager";
import { contactsToCsv, pageLeadsToCsv, extractContactInfo, matchesSegment, type CrmContact, type SegmentFilter } from "@/lib/crm";
import { setLeadFollowUp, draftLeadFollowUps, sendLeadFollowUpEmail, addContactTag, deleteBroadcast, deleteSegment, getCrm, getOutreach, removeContactTag, saveContactProfile, saveNudgeSettings, saveSegment, saveSyncSettings, sendBroadcast } from "@/lib/crm.functions";
import { listConversations } from "@/lib/inbox.functions";

export const Route = createFileRoute("/_authenticated/contacts")({
  head: () => ({
    meta: [
      { title: "Contacts CRM — AutoDM by Techaasvik" },
      { name: "description", content: "Tags, custom fields, email/phone and saved segments for everyone who messaged or commented." },
      { property: "og:title", content: "Contacts CRM — AutoDM by Techaasvik" },
      { property: "og:description", content: "Organise Instagram and Facebook contacts with tags and segments." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ContactsPage,
});

const sel = "h-9 rounded-md border border-input bg-background px-2 text-sm";
type Row = CrmContact & { externalUserId: string; threads: number; unread: number; lastPreview: string | null; channels: Set<string> };

function ContactsPage() {
  const { activeOrg } = useTenant();
  const orgId = activeOrg?.id ?? null;
  const qc = useQueryClient();
  const [filter, setFilter] = useState<SegmentFilter>({});
  const [openKey, setOpenKey] = useState<string | null>(null);

  const fetchConversations = useServerFn(listConversations);
  const fetchCrm = useServerFn(getCrm);
  const addSeg = useServerFn(saveSegment);
  const delSeg = useServerFn(deleteSegment);
  const [accountId, setAccountId] = useState("all");
  const [platform, setPlatform] = useState<"all" | "instagram" | "facebook" | "youtube">("all");
  const conversations = useQuery({
    queryKey: ["conversations", orgId, "contacts", platform, accountId],
    enabled: !!orgId,
    refetchInterval: 60_000,
    queryFn: () => {
      if (!orgId) throw new Error("No workspace selected");
      return fetchConversations({ data: { organizationId: orgId, ...(platform !== "all" ? { platform } : {}), ...(accountId !== "all" ? { socialAccountId: accountId } : {}) } });
    },
  });
  const crm = useQuery({ queryKey: ["crm", orgId], enabled: !!orgId, queryFn: () => fetchCrm({ data: { organizationId: orgId! } }) });
  const refresh = () => qc.invalidateQueries({ queryKey: ["crm", orgId] });

  const contacts = useMemo(() => {
    const map = new Map<string, Row>();
    for (const c of (conversations.data ?? []).filter((c) => matchesPlatformAccount(c, platform, accountId))) {
      const key = `${c.platform}:${c.external_user_id}`;
      const e = map.get(key);
      if (e) {
        e.threads += 1; e.unread += c.unread_count; e.channels.add(c.channel);
        if (c.last_message_at > e.lastAt) { e.lastAt = c.last_message_at; e.lastPreview = c.last_message_preview; }
      } else {
        map.set(key, {
          key, externalUserId: c.external_user_id, name: contactLabel(c), platform: c.platform,
          threads: 1, unread: c.unread_count, lastAt: c.last_message_at, lastPreview: c.last_message_preview,
          channels: new Set([c.channel]), tags: [], email: null, phone: null,
        });
      }
    }
    for (const t of crm.data?.tags ?? []) {
      const r = map.get(`${t.platform}:${t.external_user_id}`);
      if (r && !r.tags.includes(t.tag)) r.tags.push(t.tag);
    }
    for (const p of crm.data?.profiles ?? []) {
      const r = map.get(`${p.platform}:${p.external_user_id}`);
      if (r) { r.email = p.email; r.phone = p.phone; }
    }
    return [...map.values()].sort((a, b) => (a.lastAt < b.lastAt ? 1 : -1));
  }, [conversations.data, crm.data, platform, accountId]);

  const allTags = useMemo(() => [...new Set(contacts.flatMap((c) => c.tags))].sort(), [contacts]);
  const visible = contacts.filter((c) => matchesSegment(c, filter));
  const [page, setPage] = useState(1);
  const filterKey = JSON.stringify(filter);
  useEffect(() => { setPage(1); setOpenKey(null); }, [filterKey, orgId, platform, accountId]);
  const open = contacts.find((c) => c.key === openKey) ?? null;

  const saveSeg = useMutation({
    mutationFn: (name: string) => addSeg({ data: { organizationId: orgId!, name, filter } }),
    onSuccess: () => { toast.success("Segment saved"); refresh(); },
    onError: () => toast.error("Could not save segment"),
  });

  function exportCsv() {
    const url = URL.createObjectURL(new Blob([contactsToCsv(visible)], { type: "text/csv" }));
    const a = document.createElement("a");
    a.href = url; a.download = "contacts.csv"; a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <AppShell>
      <PageHeader
        title="Contacts"
        description="Your CRM: tag people, store email/phone and custom fields, and save segments."
        actions={
          <div className="flex min-w-0 flex-wrap gap-2">
            <PlatformAccountFilter orgId={orgId ?? null} platform={platform} onPlatformChange={(p) => { setPlatform(p); setFilter((f) => ({ ...f, platform: undefined })); }} accountId={accountId} onAccountChange={setAccountId} />
            <GuideButton guide="contacts" />
            <Button variant="outline" onClick={exportCsv} disabled={visible.length === 0}><Download className="size-4" /> Export CSV</Button>
            <Button asChild variant="outline"><Link to="/inbox">Open inbox</Link></Button>
          </div>
        }
      />

      {(crm.data?.segments.length ?? 0) > 0 && (
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <span className="text-xs text-muted-foreground">Saved segments:</span>
          {crm.data!.segments.map((s) => (
            <span key={s.id} className="inline-flex items-center rounded-full border border-border text-sm">
              <button className="px-3 py-1 hover:text-primary" onClick={() => { const saved = s.filter as SegmentFilter; setFilter(saved); setPlatform(saved.platform ?? "all"); setAccountId("all"); }}>{s.name}</button>
              <button aria-label={`Delete ${s.name}`} className="pr-2 text-muted-foreground hover:text-destructive"
                onClick={() => delSeg({ data: { organizationId: orgId!, id: s.id } }).then(refresh)}><X className="size-3.5" /></button>
            </span>
          ))}
        </div>
      )}

      <Panel
        title={`People (${visible.length})`}
        action={
          <div className="flex flex-wrap gap-2">
            <Input placeholder="Search name or email" value={filter.search ?? ""} onChange={(e) => setFilter({ ...filter, search: e.target.value })} className="h-9 w-44" />
            <select className={sel} value={filter.tag ?? ""} onChange={(e) => setFilter({ ...filter, tag: e.target.value || undefined })}>
              <option value="">All tags</option>
              {allTags.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
            <select className={sel} value={filter.hasEmail ? "email" : filter.hasPhone ? "phone" : ""}
              onChange={(e) => setFilter({ ...filter, hasEmail: e.target.value === "email" || undefined, hasPhone: e.target.value === "phone" || undefined })}>
              <option value="">Any details</option>
              <option value="email">Has email</option>
              <option value="phone">Has phone</option>
            </select>
            <Button size="sm" variant="outline" disabled={!orgId || saveSeg.isPending}
              onClick={() => { const n = window.prompt("Segment name"); if (n?.trim()) saveSeg.mutate(n.trim()); }}>Save segment</Button>
          </div>
        }
      >
        {visible.length === 0 ? (
          <EmptyState icon={Users} title="No contacts here" description="People appear as soon as they message or comment. Try clearing filters." />
        ) : (
          <div className="space-y-2">
            {pageSlice(visible, page, 8).map((c) => (
              <button key={c.key} onClick={() => setOpenKey(c.key)} className="grid w-full min-w-0 grid-cols-[auto_minmax(0,1fr)] items-center gap-3 rounded-xl border px-4 py-3 text-left hover:bg-muted/50 sm:flex">
                <PlatformBadge platform={c.platform} size="sm" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{c.name}</p>
                  <p className="truncate text-xs text-muted-foreground">{c.email ?? c.lastPreview ?? "No preview"}</p>
                </div>
                <div className="col-span-2 flex flex-wrap items-center gap-2">
                  {c.tags.slice(0, 3).map((t) => <StatusBadge key={t} tone="info">{t}</StatusBadge>)}
                  {c.unread > 0 && <StatusBadge tone="warning">{c.unread} unread</StatusBadge>}
                  <StatusBadge tone="neutral">{[...c.channels].join(" + ")}</StatusBadge>
                  <span className="text-xs text-muted-foreground">{new Date(c.lastAt).toLocaleString()}</span>
                </div>
              </button>
            ))}
            <Pager page={page} total={visible.length} perPage={8} onPage={setPage} />
          </div>
        )}
      </Panel>

      {orgId && <OutreachPanel orgId={orgId} allTags={allTags} />}

      <Sheet open={!!open} onOpenChange={(v) => !v && setOpenKey(null)}>
        <SheetContent className="overflow-y-auto sm:max-w-md">
          {open && orgId && <ContactDetail key={open.key} orgId={orgId} contact={open} crm={crm.data} onSaved={refresh} />}
        </SheetContent>
      </Sheet>
    </AppShell>
  );
}

/** Nudges, broadcasts and webhook sync for this workspace. */
function OutreachPanel({ orgId, allTags }: { orgId: string; allTags: string[] }) {
  const qc = useQueryClient();
  const fetchOutreach = useServerFn(getOutreach);
  const saveNudge = useServerFn(saveNudgeSettings);
  const saveSync = useServerFn(saveSyncSettings);
  const sendBc = useServerFn(sendBroadcast);
  const delBc = useServerFn(deleteBroadcast);
  const outreach = useQuery({ queryKey: ["outreach", orgId], queryFn: () => fetchOutreach({ data: { organizationId: orgId } }) });
  const refresh = () => qc.invalidateQueries({ queryKey: ["outreach", orgId] });

  const [nudgeOn, setNudgeOn] = useState<boolean | null>(null);
  const [nudgeDelay, setNudgeDelay] = useState("120");
  const [nudgeText, setNudgeText] = useState("");
  const [syncOn, setSyncOn] = useState<boolean | null>(null);
  const [syncUrl, setSyncUrl] = useState("");
  const [bcName, setBcName] = useState("");
  const [bcMessage, setBcMessage] = useState("");
  const [bcBtnTitle, setBcBtnTitle] = useState("");
  const [bcBtnUrl, setBcBtnUrl] = useState("");
  const bcBtnHalf = !!bcBtnTitle.trim() !== !!bcBtnUrl.trim();
  const bcBtnBadUrl = !!bcBtnUrl.trim() && !/^https:\/\/\S+$/i.test(bcBtnUrl.trim());
  const [bcTag, setBcTag] = useState("");

  useEffect(() => {
    if (!outreach.data) return;
    if (nudgeOn === null) {
      setNudgeOn(outreach.data.nudge?.enabled ?? false);
      setNudgeDelay(String(outreach.data.nudge?.delay_minutes ?? 120));
      setNudgeText(outreach.data.nudge?.text ?? "Hi! Just checking in — can I help you with anything?");
    }
    if (syncOn === null) {
      setSyncOn(outreach.data.sync?.enabled ?? false);
      setSyncUrl(outreach.data.sync?.webhook_url ?? "");
    }
  }, [outreach.data, nudgeOn, syncOn]);

  const saveNudgeMut = useMutation({
    mutationFn: () => saveNudge({ data: { organizationId: orgId, enabled: nudgeOn ?? false, delayMinutes: Number(nudgeDelay) || 120, text: nudgeText.trim() } }),
    onSuccess: () => { toast.success("Nudge settings saved"); refresh(); },
    onError: () => toast.error("Could not save nudge settings"),
  });
  const saveSyncMut = useMutation({
    mutationFn: () => saveSync({ data: { organizationId: orgId, enabled: syncOn ?? false, webhookUrl: syncUrl.trim() || null } }),
    onSuccess: () => { toast.success("Sync settings saved"); refresh(); },
    onError: () => toast.error("Webhook address must start with https://"),
  });
  const sendMut = useMutation({
    mutationFn: () => sendBc({ data: { organizationId: orgId, name: bcName.trim(), message: bcMessage.trim(), filter: bcTag ? { tag: bcTag } : {},
      button: bcBtnTitle.trim() && bcBtnUrl.trim() ? { title: bcBtnTitle.trim(), url: bcBtnUrl.trim() } : null } }),
    onSuccess: (r) => { toast.success(`Broadcast sent to ${r.sent} of ${r.matched} people`); setBcName(""); setBcMessage(""); setBcBtnTitle(""); setBcBtnUrl(""); refresh(); },
    onError: () => toast.error("Could not send broadcast"),
  });

  return (
    <div className="mt-6 grid gap-4 lg:grid-cols-3">
      <div className="lg:col-span-3"><PageLeadsPanel orgId={orgId} /></div>

      <Panel title="Abandoned-conversation nudge" >
        <p className="mb-3 text-xs text-muted-foreground">
          If someone stops replying mid-conversation, send one gentle follow-up. Only inside Meta's 24-hour window, one nudge per conversation.
        </p>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={nudgeOn ?? false} onChange={(e) => setNudgeOn(e.target.checked)} /> Enabled
        </label>
        <div className="mt-3 grid gap-2">
          <Label>Wait before nudging (minutes)</Label>
          <Input type="number" min={15} max={1200} value={nudgeDelay} onChange={(e) => setNudgeDelay(e.target.value)} />
          <Label>Nudge message</Label>
          <textarea rows={2} maxLength={500} className="rounded-md border border-input bg-background px-3 py-2 text-sm" value={nudgeText} onChange={(e) => setNudgeText(e.target.value)} />
          <Button size="sm" onClick={() => saveNudgeMut.mutate()} disabled={saveNudgeMut.isPending || !nudgeText.trim()}>Save nudge</Button>
        </div>
      </Panel>

      <Panel title="Broadcast">
        <p className="mb-3 text-xs text-muted-foreground">
          Send one message to everyone (or one tag) who messaged you in the last 24 hours.
        </p>
        <div className="grid gap-2">
          <Input placeholder="Broadcast name" maxLength={80} value={bcName} onChange={(e) => setBcName(e.target.value)} />
          <textarea rows={2} maxLength={1000} placeholder="Message" className="rounded-md border border-input bg-background px-3 py-2 text-sm" value={bcMessage} onChange={(e) => setBcMessage(e.target.value)} />
          <div className="grid grid-cols-2 gap-2">
            <Input placeholder="Button text (optional)" maxLength={20} value={bcBtnTitle} onChange={(e) => setBcBtnTitle(e.target.value)} />
            <Input placeholder="https://your-link.com" maxLength={500} value={bcBtnUrl} onChange={(e) => setBcBtnUrl(e.target.value)} />
          </div>
          {(bcBtnHalf || bcBtnBadUrl) && (
            <p className="text-xs text-destructive">{bcBtnBadUrl ? "Link must start with https://" : "Fill both button text and link, or leave both empty."}</p>
          )}
          <select className={sel} value={bcTag} onChange={(e) => setBcTag(e.target.value)}>
            <option value="">Everyone in the 24h window</option>
            {allTags.map((t) => <option key={t} value={t}>Only tag: {t}</option>)}
          </select>
          <Button size="sm" onClick={() => sendMut.mutate()} disabled={sendMut.isPending || !bcName.trim() || !bcMessage.trim() || bcBtnHalf || bcBtnBadUrl}>Send broadcast</Button>
        </div>
        {(outreach.data?.broadcasts.length ?? 0) > 0 && (
          <ul className="mt-3 space-y-1 text-xs text-muted-foreground">
            {outreach.data!.broadcasts.map((b) => (
              <li key={b.id} className="flex items-center justify-between gap-2">
                <span className="truncate">{b.name} — {b.status}, sent {b.sent_count}</span>
                <button aria-label={`Delete ${b.name}`} className="hover:text-destructive" onClick={() => delBc({ data: { organizationId: orgId, id: b.id } }).then(refresh)}><X className="size-3.5" /></button>
              </li>
            ))}
          </ul>
        )}
      </Panel>

      <Panel title="Sync to Google Sheets / webhook">
        <p className="mb-3 text-xs text-muted-foreground">
          Every new email or phone captured from DMs is posted to this address. Use a Zapier/Make webhook to fill a Google Sheet automatically.
        </p>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={syncOn ?? false} onChange={(e) => setSyncOn(e.target.checked)} /> Enabled
        </label>
        <div className="mt-3 grid gap-2">
          <Label>Webhook address (https://…)</Label>
          <Input placeholder="https://hooks.zapier.com/…" maxLength={500} value={syncUrl} onChange={(e) => setSyncUrl(e.target.value)} />
          <Button size="sm" onClick={() => saveSyncMut.mutate()} disabled={saveSyncMut.isPending}>Save sync</Button>
        </div>
      </Panel>
    </div>
  );
}

function ContactDetail({ orgId, contact, crm, onSaved }: {
  orgId: string; contact: Row; crm: Awaited<ReturnType<typeof getCrm>> | undefined; onSaved: () => void;
}) {
  const saveProfile = useServerFn(saveContactProfile);
  const addTag = useServerFn(addContactTag);
  const rmTag = useServerFn(removeContactTag);
  const profile = crm?.profiles.find((p) => p.platform === contact.platform && p.external_user_id === contact.externalUserId);
  const tagRows = crm?.tags.filter((t) => t.platform === contact.platform && t.external_user_id === contact.externalUserId) ?? [];
  const [email, setEmail] = useState(profile?.email ?? "");
  const [phone, setPhone] = useState(profile?.phone ?? "");
  const [notes, setNotes] = useState(profile?.notes ?? "");
  const [fields, setFields] = useState<Array<[string, string]>>(Object.entries(profile?.custom_fields ?? {}));
  const [newTag, setNewTag] = useState("");
  useEffect(() => {
    if (!profile && contact.lastPreview) {
      const found = extractContactInfo(contact.lastPreview);
      if (found.email) setEmail(found.email);
      if (found.phone) setPhone(found.phone);
    }
  }, [profile, contact.lastPreview]);
  const ref = { organizationId: orgId, platform: contact.platform, externalUserId: contact.externalUserId };

  const save = useMutation({
    mutationFn: () => saveProfile({ data: {
      ...ref, email: email.trim() || null, phone: phone.trim() || null, notes: notes.trim() || null,
      customFields: Object.fromEntries(fields.filter(([k]) => k.trim()).map(([k, v]) => [k.trim(), v])),
    } }),
    onSuccess: () => { toast.success("Contact saved"); onSaved(); },
    onError: () => toast.error("Check the email / phone format"),
  });

  return (
    <>
      <SheetHeader><SheetTitle className="flex items-center gap-2"><PlatformBadge platform={contact.platform} size="sm" /> {contact.name}</SheetTitle></SheetHeader>
      <div className="mt-4 space-y-5 text-sm">
        <div>
          <Label>Tags</Label>
          <div className="mt-2 flex flex-wrap gap-2">
            {tagRows.map((t) => (
              <span key={t.id} className="inline-flex items-center gap-1 rounded-full bg-accent px-2 py-0.5 text-xs text-accent-foreground">
                {t.tag}
                <button aria-label={`Remove ${t.tag}`} onClick={() => rmTag({ data: { organizationId: orgId, id: t.id } }).then(onSaved)}><X className="size-3" /></button>
              </span>
            ))}
          </div>
          <form className="mt-2 flex gap-2" onSubmit={(e) => {
            e.preventDefault();
            if (!newTag.trim()) return;
            addTag({ data: { ...ref, tag: newTag } }).then(() => { setNewTag(""); onSaved(); }).catch(() => toast.error("Could not add tag"));
          }}>
            <Input value={newTag} maxLength={40} placeholder="Add tag (e.g. hot-lead)" onChange={(e) => setNewTag(e.target.value)} />
            <Button type="submit" variant="outline">Add</Button>
          </form>
        </div>
        <div className="grid gap-2">
          <Label>Email</Label>
          <Input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@example.com" />
          <Label>Phone</Label>
          <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+91 98765 43210" />
          <Label>Notes</Label>
          <textarea rows={3} className="rounded-md border border-input bg-background px-3 py-2" value={notes} maxLength={2000} onChange={(e) => setNotes(e.target.value)} />
        </div>
        <div>
          <Label>Custom fields</Label>
          <div className="mt-2 space-y-2">
            {fields.map(([k, v], i) => (
              <div key={i} className="grid grid-cols-[1fr_1.4fr_auto] gap-2">
                <Input value={k} maxLength={40} placeholder="Field (e.g. city)" onChange={(e) => setFields(fields.map((f, j) => (j === i ? [e.target.value, f[1]] : f)))} />
                <Input value={v} maxLength={300} placeholder="Value" onChange={(e) => setFields(fields.map((f, j) => (j === i ? [f[0], e.target.value] : f)))} />
                <Button variant="ghost" size="icon" aria-label="Remove field" onClick={() => setFields(fields.filter((_, j) => j !== i))}><X className="size-4" /></Button>
              </div>
            ))}
            {fields.length < 20 && <Button size="sm" variant="outline" onClick={() => setFields([...fields, ["", ""]])}>Add field</Button>}
          </div>
        </div>
        <Button className="w-full" onClick={() => save.mutate()} disabled={save.isPending}>Save contact</Button>
        <div>
          <Label>Timeline</Label>
          <p className="mt-1 text-xs text-muted-foreground">
            {contact.threads} thread{contact.threads === 1 ? "" : "s"} ({[...contact.channels].join(", ")}) · last activity {new Date(contact.lastAt).toLocaleString()}
          </p>
          {contact.lastPreview && <p className="mt-2 rounded-md border border-border p-2">{contact.lastPreview}</p>}
          <Button asChild size="sm" variant="link" className="px-0"><Link to="/inbox">Open conversation in inbox</Link></Button>
        </div>
      </div>
    </>
  );
}

const LEAD_STAGE: Record<string, { label: string; tone: "success" | "warning" | "danger" | "info" }> = {
  completed: { label: "Completed", tone: "success" },
  otp_pending: { label: "Dropped at WhatsApp code", tone: "warning" },
  intent_started: { label: "Left form unsent", tone: "danger" },
  buyer_signin_attempt: { label: "Sign-in attempt", tone: "info" },
};
const FOLLOW: Record<string, { label: string; tone: "success" | "warning" | "info" | "neutral" }> = {
  not_contacted: { label: "Not contacted", tone: "neutral" },
  sent: { label: "Follow-up sent", tone: "info" },
  replied: { label: "Replied", tone: "success" },
  no_reply: { label: "No reply", tone: "warning" },
};
type Draft = Awaited<ReturnType<typeof draftLeadFollowUps>>["drafts"][number];

function PageLeadsPanel({ orgId }: { orgId: string | null }) {
  const fetchCrm = useServerFn(getCrm);
  const draftFn = useServerFn(draftLeadFollowUps);
  const sendEmailFn = useServerFn(sendLeadFollowUpEmail);
  const [sendingId, setSendingId] = useState<string | null>(null);
  const sendEmail = async (d: { id: string; subject: string; message: string }) => {
    setSendingId(d.id);
    try { await sendEmailFn({ data: { organizationId: orgId!, leadId: d.id, subject: d.subject, message: d.message } }); toast.success("Email sent"); qc.invalidateQueries(); }
    catch (e) { toast.error(e instanceof Error ? e.message : "Could not send"); }
    finally { setSendingId(null); }
  };
  const crm = useQuery({ queryKey: ["crm", orgId], enabled: !!orgId, queryFn: () => fetchCrm({ data: { organizationId: orgId! } }) });
  const pageLeads = crm.data?.pageLeads ?? [];
  const [leadPage, setLeadPage] = useState("all");
  const [stage, setStage] = useState("all");
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [channel, setChannel] = useState<"whatsapp" | "email">("whatsapp");
  const [tone, setTone] = useState<"helpful" | "offer" | "short">("helpful");
  const [drafts, setDrafts] = useState<Draft[] | null>(null);
  const [follow, setFollow] = useState("all");
  const qc = useQueryClient();
  const followFn = useServerFn(setLeadFollowUp);
  const mark = useMutation({
    mutationFn: (v: { ids: string[]; status: "not_contacted" | "sent" | "replied" | "no_reply"; channel?: "whatsapp" | "email" }) =>
      followFn({ data: { organizationId: orgId!, leadIds: v.ids, status: v.status, ...(v.channel ? { channel: v.channel } : {}) } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["crm", orgId] }),
    onError: (e: Error) => toast.error(e.message),
  });
  const followOf = (l: { answers: Record<string, string> }) => l.answers["_followup_status"] || "not_contacted";
  const leadPages = [...new Set(pageLeads.map((l) => l.pageTitle))].sort();
  const stageOf = (l: { answers: Record<string, string> }) => l.answers["_stage"] || "completed";
  const shownLeads = pageLeads.filter((l) => (leadPage === "all" || l.pageTitle === leadPage)
    && (stage === "all" || (stage === "dropped" ? stageOf(l) !== "completed" : stageOf(l) === stage))
    && (follow === "all" || followOf(l) === follow));
  const counts = Object.fromEntries(Object.keys(FOLLOW).map((k) => [k, pageLeads.filter((l) => followOf(l) === k).length]));
  const allPicked = shownLeads.length > 0 && shownLeads.every((l) => picked.has(l.id));
  const toggle = (id: string) => setPicked((p) => { const n = new Set(p); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const draft = useMutation({
    mutationFn: () => draftFn({ data: { organizationId: orgId!, leadIds: [...picked].slice(0, 20), channel, tone } }),
    onSuccess: (r) => setDrafts(r.drafts),
    onError: (e: Error) => toast.error(e.message),
  });
  function exportLeads() {
    const url = URL.createObjectURL(new Blob([pageLeadsToCsv(shownLeads)], { type: "text/csv" }));
    const a = document.createElement("a");
    a.href = url; a.download = "delivery-page-leads.csv"; a.click();
    URL.revokeObjectURL(url);
  }
  const waLink = (phone: string, text: string) => `https://wa.me/${phone.replace(/\D/g, "").replace(/^(\d{10})$/, "91$1")}?text=${encodeURIComponent(text)}`;

  return (
    <>
      <Panel
        title={`Delivery page leads (${shownLeads.length})`}
        action={
          <div className="flex flex-wrap gap-2">
            <select className={sel} value={stage} onChange={(e) => setStage(e.target.value)} aria-label="Filter leads by stage">
              <option value="all">All stages</option>
              <option value="dropped">Dropped only</option>
              {Object.entries(LEAD_STAGE).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
            </select>
            <select className={sel} value={follow} onChange={(e) => setFollow(e.target.value)} aria-label="Filter by follow-up">
              <option value="all">Any follow-up</option>
              {Object.entries(FOLLOW).map(([k, v]) => <option key={k} value={k}>{v.label} ({counts[k] ?? 0})</option>)}
            </select>
            <select className={sel} value={leadPage} onChange={(e) => setLeadPage(e.target.value)} aria-label="Filter leads by page">
              <option value="all">All pages</option>
              {leadPages.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
            <Button size="sm" variant="outline" onClick={exportLeads} disabled={shownLeads.length === 0}><Download className="size-4" /> Export leads</Button>
          </div>
        }
      >
        {picked.size > 0 && (
          <div className="mb-3 flex flex-wrap items-center gap-2 rounded-lg border border-primary/30 bg-primary/5 p-2 text-sm">
            <span className="font-medium">{picked.size} selected{picked.size > 20 ? " (first 20 used)" : ""}</span>
            <select className={sel} value={channel} onChange={(e) => setChannel(e.target.value as "whatsapp" | "email")} aria-label="Channel"><option value="whatsapp">WhatsApp</option><option value="email">Email</option></select>
            <select className={sel} value={tone} onChange={(e) => setTone(e.target.value as "helpful" | "offer" | "short")} aria-label="Tone"><option value="helpful">Helpful</option><option value="offer">Limited-time nudge</option><option value="short">Short & direct</option></select>
            <Button size="sm" onClick={() => draft.mutate()} disabled={draft.isPending}><Sparkles className="size-4" /> {draft.isPending ? "Writing…" : "Draft AI follow-ups"}</Button>
            <select className={sel} value="" aria-label="Mark selected" onChange={(e) => { const v = e.target.value as "sent" | "replied" | "no_reply" | "not_contacted"; if (v) mark.mutate({ ids: [...picked], status: v }); }}>
              <option value="">Mark as…</option>
              {Object.entries(FOLLOW).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
            </select>
            <Button size="sm" variant="ghost" onClick={() => setPicked(new Set())}>Clear</Button>
          </div>
        )}
        {shownLeads.length === 0 ? (
          <p className="text-sm text-muted-foreground">People who fill the form on your delivery pages (Sales &amp; Revenue → Pages) show up here.</p>
        ) : (
          <div className="max-h-96 max-w-full overflow-auto">
            <table className="w-full min-w-[920px] text-sm">
              <thead className="text-left text-xs text-muted-foreground"><tr>
                <th className="py-2 pr-2"><Checkbox aria-label="Select all" checked={allPicked} onCheckedChange={() => setPicked(allPicked ? new Set() : new Set(shownLeads.map((l) => l.id)))} /></th>
                <th className="pr-3">Name</th><th className="pr-3">Email</th><th className="pr-3">Phone</th><th className="pr-3">Stage</th><th className="pr-3">Follow-up</th><th className="pr-3">Other answers</th><th className="pr-3">Page</th><th>When</th></tr></thead>
              <tbody className="divide-y">
                {shownLeads.map((l) => {
                  const other = Object.entries(l.answers).filter(([k]) => !["name", "email", "phone"].includes(k) && !k.startsWith("_"));
                  const st = LEAD_STAGE[stageOf(l)] ?? LEAD_STAGE["completed"]!;
                  return (
                    <tr key={l.id}>
                      <td className="py-2 pr-2"><Checkbox aria-label={`Select ${l.answers["name"] || l.answers["email"] || "lead"}`} checked={picked.has(l.id)} onCheckedChange={() => toggle(l.id)} /></td>
                      <td className="pr-3">{l.answers["name"] || "—"}</td>
                      <td className="pr-3">{l.answers["email"] || "—"}</td>
                      <td className="pr-3">{l.answers["phone"] || "—"}</td>
                      <td className="pr-3"><StatusBadge tone={st.tone}>{st.label}</StatusBadge></td>
                      <td className="pr-3">
                        <select className="h-8 rounded-md border border-input bg-background px-1 text-xs" value={followOf(l)} aria-label="Follow-up status"
                          onChange={(e) => mark.mutate({ ids: [l.id], status: e.target.value as "sent" | "replied" | "no_reply" | "not_contacted" })}>
                          {Object.entries(FOLLOW).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                        </select>
                        {l.answers["_followup_at"] && <p className="mt-0.5 text-[10px] text-muted-foreground">{l.answers["_followup_channel"] === "email" ? "Email" : l.answers["_followup_channel"] === "whatsapp" ? "WhatsApp" : ""} {new Date(l.answers["_followup_at"]).toLocaleDateString()}</p>}
                      </td>
                      <td className="pr-3 text-xs text-muted-foreground">{other.map(([k, v]) => `${k}: ${v}`).join(" · ") || "—"}</td>
                      <td className="pr-3">{l.pageTitle}</td>
                      <td className="text-xs text-muted-foreground">{new Date(l.answers["_updated_at"] || l.createdAt).toLocaleString()}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      <Dialog open={!!drafts} onOpenChange={(v) => !v && setDrafts(null)}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-xl">
          <DialogHeader><DialogTitle>AI follow-up drafts</DialogTitle></DialogHeader>
          <p className="text-xs text-muted-foreground">Review and edit before sending. Nothing is sent automatically.</p>
          <div className="space-y-3">
            {drafts?.map((d, i) => {
              const st = LEAD_STAGE[d.stage] ?? LEAD_STAGE["completed"]!;
              const set = (patch: Partial<Draft>) => setDrafts((all) => all!.map((x, j) => (j === i ? { ...x, ...patch } : x)));
              return (
                <div key={d.id} className="space-y-2 rounded-lg border border-border p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2 text-sm"><span className="font-medium">{d.name || d.email || d.phone || "Lead"}</span><StatusBadge tone={st.tone}>{st.label}</StatusBadge></div>
                  {channel === "email" && <Input value={d.subject} onChange={(e) => set({ subject: e.target.value })} aria-label="Subject" />}
                  <textarea className="min-h-24 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={d.message} onChange={(e) => set({ message: e.target.value })} aria-label="Message" />
                  <div className="flex flex-wrap gap-2">
                    <Button size="sm" variant="outline" onClick={() => { navigator.clipboard.writeText(d.message); toast.success("Copied"); }}>Copy</Button>
                    {channel === "whatsapp" && d.phone && <Button size="sm" asChild><a href={waLink(d.phone, d.message)} target="_blank" rel="noreferrer" onClick={() => mark.mutate({ ids: [d.id], status: "sent", channel: "whatsapp" })}>Open in WhatsApp</a></Button>}
                    {channel === "email" && d.email && <Button size="sm" onClick={() => void sendEmail(d)} disabled={sendingId === d.id}>{sendingId === d.id ? "Sending…" : "Send email"}</Button>}
                    {channel === "email" && d.email && <Button size="sm" variant="outline" asChild><a href={`mailto:${d.email}?subject=${encodeURIComponent(d.subject)}&body=${encodeURIComponent(d.message)}`} onClick={() => mark.mutate({ ids: [d.id], status: "sent", channel: "email" })}>Open in email</a></Button>}
                    {((channel === "whatsapp" && !d.phone) || (channel === "email" && !d.email)) && <span className="text-xs text-muted-foreground">No {channel === "whatsapp" ? "phone number" : "email"} for this lead — copy instead.</span>}
                  </div>
                </div>
              );
            })}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
