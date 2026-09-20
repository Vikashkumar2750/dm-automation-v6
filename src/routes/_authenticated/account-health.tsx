import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ShieldCheck, Webhook } from "lucide-react";

import { AppShell } from "@/components/app/AppShell";
import {
  EmptyState,
  PageHeader,
  Panel,
  PlatformBadge,
  StatusBadge,
} from "@/components/app/primitives";
import { Button } from "@/components/ui/button";
import { useTenant } from "@/hooks/useTenant";
import { listSocialAccounts } from "@/lib/social-accounts.functions";
import { listWebhookEvents } from "@/lib/webhooks.functions";

export const Route = createFileRoute("/_authenticated/account-health")({
  head: () => ({
    meta: [
      { title: "Account Health — DM FB-IG-YT by Techaasvik" },
      {
        name: "description",
        content: "Connection status, permission scopes, token expiry and incoming event health.",
      },
      { property: "og:title", content: "Account Health" },
      {
        property: "og:description",
        content: "See which connected accounts need attention before automations break.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AccountHealthPage,
});

function expiryTone(iso: string | null) {
  if (!iso) return { tone: "neutral" as const, label: "No expiry" };
  const days = Math.round((new Date(iso).getTime() - Date.now()) / 86_400_000);
  if (days < 0) return { tone: "danger" as const, label: "Access expired" };
  if (days <= 7) return { tone: "warning" as const, label: `Expires in ${days}d` };
  return { tone: "success" as const, label: `Valid ${days}d` };
}

function AccountHealthPage() {
  const { activeOrg } = useTenant();
  const orgId = activeOrg?.id ?? null;

  const fetchAccounts = useServerFn(listSocialAccounts);
  const fetchEvents = useServerFn(listWebhookEvents);

  const accounts = useQuery({
    queryKey: ["social-accounts", orgId],
    enabled: !!orgId,
    queryFn: () => fetchAccounts({ data: { organizationId: orgId! } }),
  });

  const events = useQuery({
    queryKey: ["webhook-events", orgId],
    enabled: !!orgId,
    refetchInterval: 30_000,
    queryFn: () => fetchEvents({ data: { organizationId: orgId! } }),
  });

  const rows = accounts.data ?? [];
  const failing = (events.data ?? []).filter((e) => e.status === "failed" || !e.signature_valid);

  return (
    <AppShell>
      <PageHeader
        title="Account Health"
        description="Connection status, permissions and incoming event health for every connected account."
        actions={
          <Button asChild variant="outline">
            <Link to="/social-accounts">Manage accounts</Link>
          </Button>
        }
      />

      <div className="space-y-6">
        <Panel title="Connected accounts">
          {rows.length === 0 ? (
            <EmptyState
              icon={ShieldCheck}
              title="No accounts connected"
              description="Connect Instagram or Facebook to start monitoring health."
              action={
                <Button asChild>
                  <Link to="/social-accounts">Connect an account</Link>
                </Button>
              }
            />
          ) : (
            <div className="space-y-2">
              {rows.map((a) => {
                const exp = expiryTone(a.token_expires_at);
                return (
                  <div
                    key={a.id}
                    className="flex flex-wrap items-center gap-3 rounded-xl border px-4 py-3"
                  >
                    <PlatformBadge platform={a.platform} withLabel={a.name} />
                    <span className="text-xs text-muted-foreground">
                      {a.handle ? `@${a.handle}` : a.external_id}
                    </span>
                    <div className="ml-auto flex flex-wrap items-center gap-2">
                      <StatusBadge
                        tone={
                          a.status === "connected"
                            ? "success"
                            : a.status === "attention"
                              ? "warning"
                              : "danger"
                        }
                      >
                        {a.status}
                      </StatusBadge>
                      <StatusBadge tone={exp.tone}>{exp.label}</StatusBadge>
                      <StatusBadge tone="neutral">{a.scopes.length} permissions</StatusBadge>
                      <span className="text-xs text-muted-foreground">
                        {a.last_synced_at
                          ? `Synced ${new Date(a.last_synced_at).toLocaleString()}`
                          : "Never synced"}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Panel>

        <Panel title="Incoming event problems">
          {failing.length === 0 ? (
            <EmptyState
              icon={Webhook}
              title="No problems found"
              description="Failed or unverified events from Instagram and Facebook will be listed here."
            />
          ) : (
            <div className="space-y-2">
              {failing.slice(0, 20).map((e) => (
                <div
                  key={e.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-lg border px-3 py-2 text-sm"
                >
                  <div className="min-w-0">
                    <span className="font-medium capitalize">{e.platform ?? "unknown"}</span>
                    <span className="text-muted-foreground"> · {e.event_type}</span>
                    {e.error ? (
                      <div className="truncate text-xs text-danger">{e.error}</div>
                    ) : null}
                  </div>
                  <div className="flex items-center gap-2">
                    {!e.signature_valid && <StatusBadge tone="danger">Bad signature</StatusBadge>}
                    <StatusBadge tone="warning">{e.status}</StatusBadge>
                    <span className="text-xs text-muted-foreground">
                      {new Date(e.received_at).toLocaleString()}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Panel>
      </div>
    </AppShell>
  );
}
