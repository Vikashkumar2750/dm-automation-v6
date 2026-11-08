import { Link, createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { CheckCircle2, Loader2, Plug, RefreshCw, Trash2, TriangleAlert } from "lucide-react";
import { toast } from "sonner";

import { AppShell } from "@/components/app/AppShell";
import { PageHeader, Panel, PlatformBadge, StatusBadge, EmptyState } from "@/components/app/primitives";
import { Button } from "@/components/ui/button";
import { useTenant } from "@/hooks/useTenant";
import { EntryPointsCard } from "@/components/app/EntryPointsPanels";
import { ProfessionalProfileGuide } from "@/components/app/ProfessionalProfileGuide";
import { platformMeta, type SocialPlatform } from "@/lib/social";
import {
  checkWebhookDelivery,
  disconnectSocialAccount,
  getProviderReadiness,
  listSocialAccounts,
  startSocialConnect,
  testInstagramComments,
} from "@/lib/social-accounts.functions";
import { getWebhookConfig, listWebhookEvents } from "@/lib/webhooks.functions";

export const Route = createFileRoute("/_authenticated/social-accounts")({
  head: () => ({
    meta: [
      { title: "Social Accounts — AutoDM by Techaasvik" },
      {
        name: "description",
        content: "Connect and manage Instagram, Facebook and YouTube accounts.",
      },
      { property: "og:title", content: "Social Accounts — AutoDM by Techaasvik" },
      {
        property: "og:description",
        content: "Connect and manage Instagram, Facebook and YouTube accounts.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
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

  const fetchEvents = useServerFn(listWebhookEvents);
  const fetchWebhookConfig = useServerFn(getWebhookConfig);

  const eventsQuery = useQuery({
    queryKey: ["webhook-events", orgId],
    meta: { background: true },
    enabled: Boolean(orgId),
    refetchInterval: 30_000,
    queryFn: () => fetchEvents({ data: { organizationId: orgId! } }),
  });

  const checkDelivery = useServerFn(checkWebhookDelivery);
  const testCommentsFn = useServerFn(testInstagramComments);
  const testComments = useMutation({
    mutationFn: () => testCommentsFn({ data: { organizationId: orgId! } }),
    onSuccess: (rows) => {
      if (rows.length === 0) { toast("Connect an Instagram account first"); return; }
      for (const r of rows) {
        if (r.ok) toast.success(`${r.name}: Instagram comments read OK (${r.comments} comments)`);
        else toast.error(`${r.name}: ${r.error}`);
      }
    },
    onError: () => toast.error("Could not test Instagram comments"),
  });
  const fixNotifications = useMutation({
    mutationFn: () => checkDelivery({ data: { organizationId: orgId!, repair: true } }),
    onSuccess: (rows) => {
      const bad = rows.filter((r) => !r.subscribed);
      if (rows.length === 0) toast("Connect an Instagram or Facebook account first");
      else if (bad.length === 0)
        toast.success("Notifications are on — comments and DMs will now trigger rules");
      else
        toast.error(
          `Still off for ${bad.map((r) => r.name).join(", ")}${bad[0]?.missingFields.length ? ` — missing: ${bad[0].missingFields.join(", ")}` : ""}${bad[0]?.error ? `: ${bad[0].error}` : ""}`,
        );
      accountsQuery.refetch();
    },
    onError: () => toast.error("Could not check notifications"),
  });

  const webhookConfigQuery = useQuery({
    queryKey: ["webhook-config"],
    meta: { background: true },
    queryFn: () => fetchWebhookConfig(),
  });

  const disconnect = useMutation({
    mutationFn: (id: string) => disconnectFn({ data: { id } }),
    onSuccess: () => {
      toast.success("Account disconnected");
      queryClient.invalidateQueries({ queryKey: ["social-accounts", orgId] });
    },
    onError: () => toast.error("Could not disconnect that account"),
  });

  // Surface the result of a returning OAuth redirect. When this page is
  // loaded inside the connect popup, hand the result to the opener and close
  // the popup instead of rendering the dashboard in a small window.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const result = params.get("connect");
    if (!result) return;
    const payload = {
      type: "social-connect",
      result,
      added: params.get("added"),
      limit: params.get("limit"),
    };
    if (window.opener && !window.opener.closed) {
      window.opener.postMessage(payload, window.location.origin);
      window.close();
      return;
    }
    handleConnectResult(payload);
    navigate({ to: "/social-accounts", replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Listen for the popup's result while the dashboard stays open.
  useEffect(() => {
    function onMessage(event: MessageEvent) {
      if (event.origin !== window.location.origin) return;
      const data = event.data as
        | { type?: string; result?: string; added?: string | null; limit?: string | null }
        | null;
      if (!data || data.type !== "social-connect" || !data.result) return;
      handleConnectResult({
        result: data.result,
        added: data.added ?? null,
        limit: data.limit ?? null,
      });
    }
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orgId]);

  function handleConnectResult(payload: {
    result: string;
    added: string | null;
    limit: string | null;
  }) {
    if (payload.result === "success") {
      toast.success(
        payload.added && payload.added !== "0"
          ? `Connected ${payload.added} account${payload.added === "1" ? "" : "s"}`
          : "Nothing new to connect — check the account has the right permissions",
      );
      if (payload.limit) {
        toast.error(
          "Your plan's account limit is reached. Free plan: 1 Instagram, 1 Facebook, 1 YouTube. Upgrade to Pro to add more.",
        );
      }
      queryClient.invalidateQueries({ queryKey: ["social-accounts", orgId] });
    } else if (payload.result === "cancelled") {
      toast("Connection cancelled");
    } else if (payload.result === "expired") {
      toast.error("That connection link expired — try again");
    } else {
      toast.error("Connection failed. Please try again.");
    }
  }

  function handleConnect(platform: SocialPlatform) {
    if (!orgId) return;
    // Open the popup synchronously inside the click — browsers block
    // window.open called after an await, and feature-sized windows give us a
    // real dialog instead of a full tab. Location is assigned once the
    // signed OAuth URL is ready.
    const popup = window.open(
      "about:blank",
      "social_connect",
      "popup=yes,width=640,height=760,left=200,top=80",
    );
    if (!popup) {
      toast.error("Allow pop-ups for this site, then press Connect again.");
      return;
    }
    popup.document.title = "Connecting…";
    popup.document.body.style.cssText =
      "font-family:system-ui;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;color:#555";
    popup.document.body.textContent = "Taking you to the sign-in page…";
    setPending(platform);
    void (async () => {
      try {
        const result = await connectFn({
          data: { organizationId: orgId, platform, origin: window.location.origin },
        });
        if ("url" in result && result.url) {
          popup.location.href = result.url;
          toast("Finish the sign-in in the popup, then come back here.");
          return;
        }
        popup.close();
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
        popup.close();
        toast.error("Could not start the connection");
      } finally {
        setPending(null);
      }
    })();
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
          const planName = (activeOrg?.plan ?? "").toLowerCase();
          const limit = planName.startsWith("agency")
            ? Infinity
            : planName.startsWith("pro")
              ? 5
              : 1;
          const atLimit = count >= limit;
          return (
            <Panel key={platform}>
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
                    className="flex items-center gap-2 text-sm text-muted-foreground"
                  >
                    <CheckCircle2 className="size-3.5 text-success" />
                    {cap}
                  </li>
                ))}
              </ul>
              {atLimit ? (
                <Button asChild className="mt-4 w-full" variant="outline">
                  <Link to="/billing">
                    Plan limit reached ({count}/{limit}) — Upgrade
                  </Link>
                </Button>
              ) : (
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
              )}
            </Panel>
          );
        })}
      </div>

      <ProfessionalProfileGuide />

      <Panel className="mt-6" bodyClassName="p-0">
        <div className="flex items-center justify-between border-b px-5 py-4">
          <div>
            <p className="text-sm font-semibold">Connected accounts</p>
            <p className="text-xs text-muted-foreground">
              Access tokens are stored securely on the server and never sent to the browser.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-1">
          <Button
            variant="outline"
            size="sm"
            onClick={() => testComments.mutate()}
            disabled={!orgId || testComments.isPending}
          >
            {testComments.isPending ? <Loader2 className="size-4 animate-spin" /> : <CheckCircle2 className="size-4" />}
            Test Instagram comments
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => fixNotifications.mutate()}
            disabled={!orgId || fixNotifications.isPending}
          >
            {fixNotifications.isPending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <CheckCircle2 className="size-4" />
            )}
            Check & repair Meta
          </Button>
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
        </div>


        {accountsQuery.isLoading ? (
          <div className="flex items-center justify-center py-12 text-sm text-muted-foreground">
            <Loader2 className="mr-2 size-4 animate-spin" /> Loading accounts…
          </div>
        ) : accountsQuery.isError && !accountsQuery.data ? (
          <div role="alert" className="flex flex-wrap items-center justify-between gap-3 px-5 py-6 text-sm text-destructive"><span>Connected accounts unavailable. Your connections have not changed.</span><Button variant="outline" size="sm" disabled={accountsQuery.isFetching} onClick={() => void accountsQuery.refetch()}>Try again</Button></div>
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
                account.platform !== "youtube" &&
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

      <Panel className="mt-6" bodyClassName="p-0">
        <div className="flex items-center justify-between gap-3 border-b px-5 py-4">
          <div className="min-w-0">
            <p className="text-sm font-semibold">Live event feed</p>
            <p className="text-xs text-muted-foreground">
              Comments, messages and mentions arrive here in real time once your account is connected.
            </p>
          </div>
          {webhookConfigQuery.data ? (
            webhookConfigQuery.data.verifyTokenSet && webhookConfigQuery.data.appSecretSet ? (
              <StatusBadge tone="success">Endpoint ready</StatusBadge>
            ) : (
              <StatusBadge tone="warning">Setup needed</StatusBadge>
            )
          ) : null}
        </div>


        {eventsQuery.isLoading ? (
          <div className="flex items-center justify-center py-10 text-sm text-muted-foreground">
            <Loader2 className="mr-2 size-4 animate-spin" /> Loading events…
          </div>
        ) : (eventsQuery.data ?? []).length === 0 ? (
          <EmptyState
            icon={RefreshCw}
            title="No events yet"
            description="Once an account is connected and the webhook is subscribed, incoming activity shows up here."
          />
        ) : (
          <ul className="divide-y">
            {(eventsQuery.data ?? []).map((event) => (
              <li key={event.id} className="flex items-center gap-4 px-5 py-3">
                {event.platform ? <PlatformBadge platform={event.platform} /> : null}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{event.event_type}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {new Date(event.received_at).toLocaleString()}
                    {event.error ? ` — ${event.error}` : ""}
                  </p>
                </div>
                <StatusBadge
                  tone={
                    event.status === "failed"
                      ? "danger"
                      : event.status === "processed"
                        ? "success"
                        : "neutral"
                  }
                >
                  {event.status}
                </StatusBadge>
              </li>
            ))}
          </ul>
        )}
      </Panel>
      {orgId && (
        <div className="mt-6">
          <EntryPointsCard organizationId={orgId} />
        </div>
      )}
    </AppShell>
  );
}
