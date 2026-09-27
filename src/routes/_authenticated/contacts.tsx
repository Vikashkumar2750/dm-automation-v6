import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Users } from "lucide-react";
import { useMemo, useState } from "react";

import { AppShell } from "@/components/app/AppShell";
import {
  EmptyState,
  PageHeader,
  Panel,
  PlatformBadge,
  StatusBadge,
} from "@/components/app/primitives";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useTenant } from "@/hooks/useTenant";
import { listConversations } from "@/lib/inbox.functions";

export const Route = createFileRoute("/_authenticated/contacts")({
  head: () => ({
    meta: [
      { title: "Contacts — AutoDM by Techaasvik" },
      {
        name: "description",
        content: "Everyone who messaged or commented, with their platform, last message and thread count.",
      },
      { property: "og:title", content: "Contacts" },
      {
        property: "og:description",
        content: "People who engaged with your Instagram and Facebook accounts.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ContactsPage,
});

function ContactsPage() {
  const { activeOrg } = useTenant();
  const orgId = activeOrg?.id ?? null;
  const [search, setSearch] = useState("");

  const fetchConversations = useServerFn(listConversations);
  const conversations = useQuery({
    queryKey: ["conversations", orgId, "contacts"],
    enabled: !!orgId,
    refetchInterval: 60_000,
    queryFn: () => fetchConversations({ data: { organizationId: orgId! } }),
  });

  const contacts = useMemo(() => {
    const map = new Map<
      string,
      {
        key: string;
        name: string;
        platform: "instagram" | "facebook" | "youtube";
        threads: number;
        unread: number;
        lastAt: string;
        lastPreview: string | null;
        channels: Set<string>;
      }
    >();
    for (const c of conversations.data ?? []) {
      const key = `${c.platform}:${c.external_user_id}`;
      const existing = map.get(key);
      if (existing) {
        existing.threads += 1;
        existing.unread += c.unread_count;
        existing.channels.add(c.channel);
        if (c.last_message_at > existing.lastAt) {
          existing.lastAt = c.last_message_at;
          existing.lastPreview = c.last_message_preview;
        }
      } else {
        map.set(key, {
          key,
          name: c.external_user_name || c.external_user_id,
          platform: c.platform,
          threads: 1,
          unread: c.unread_count,
          lastAt: c.last_message_at,
          lastPreview: c.last_message_preview,
          channels: new Set([c.channel]),
        });
      }
    }
    const term = search.trim().toLowerCase();
    return [...map.values()]
      .filter((c) => !term || c.name.toLowerCase().includes(term))
      .sort((a, b) => (a.lastAt < b.lastAt ? 1 : -1));
  }, [conversations.data, search]);

  return (
    <AppShell>
      <PageHeader
        title="Contacts"
        description="Everyone who messaged or commented, grouped across their threads."
        actions={
          <Button asChild variant="outline">
            <Link to="/inbox">Open inbox</Link>
          </Button>
        }
      />

      <Panel
        title={`People (${contacts.length})`}
        action={
          <Input
            placeholder="Search by name"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-9 w-48"
          />
        }
      >
        {contacts.length === 0 ? (
          <EmptyState
            icon={Users}
            title="No contacts yet"
            description="People appear here as soon as they message or comment on your accounts."
          />
        ) : (
          <div className="space-y-2">
            {contacts.map((c) => (
              <div key={c.key} className="flex flex-wrap items-center gap-3 rounded-xl border px-4 py-3">
                <PlatformBadge platform={c.platform} size="sm" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{c.name}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {c.lastPreview ?? "No preview"}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {c.unread > 0 && <StatusBadge tone="info">{c.unread} unread</StatusBadge>}
                  <StatusBadge tone="neutral">
                    {c.threads} thread{c.threads === 1 ? "" : "s"}
                  </StatusBadge>
                  <StatusBadge tone="neutral">{[...c.channels].join(" + ")}</StatusBadge>
                  <span className="text-xs text-muted-foreground">
                    {new Date(c.lastAt).toLocaleString()}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </Panel>
    </AppShell>
  );
}
