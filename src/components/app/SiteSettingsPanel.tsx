import { useMutation, useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Panel } from "@/components/app/primitives";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { getSiteSettings, saveSiteSettings } from "@/lib/site-settings.functions";

const FIELDS = [
  { key: "ga4Id", label: "Google Analytics 4 ID", ph: "G-XXXXXXXXXX" },
  { key: "gtmId", label: "Google Tag Manager ID", ph: "GTM-XXXXXXX" },
  { key: "adsenseId", label: "AdSense publisher ID", ph: "ca-pub-1234567890123456" },
  { key: "metaPixelId", label: "Meta Pixel ID", ph: "123456789012345" },
  { key: "googleVerification", label: "Search Console verification code", ph: "content value of google-site-verification" },
  { key: "bingVerification", label: "Bing Webmaster verification code", ph: "content value of msvalidate.01" },
] as const;

type Tracking = Record<(typeof FIELDS)[number]["key"], string> & { requireConsent: boolean };

export function SiteSettingsPanel() {
  const fetch = useServerFn(getSiteSettings);
  const save = useServerFn(saveSiteSettings);
  const { data, refetch } = useQuery({ queryKey: ["site-settings"], queryFn: () => fetch(), retry: false });
  const [t, setT] = useState<Tracking | null>(null);
  const [limit, setLimit] = useState(5);
  useEffect(() => {
    if (data) {
      setT(data.tracking);
      setLimit(data.aiDailyLimit);
    }
  }, [data]);

  const m = useMutation({
    mutationFn: () => save({ data: { tracking: t!, aiDailyLimit: limit } }),
    onSuccess: () => {
      toast.success("Saved — live within 5 minutes");
      void refetch();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (!t) return null;
  return (
    <>
      <Panel title="AI assistant limit">
        <div className="flex flex-wrap items-end gap-3">
          <div className="space-y-2">
            <Label htmlFor="ai-limit">AI requests per user per day</Label>
            <Input id="ai-limit" type="number" min={0} max={1000} className="w-40" value={limit} onChange={(e) => setLimit(Math.max(0, Math.min(1000, Number(e.target.value) || 0)))} />
          </div>
          <p className="pb-2 text-sm text-muted-foreground">Captions, reply drafts and rule ideas each count as one. 0 turns it off.</p>
        </div>
      </Panel>
      <Panel title="Tracking & site verification">
        <div className="grid gap-4 sm:grid-cols-2">
          {FIELDS.map((f) => (
            <div key={f.key} className="space-y-2">
              <Label htmlFor={f.key}>{f.label}</Label>
              <Input id={f.key} value={t[f.key]} placeholder={f.ph} onChange={(e) => setT({ ...t, [f.key]: e.target.value.trim() })} />
            </div>
          ))}
        </div>
        <div className="mt-4 flex items-center gap-3">
          <Switch checked={t.requireConsent} onCheckedChange={(v) => setT({ ...t, requireConsent: v })} />
          <Label>Ask visitors for cookie consent before loading analytics & ads</Label>
        </div>
        <p className="mt-3 text-xs text-muted-foreground">
          Paste only the ID or the code value (not the full script). Verification tags are added to every public page automatically.
        </p>
      </Panel>
      <Button disabled={m.isPending} onClick={() => m.mutate()}>Save AI limit & tracking</Button>
    </>
  );
}
