import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Inbox } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { EmptyState, PageHeader, Panel, StatusBadge } from "@/components/app/primitives";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { listSupportInquiries, setSupportInquiryStatus } from "@/lib/support.functions";

export const Route = createFileRoute("/_authenticated/admin/inquiries")({
  head: () => ({ meta: [
    { title: "Support Inquiries — Techaasvik Operations" },
    { name: "description", content: "Review and resolve customer support inquiries." },
    { property: "og:title", content: "Support Inquiries — Techaasvik Operations" },
    { property: "og:description", content: "Customer support inquiry management." },
    { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" },
  ] }), component: InquiriesPage,
});

function InquiriesPage() {
  const fetchRows = useServerFn(listSupportInquiries);
  const setStatus = useServerFn(setSupportInquiryStatus);
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "open" | "resolved">("open");
  const query = useQuery({ queryKey: ["support-inquiries"], queryFn: () => fetchRows(), retry: false });
  const mutation = useMutation({
    mutationFn: (data: { id: string; status: "open" | "resolved" }) => setStatus({ data }),
    onSuccess: () => { toast.success("Inquiry updated"); void queryClient.invalidateQueries({ queryKey: ["support-inquiries"] }); },
    onError: (error: Error) => toast.error(error.message),
  });
  const q = search.trim().toLowerCase();
  const rows = (query.data ?? []).filter((row) =>
    (filter === "all" || row.status === filter) &&
    (!q || `${row.name} ${row.email} ${row.subject} ${row.message}`.toLowerCase().includes(q)),
  );

  return <div className="space-y-6">
    <PageHeader title="Support inquiries" description="Questions submitted from the public website." />
    <Panel title={`${rows.length} inquiries`} action={<div className="flex flex-wrap gap-2">
      <select value={filter} onChange={(e) => setFilter(e.target.value as typeof filter)} className="h-9 rounded-md border bg-background px-3 text-sm"><option value="open">Open</option><option value="resolved">Resolved</option><option value="all">All</option></select>
      <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search inquiries" className="h-9 w-56" />
    </div>}>
      {query.isLoading ? <p className="text-sm text-muted-foreground">Loading…</p> : rows.length === 0 ?
        <EmptyState icon={Inbox} title="No inquiries" description="No inquiries match this view." /> :
        <div className="divide-y">{rows.map((row) => <article key={row.id} className="py-5 first:pt-0 last:pb-0">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div><div className="flex flex-wrap items-center gap-2"><h2 className="font-semibold">{row.subject}</h2><StatusBadge tone={row.status === "open" ? "warning" : "success"}>{row.status}</StatusBadge><StatusBadge tone={row.email_notification_status === "sent" ? "success" : row.email_notification_status === "failed" ? "danger" : "neutral"}>email {row.email_notification_status}</StatusBadge></div>
              <p className="mt-1 text-xs text-muted-foreground">{row.name} · <a className="hover:text-foreground" href={`mailto:${row.email}`}>{row.email}</a> · {row.category} · {new Date(row.created_at).toLocaleString()}</p></div>
            <Button size="sm" variant="outline" disabled={mutation.isPending} onClick={() => mutation.mutate({ id: row.id, status: row.status === "open" ? "resolved" : "open" })}>{row.status === "open" ? "Mark resolved" : "Reopen"}</Button>
          </div>
          <p className="mt-3 whitespace-pre-wrap text-sm text-muted-foreground">{row.message}</p>
          {row.email_notification_error ? <p className="mt-2 text-xs text-destructive">Notification: {row.email_notification_error}</p> : null}
        </article>)}</div>}
    </Panel>
  </div>;
}