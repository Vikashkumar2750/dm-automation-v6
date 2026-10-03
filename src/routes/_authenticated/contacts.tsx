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
import { useTenant } from "@/hooks/useTenant";
import { contactsToCsv, extractContactInfo, matchesSegment, type CrmContact, type SegmentFilter } from "@/lib/crm";
import { addContactTag, deleteSegment, getCrm, removeContactTag, saveContactProfile, saveSegment } from "@/lib/crm.functions";
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
  const conversations = useQuery({
    queryKey: ["conversations", orgId, "contacts"],
    enabled: !!orgId,
    refetchInterval: 60_000,
    queryFn: () => fetchConversations({ data: { organizationId: orgId! } }),
  });
  const crm = useQuery({ queryKey: ["crm", orgId], enabled: !!orgId, queryFn: () => fetchCrm({ data: { organizationId: orgId! } }) });
  const refresh = () => qc.invalidateQueries({ queryKey: ["crm", orgId] });

  const contacts = useMemo(() => {
    const map = new Map<string, Row>();
    for (const c of conversations.data ?? []) {
      const key = `${c.platform}:${c.external_user_id}`;
      const e = map.get(key);
      if (e) {
        e.threads += 1; e.unread += c.unread_count; e.channels.add(c.channel);
        if (c.last_message_at > e.lastAt) { e.lastAt = c.last_message_at; e.lastPreview = c.last_message_preview; }
      } else {
        map.set(key, {
          key, externalUserId: c.external_user_id, name: c.external_user_name || c.external_user_id, platform: c.platform,
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
  }, [conversations.data, crm.data]);

  const allTags = useMemo(() => [...new Set(contacts.flatMap((c) => c.tags))].sort(), [contacts]);
  const visible = contacts.filter((c) => matchesSegment(c, filter));
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
          <div className="flex gap-2">
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
              <button className="px-3 py-1 hover:text-primary" onClick={() => setFilter(s.filter as SegmentFilter)}>{s.name}</button>
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
            <select className={sel} value={filter.platform ?? ""} onChange={(e) => setFilter({ ...filter, platform: (e.target.value || undefined) as SegmentFilter["platform"] })}>
              <option value="">All platforms</option>
              <option value="instagram">Instagram</option>
              <option value="facebook">Facebook</option>
              <option value="youtube">YouTube</option>
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
            {visible.map((c) => (
              <button key={c.key} onClick={() => setOpenKey(c.key)} className="flex w-full flex-wrap items-center gap-3 rounded-xl border px-4 py-3 text-left hover:bg-muted/50">
                <PlatformBadge platform={c.platform} size="sm" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{c.name}</p>
                  <p className="truncate text-xs text-muted-foreground">{c.email ?? c.lastPreview ?? "No preview"}</p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {c.tags.slice(0, 3).map((t) => <StatusBadge key={t} tone="info">{t}</StatusBadge>)}
                  {c.unread > 0 && <StatusBadge tone="warning">{c.unread} unread</StatusBadge>}
                  <StatusBadge tone="neutral">{[...c.channels].join(" + ")}</StatusBadge>
                  <span className="text-xs text-muted-foreground">{new Date(c.lastAt).toLocaleString()}</span>
                </div>
              </button>
            ))}
          </div>
        )}
      </Panel>

      <Sheet open={!!open} onOpenChange={(v) => !v && setOpenKey(null)}>
        <SheetContent className="overflow-y-auto sm:max-w-md">
          {open && orgId && <ContactDetail key={open.key} orgId={orgId} contact={open} crm={crm.data} onSaved={refresh} />}
        </SheetContent>
      </Sheet>
    </AppShell>
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
