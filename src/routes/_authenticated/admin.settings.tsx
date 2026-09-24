import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { PageHeader, Panel, StatusBadge } from "@/components/app/primitives";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { getPlatformSettings, updatePlatformSettings } from "@/lib/admin.functions";

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
  { key: "ai_assistant", label: "AI assistant", description: "Caption and reply generation." },
  { key: "youtube", label: "YouTube publishing", description: "Not live yet — keep off." },
  { key: "white_label", label: "White-label branding", description: "Agency plan branding." },
  { key: "self_serve_billing", label: "Self-serve billing", description: "Online plan upgrades." },
];

function SystemSettingsPage() {
  const fetchSettings = useServerFn(getPlatformSettings);
  const save = useServerFn(updatePlatformSettings);
  const queryClient = useQueryClient();

  const { data } = useQuery({
    queryKey: ["platform-settings"],
    queryFn: () => fetchSettings(),
    retry: false,
  });

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
    },
    onError: () => toast.error("Could not save settings"),
  });

  const flags = data?.feature_flags ?? {};

  return (
    <div className="space-y-6">
      <PageHeader
        title="System Settings"
        description="Platform-wide controls. Changes here affect every workspace."
      />

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
              {data?.global_send_paused ? "Paused" : "Running"}
            </StatusBadge>
            <Switch
              checked={Boolean(data?.global_send_paused)}
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
          <Button onClick={() => mutation.mutate({ incidentBanner: banner })}>Save</Button>
          <Button
            variant="outline"
            onClick={() => {
              setBanner("");
              mutation.mutate({ incidentBanner: null });
            }}
          >
            Clear
          </Button>
        </div>
      </Panel>

      <Panel title="Feature flags">
        <div className="space-y-4">
          {FLAGS.map((f) => (
            <div key={f.key} className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-medium">{f.label}</p>
                <p className="text-sm text-muted-foreground">{f.description}</p>
              </div>
              <Switch
                checked={Boolean(flags[f.key])}
                onCheckedChange={(v) =>
                  mutation.mutate({ featureFlags: { ...flags, [f.key]: v } })
                }
              />
            </div>
          ))}
        </div>
      </Panel>
    </div>
  );
}
