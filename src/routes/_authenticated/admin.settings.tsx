import { createFileRoute } from "@tanstack/react-router";
import { AdminSafetyCapsPanel } from "@/components/app/AdminSafetyCapsPanel";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { PageHeader, Panel, StatusBadge } from "@/components/app/primitives";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { publishingMode, publishingModeFlags, type PublishingMode } from "@/lib/publishing-availability";
import { EmailAndResetPanels } from "@/components/app/PlatformConfigPanels";
import { AiProvidersPanel } from "@/components/app/AiProvidersPanel";
import { EntryPointsAdminPanel } from "@/components/app/EntryPointsPanels";
import { FlowsAdminPanel } from "@/components/app/FlowsAdminPanel";
import { AiAgentAdminPanel } from "@/components/app/AiAgentAdminPanel";
import { SiteSettingsPanel } from "@/components/app/SiteSettingsPanel";
import { getPlatformSettings, updatePlatformSettings } from "@/lib/admin.functions";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { RetainedSettingsTab } from "@/components/app/RetainedSettingsTab";
import { RefreshCw } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/settings")({
  head: () => ({
    meta: [
      { title: "System Settings — Techaasvik Operations" },
      { name: "description", content: "Global send pause, incident banner and feature flags." },
      { property: "og:title", content: "System Settings — Techaasvik Operations" },
      { property: "og:description", content: "Platform-wide controls for the operations team." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: SystemSettingsPage,
});

const FLAGS: { key: string; label: string; description: string }[] = [
  { key: "maintenance_mode", label: "Maintenance mode", description: "Everyone except super admins sees a maintenance page." },
  { key: "registration_blocked", label: "Block new registrations", description: "Sign-up form is closed for new users." },
  { key: "workflows_enabled", label: "Workflows section", description: "Show the post-wise Workflows page to all workspaces. Off by default." },
  { key: "ai_assistant", label: "AI assistant", description: "Caption and reply generation." },
  { key: "white_label", label: "White-label branding", description: "Agency plan branding." },
  { key: "self_serve_billing", label: "Self-serve billing", description: "Online plan upgrades." },
];

function SystemSettingsPage() {
  const fetchSettings = useServerFn(getPlatformSettings);
  const save = useServerFn(updatePlatformSettings);
  const queryClient = useQueryClient();

  const settings = useQuery({
    queryKey: ["platform-settings"],
    queryFn: () => fetchSettings(),
    retry: false,
  });
  const { data } = settings;
  const [tab, setTab] = useState("operations");
  const [visited, setVisited] = useState(["operations"]);
  const tabProps = { active: tab, visited };

  const [banner, setBanner] = useState("");
  useEffect(() => {
    setBanner(data?.incident_banner ?? "");
  }, [data?.incident_banner]);

  const mutation = useMutation({
    mutationFn: (vars: {
      globalSendPaused?: boolean;
      incidentBanner?: string | null;
      featureFlags?: Record<string, boolean>;
    }) => save({ data: vars }),
    onSuccess: () => {
      toast.success("Settings saved");
      void queryClient.invalidateQueries({ queryKey: ["platform-settings"] });
      void queryClient.invalidateQueries({ queryKey: ["platform-overview"] });
      void queryClient.invalidateQueries({ queryKey: ["platform-status"] });
    },
    onError: () => toast.error("Could not save settings"),
  });

  const flags = data?.feature_flags ?? {};

  return (
    <div className="space-y-6">
      <PageHeader
        title="System Settings"
        description="Platform-wide controls. Changes here affect every workspace."
        actions={<Button variant="outline" size="icon" aria-label="Refresh system settings" title="Refresh system settings" onClick={() => void settings.refetch()} disabled={settings.isFetching}><RefreshCw className={settings.isFetching ? "size-4 animate-spin" : "size-4"} /></Button>}
      />
      {settings.isError && <div role="alert" className="flex flex-wrap items-center justify-between gap-3 border-l-2 border-warning bg-warning-soft px-4 py-3 text-sm"><span>System settings could not be refreshed.</span><Button variant="outline" size="sm" onClick={() => void settings.refetch()}>Try again</Button></div>}
      <Tabs value={tab} onValueChange={(value) => { setTab(value); setVisited((previous) => previous.includes(value) ? previous : [...previous, value]); }} className="min-w-0">
        <TabsList aria-label="System settings sections" className="mb-4 w-full justify-start">{[["operations", "Operations & Safety"], ["publishing", "Publishing"], ["automation", "Automation"], ["ai", "AI Providers"], ["site", "Site & Tracking"], ["email", "Email & Account Access"]].map(([value, label]) => <TabsTrigger key={value} value={value ?? ""}>{label}</TabsTrigger>)}</TabsList>
      <RetainedSettingsTab value="operations" {...tabProps}>

      <Panel title="Global sending">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-sm font-medium">Pause all automated sending</p>
            <p className="text-sm text-muted-foreground">
              Stops every automated reply platform-wide. Inbox replies by people keep working.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <StatusBadge tone={data?.global_send_paused ? "danger" : "success"}>
              {!data ? "Unavailable" : data.global_send_paused ? "Paused" : "Running"}
            </StatusBadge>
            <Switch
              checked={Boolean(data?.global_send_paused)}
              aria-label="Pause all automated sending"
              disabled={!data || mutation.isPending}
              onCheckedChange={(v) => mutation.mutate({ globalSendPaused: v })}
            />
          </div>
        </div>
      </Panel>

      <Panel title="Incident banner">
        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-64 flex-1">
            <label className="text-sm font-medium" htmlFor="banner">
              Message shown in the console
            </label>
            <Input
              id="banner"
              value={banner}
              maxLength={300}
              onChange={(e) => setBanner(e.target.value)}
              placeholder="e.g. Instagram delivery is delayed"
              className="mt-2"
            />
          </div>
          <Button disabled={!data || mutation.isPending} onClick={() => mutation.mutate({ incidentBanner: banner })}>Save</Button>
          <Button
            variant="outline"
            disabled={!data || mutation.isPending}
            onClick={() => {
              setBanner("");
              mutation.mutate({ incidentBanner: null });
            }}
          >
            Clear
          </Button>
        </div>
      </Panel>

      <AdminSafetyCapsPanel orgId={null} />
      </RetainedSettingsTab>

      <RetainedSettingsTab value="publishing" {...tabProps}>
      <Panel title="Publishing tabs">
        <div className="space-y-4">
          {([{ key: "create_post", label: "Create Post" }, { key: "calendar", label: "Calendar" }] as const).map((feature) => (
            <div key={feature.key} className="flex flex-wrap items-center justify-between gap-3">
              <label id={`${feature.key}-label`} className="text-sm font-medium">{feature.label}</label>
              <Select value={publishingMode(flags, feature.key)} disabled={!data || mutation.isPending} onValueChange={(mode) => mutation.mutate({ featureFlags: publishingModeFlags(feature.key, mode as PublishingMode) })}>
                <SelectTrigger aria-labelledby={`${feature.key}-label`} className="w-44"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="enabled">Enabled</SelectItem>
                  <SelectItem value="hidden">Hidden</SelectItem>
                  <SelectItem value="coming_soon">Coming soon</SelectItem>
                </SelectContent>
              </Select>
            </div>
          ))}
        </div>
      </Panel>
      </RetainedSettingsTab>

      <RetainedSettingsTab value="automation" {...tabProps}>
      <Panel title="Feature flags">
        <div className="space-y-4">
          {FLAGS.map((f) => (
            <div key={f.key} className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-medium">{f.label}</p>
                <p className="text-sm text-muted-foreground">{f.description}</p>
              </div>
              <Switch
                aria-label={f.label}
                disabled={!data || mutation.isPending}
                checked={Boolean(flags[f.key])}
                onCheckedChange={(v) =>
                  mutation.mutate({ featureFlags: { ...flags, [f.key]: v } })
                }
              />
            </div>
          ))}
        </div>
      </Panel>
      <EntryPointsAdminPanel />
      <FlowsAdminPanel />
      <AiAgentAdminPanel />
      </RetainedSettingsTab>
      <RetainedSettingsTab value="ai" {...tabProps}><AiProvidersPanel /></RetainedSettingsTab>
      <RetainedSettingsTab value="site" {...tabProps}>
      <SiteSettingsPanel />
      </RetainedSettingsTab>
      <RetainedSettingsTab value="email" {...tabProps}>
      <EmailAndResetPanels />
      </RetainedSettingsTab>
      </Tabs>
    </div>
  );
}
