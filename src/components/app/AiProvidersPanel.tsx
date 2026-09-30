import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";

import { Panel, StatusBadge } from "@/components/app/primitives";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { getAiProviderStatus, saveAiProviders, testAiProviders } from "@/lib/ai-providers.functions";

const KEEP = "__keep__";

/**
 * Keys are write-only from the browser: the server never sends them back, so
 * the fields stay empty and "leave unchanged" is the default on save.
 */
export function AiProvidersPanel() {
  const fetchStatus = useServerFn(getAiProviderStatus);
  const save = useServerFn(saveAiProviders);
  const test = useServerFn(testAiProviders);
  const qc = useQueryClient();

  const { data: status } = useQuery({
    queryKey: ["ai-providers"],
    queryFn: () => fetchStatus(),
    retry: false,
  });

  const [enabled, setEnabled] = useState(true);
  const [useLovable, setUseLovable] = useState(true);
  const [openRouterKeys, setOpenRouterKeys] = useState("");
  const [openRouterModel, setOpenRouterModel] = useState("");
  const [nvidiaKey, setNvidiaKey] = useState("");
  const [nvidiaModel, setNvidiaModel] = useState("");
  const [openAiKey, setOpenAiKey] = useState("");
  const [openAiModel, setOpenAiModel] = useState("");
  const [maxCalls, setMaxCalls] = useState("600");

  useEffect(() => {
    if (!status) return;
    setEnabled(status.enabled);
    setUseLovable(status.useLovableFallback);
    setOpenRouterModel(status.openRouter.model);
    setNvidiaModel(status.nvidia.model);
    setOpenAiModel(status.openAi.model);
    setMaxCalls(String(status.maxCallsPerHour));
  }, [status]);

  const mutation = useMutation({
    mutationFn: () => {
      const typed = openRouterKeys
        .split(/[\s,;]+/)
        .map((k) => k.trim())
        .filter(Boolean);
      return save({
        data: {
          enabled,
          openRouterKeys: typed.length > 0 ? typed : [KEEP],
          openRouterModel,
          nvidiaKey,
          nvidiaModel,
          openAiKey,
          openAiModel,
          useLovableFallback: useLovable,
          maxCallsPerHour: Math.max(1, Number(maxCalls) || 600),
        },
      });
    },
    onSuccess: () => {
      toast.success("AI providers saved");
      setOpenRouterKeys("");
      setNvidiaKey("");
      setOpenAiKey("");
      void qc.invalidateQueries({ queryKey: ["ai-providers"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message.slice(0, 160) : "Could not save"),
  });

  const testMutation = useMutation({
    mutationFn: async () => {
      // Keys typed but not saved yet would be ignored by the test — save them first.
      if (openRouterKeys.trim() || nvidiaKey.trim() || openAiKey.trim()) {
        await mutation.mutateAsync();
      }
      return test();
    },
    onSuccess: (r) => {
      if (r.provider) {
        toast.success(`${r.provider} answered: ${r.sample ?? ""}`.slice(0, 180));
        return;
      }
      const tried = r.attempts.filter((a) => a.provider !== "lovable" || r.attempts.length === 1);
      const noKeys = !r.attempts.some((a) => a.provider !== "lovable");
      const detail = tried.map((a) => `${a.provider}: ${a.error}`).join(" · ");
      toast.error(
        noKeys
          ? "No OpenRouter/NVIDIA/OpenAI key is saved yet. Paste the key, click Save AI providers, then test again."
          : `No provider answered. ${detail}`.slice(0, 300),
        { duration: 12000 },
      );
    },
    onError: (e) => toast.error(e instanceof Error ? e.message.slice(0, 160) : "Test could not run"),
  });

  if (!status) return null;

  return (
    <Panel title="AI providers & automatic failover">
      <p className="mb-4 text-sm text-muted-foreground">
        Replies try each provider in order. When one runs out of credits or gets rate limited, the next
        one takes over automatically. Keys are stored securely on the server and are never shown again
        after saving.
      </p>

      <div className="mb-5 flex items-center justify-between gap-4">
        <div>
          <p className="text-sm font-medium">Smart AI replies</p>
          <p className="text-sm text-muted-foreground">
            Off means comment replies use the built-in wording only.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <StatusBadge tone={enabled ? "success" : "neutral"}>{enabled ? "On" : "Off"}</StatusBadge>
          <Switch checked={enabled} onCheckedChange={setEnabled} />
        </div>
      </div>

      <div className="space-y-5">
        <div className="rounded-lg border p-4">
          <div className="mb-2 flex items-center justify-between gap-3">
            <p className="text-sm font-medium">1. OpenRouter (multiple keys)</p>
            <StatusBadge tone={status.openRouter.count > 0 ? "success" : "neutral"}>
              {status.openRouter.count} saved
            </StatusBadge>
          </div>
          {status.openRouter.masked.length > 0 && (
            <p className="mb-2 font-mono text-xs text-muted-foreground">
              {status.openRouter.masked.join("  ·  ")}
            </p>
          )}
          <Textarea
            rows={4}
            value={openRouterKeys}
            onChange={(e) => setOpenRouterKeys(e.target.value)}
            placeholder={"One key per line. Leave empty to keep the saved keys.\nsk-or-v1-…\nsk-or-v1-…"}
          />
          <label className="mt-3 block text-xs text-muted-foreground">
            Model
            <Input value={openRouterModel} onChange={(e) => setOpenRouterModel(e.target.value)} />
          </label>
          <p className="mt-2 text-xs text-muted-foreground">
            Keys are used top to bottom. If key 1 has no credits left, key 2 is used for the next reply.
            {status.openRouter.fromEnv > 0
              ? ` ${status.openRouter.fromEnv} key(s) also come from the server environment.`
              : ""}
          </p>
        </div>

        <div className="rounded-lg border p-4">
          <div className="mb-2 flex items-center justify-between gap-3">
            <p className="text-sm font-medium">2. NVIDIA</p>
            <StatusBadge tone={status.nvidia.configured ? "success" : "neutral"}>
              {status.nvidia.configured ? status.nvidia.masked : "Not set"}
            </StatusBadge>
          </div>
          <Input
            type="password"
            autoComplete="off"
            value={nvidiaKey}
            onChange={(e) => setNvidiaKey(e.target.value)}
            placeholder="nvapi-…  (leave empty to keep the saved key)"
          />
          <label className="mt-3 block text-xs text-muted-foreground">
            Model
            <Input value={nvidiaModel} onChange={(e) => setNvidiaModel(e.target.value)} />
          </label>
        </div>

        <div className="rounded-lg border p-4">
          <div className="mb-2 flex items-center justify-between gap-3">
            <p className="text-sm font-medium">3. OpenAI</p>
            <StatusBadge tone={status.openAi.configured ? "success" : "neutral"}>
              {status.openAi.configured ? status.openAi.masked : "Not set"}
            </StatusBadge>
          </div>
          <Input
            type="password"
            autoComplete="off"
            value={openAiKey}
            onChange={(e) => setOpenAiKey(e.target.value)}
            placeholder="sk-…  (leave empty to keep the saved key)"
          />
          <label className="mt-3 block text-xs text-muted-foreground">
            Model
            <Input value={openAiModel} onChange={(e) => setOpenAiModel(e.target.value)} />
          </label>
        </div>

        <div className="rounded-lg border p-4">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-medium">4. Built-in AI (last resort)</p>
              <p className="text-sm text-muted-foreground">
                {status.lovableConfigured ? "Available" : "Not configured on this server"}
              </p>
            </div>
            <Switch checked={useLovable} onCheckedChange={setUseLovable} />
          </div>
        </div>

        <div className="rounded-lg border p-4">
          <p className="text-sm font-medium">Spending &amp; spam guard</p>
          <p className="mb-3 text-sm text-muted-foreground">
            Maximum AI replies per workspace per hour. Protects you from a comment flood draining credits.
          </p>
          <Input
            className="max-w-40"
            inputMode="numeric"
            value={maxCalls}
            onChange={(e) => setMaxCalls(e.target.value.replace(/\D/g, ""))}
          />
        </div>
      </div>

      <div className="mt-5 flex flex-wrap gap-3">
        <Button disabled={mutation.isPending} onClick={() => mutation.mutate()}>
          {mutation.isPending ? "Saving…" : "Save AI providers"}
        </Button>
        <Button variant="outline" disabled={testMutation.isPending} onClick={() => testMutation.mutate()}>
          {testMutation.isPending ? "Testing…" : "Test which provider answers"}
        </Button>
      </div>
    </Panel>
  );
}
