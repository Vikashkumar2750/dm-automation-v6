import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { CheckCircle2, Loader2, Plug, RefreshCw, Trash2, TriangleAlert } from "lucide-react";
import { toast } from "sonner";

import { AppShell } from "@/components/app/AppShell";
import { PageHeader, Panel, PlatformBadge, StatusBadge, EmptyState } from "@/components/app/primitives";
import { Button } from "@/components/ui/button";
import { useTenant } from "@/hooks/useTenant";
import { platformMeta, type SocialPlatform } from "@/lib/social";
import {
  disconnectSocialAccount,
  getProviderReadiness,
  listSocialAccounts,
  startSocialConnect,
} from "@/lib/social-accounts.functions";

export const Route = createFileRoute("/_authenticated/social-accounts")({
  head: () => ({
    meta: [
      { title: "Social Accounts — DM FB-IG-YT by Techaasvik" },
      {
        name: "description",
        content: "Connect and manage Instagram, Facebook and YouTube accounts.",
      },
      { property: "og:title", content: "Social Accounts — DM FB-IG-YT by Techaasvik" },
      {
        property: "og:description",
        content: "Connect and manage Instagram, Facebook and YouTube accounts.",
      },
    ],
  }),
  component: SocialAccountsPage,
});

const platforms: SocialPlatform[] = ["instagram", "facebook", "youtube"];

function SocialAccountsPage() {
  const { activeOrg, loading } = useTenant();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [pending, setPending] = useState<SocialPlatform | null>(null);

  const fetchAccounts = useServerFn(listSocialAccounts);
  const fetchReadiness = useServerFn(getProviderReadiness);
  const connectFn = useServerFn(startSocialConnect);
  const disconnectFn = useServerFn(disconnectSocialAccount);

  const orgId = activeOrg?.id;

  const accountsQuery = useQuery({
    queryKey: ["social-accounts", orgId],
    enabled: Boolean(orgId),
    queryFn: () => fetchAccounts({ data: { organizationId: orgId! } }),
  });

  const readinessQuery = useQuery({
    queryKey: ["social-provider-readiness"],
    queryFn: () => fetchReadiness(),
  });

  const disconnect = useMutation({
    mutationFn: (id: string) => disconnectFn({ data: { id } }),
    onSuccess: () => {
      toast.success("Account disconnected");
      queryClient.invalidateQueries({ queryKey: ["social-accounts", orgId] });
    },
    onError: () => toast.error("Could not disconnect that account"),
  });

  // Surface the result of a returning OAuth redirect.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const result = params.get("connect");
    if (!result) return;
    if (result === "success") {
      const added = params.get("added");
      toast.success(
        added && added !== "0"
          ? `Connected ${added} account${added === "1" ? "" : "s"}`
          : "Nothing new to connect — check the account has the right permissions",
      );
      queryClient.invalidateQueries({ queryKey: ["social-accounts", orgId] });
    } else if (result === "cancelled") {
      toast("Connection cancelled");
    } else if (result === "expired") {
      toast.error("That connection link expired — try again");
    } else {
      toast.error("Connection failed. Please try again.");
    }
    navigate({ to: "/social-accounts", replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleConnect(platform: SocialPlatform) {
    if (!orgId) return;
    setPending(platform);
    try {
      const result = await connectFn({
        data: { organizationId: orgId, platform, origin: window.location.origin },
      });
      if ("url" in result && result.url) {
        window.location.href = result.url;
        return;
      }
      if (result.error === "missing_credentials") {
        toast.error(
          platform === "youtube"
            ? "YouTube sign-in isn't set up yet — add your Google credentials first."
            : "Facebook/Instagram sign-in isn't set up yet — add your Meta credentials first.",
        );
      } else {
        toast.error("You need manager access or higher to connect accounts.");
      }
    } catch {
      toast.error("Could not start the connection");
    } finally {
      setPending(null);
    }
  }

  const accounts = accountsQuery.data ?? [];
  const readiness = readinessQuery.data;

  return (
    <AppShell>
      <PageHeader
        title="Social Accounts"
        description="Connect and manage the Instagram, Facebook and YouTube accounts this workspace automates."
      />

      <div className="grid gap-4 md:grid-cols-3">
        {platforms.map((platform) => {
          const meta = platformMeta[platform];
          const ready =
            meta.provider === "meta" ? readiness?.meta : readiness?.google;
          const count = accounts.filter((a) => a.platform === platform).length;
          return (
            <Panel key={platform} className="p-5">
              <div className="flex items-start justify-between gap-3">
                <PlatformBadge platform={platform} withLabel={meta.label} />
                {count > 0 ? (
                  <StatusBadge tone="success">{count} connected</StatusBadge>
                ) : readinessQuery.isLoading ? null : ready ? (
                  <StatusBadge tone="neutral">Not connected</StatusBadge>
                ) : (
                  <StatusBadge tone="warning">Setup needed</StatusBadge>
                )}
              </div>
              <p className="mt-3 text-sm text-muted-foreground">{meta.blurb}</p>
              <ul className="mt-3 space-y-1">
                {meta.capabilities.map((cap) => (
                  <li
                    key={cap}
                    className="flex items-center gap-2 text-xs text-muted-foreground"
                  >
                    <CheckCircle2 className="size-3.5 text-success" />
                    {cap}
                  </li>
                ))}
              </ul>
              <Button
                className="mt-4 w-full"
                variant={count > 0 ? "outline" : "default"}
                disabled={pending === platform || loading}
                onClick={() => handleConnect(platform)}
              >
                {pending === platform ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Plug className="size-4" />
                )}
                {count > 0 ? "Connect another" : `Connect ${meta.label}`}
              </Button>
            </Panel>
          );
        })}
      </div>

      <Panel className="mt-6">
        <div className="flex items-center justify-between border-b px-5 py-4">
          <div>
            <p className="text-sm font-semibold">Connected accounts</p>
            <p className="text-xs text-muted-foreground">
              Access tokens are stored securely on the server and never sent to the browser.
            </p>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => accountsQuery.refetch()}
            disabled={accountsQuery.isFetching}
          >
            <RefreshCw
              className={accountsQuery.isFetching ? "size-4 animate-spin" : "size-4"}
            />
            Refresh
          </Button>
        </div>

        {accountsQuery.isLoading ? (
          <div className="flex items-center justify-center py-12 text-sm text-muted-foreground">
            <Loader2 className="mr-2 size-4 animate-spin" /> Loading accounts…
          </div>
        ) : accounts.length === 0 ? (
          <EmptyState
            icon={Plug}
            title="No accounts connected yet"
            description="Connect an Instagram Business account, a Facebook Page or a YouTube channel to start automating."
          />
        ) : (
          <ul className="divide-y">
            {accounts.map((account) => {
              const expired =
                account.token_expires_at &&
                new Date(account.token_expires_at) < new Date();
              return (
                <li key={account.id} className="flex items-center gap-4 px-5 py-4">
                  <PlatformBadge platform={account.platform} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{account.name}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {account.handle ?? platformMeta[account.platform].label}
                    </p>
                  </div>
                  {expired || account.status !== "connected" ? (
                    <StatusBadge tone="warning">
                      <TriangleAlert className="mr-1 size-3" /> Needs reconnect
                    </StatusBadge>
                  ) : (
                    <StatusBadge tone="success">Connected</StatusBadge>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => disconnect.mutate(account.id)}
                    disabled={disconnect.isPending}
                  >
                    <Trash2 className="size-4" />
                    <span className="sr-only">Disconnect</span>
                  </Button>
                </li>
              );
            })}
          </ul>
        )}
      </Panel>
    </AppShell>
  );
}
