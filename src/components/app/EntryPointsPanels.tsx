import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Panel, StatusBadge } from "@/components/app/primitives";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  getEntryConfig,
  getEntryPointsFlags,
  saveEntryConfig,
  saveEntryPointsFlags,
  syncEntryConfig,
} from "@/lib/entry-points.functions";
import { ENTRY_PRESETS } from "@/lib/flow-templates";
import { GuideButton } from "@/components/app/GuideButton";

/** Super Admin switch for Phase A entry points (off by default). */
export function EntryPointsAdminPanel() {
  const qc = useQueryClient();
  const fetchFlags = useServerFn(getEntryPointsFlags);
  const saveFlags = useServerFn(saveEntryPointsFlags);
  const q = useQuery({ queryKey: ["entry-points-flags"], queryFn: () => fetchFlags() });
  const [enabled, setEnabled] = useState(false);
  const [orgs, setOrgs] = useState("");
  useEffect(() => {
    if (q.data) {
      setEnabled(q.data.enabled);
      setOrgs(q.data.orgs.join("\n"));
    }
  }, [q.data]);
  const m = useMutation({
    mutationFn: () =>
      saveFlags({
        data: {
          enabled,
          orgs: orgs.split(/[\s,]+/).map((s) => s.trim()).filter(Boolean),
        },
      }),
    onSuccess: () => {
      toast.success("Entry points setting saved");
      qc.invalidateQueries({ queryKey: ["entry-points-flags"] });
    },
    onError: (e) => toast.error((e as Error).message.includes("uuid") ? "Workspace IDs look invalid" : "Could not save"),
  });
  return (
    <Panel>
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="font-semibold">Story & DM entry points</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Story reply and story mention rules, ice breakers and Messenger menu. Off by default; existing comment and DM automations are never affected.
          </p>
        </div>
        <Switch checked={enabled} onCheckedChange={setEnabled} aria-label="Enable entry points" />
      </div>
      <div className="mt-4 grid gap-2">
        <Label>Only these workspace IDs (leave empty for everyone)</Label>
        <textarea
          className="min-h-20 rounded-md border border-input bg-background p-2 font-mono text-xs"
          value={orgs}
          onChange={(e) => setOrgs(e.target.value)}
          placeholder="One workspace ID per line"
        />
      </div>
      <Button className="mt-3" onClick={() => m.mutate()} disabled={m.isPending}>
        Save
      </Button>
    </Panel>
  );
}

/** Workspace card: ice breakers + Messenger persistent menu. Hidden when off. */
export function EntryPointsCard({ organizationId }: { organizationId: string }) {
  const qc = useQueryClient();
  const fetchCfg = useServerFn(getEntryConfig);
  const saveCfg = useServerFn(saveEntryConfig);
  const sync = useServerFn(syncEntryConfig);
  const q = useQuery({
    queryKey: ["entry-points", organizationId],
    queryFn: () => fetchCfg({ data: { organizationId } }),
  });
  const [questions, setQuestions] = useState<string[]>(["", "", "", ""]);
  const [menu, setMenu] = useState<Array<{ title: string; url: string }>>([]);
  useEffect(() => {
    if (!q.data) return;
    const qs = q.data.config.iceBreakers.map((b) => b.question);
    setQuestions([...qs, "", "", "", ""].slice(0, 4));
    setMenu(q.data.config.menu.map((m) => ({ title: m.title, url: m.url ?? "" })));
  }, [q.data]);

  const save = useMutation({
    mutationFn: () =>
      saveCfg({
        data: {
          organizationId,
          iceBreakers: questions.map((s) => s.trim()).filter(Boolean).map((question) => ({ question })),
          menu: menu
            .filter((m) => m.title.trim())
            .map((m) => ({ title: m.title.trim(), url: m.url.trim() || null })),
        },
      }),
    onSuccess: () => {
      toast.success("Saved. Click “Sync to Meta” to publish.");
      qc.invalidateQueries({ queryKey: ["entry-points", organizationId] });
    },
    onError: () => toast.error("Could not save — menu links must start with https://"),
  });
  const [lastSync, setLastSync] = useState<{ at: string; results: Array<{ account: string; platform: string; ok: boolean; error?: string }> } | null>(null);
  const push = useMutation({
    mutationFn: () => sync({ data: { organizationId } }),
    onSuccess: (r) => {
      setLastSync({ at: new Date().toLocaleTimeString(), results: r.results });
      const failed = r.results.filter((x) => !x.ok);
      if (r.results.length === 0) toast.info("No Instagram or Facebook account connected");
      else if (failed.length === 0) toast.success(`Synced to ${r.results.length} account(s)`);
      else toast.warning(`${failed.length} account(s) failed: ${failed[0]!.error}`);
    },
    onError: () => toast.error("Sync failed"),
  });

  if (q.data && !q.data.enabled) {
    return (
      <Panel>
        <h3 className="font-semibold">Ice breakers & menu</h3>
        <p className="mt-1 text-sm text-muted-foreground">This feature is switched off for your workspace. Contact support to turn it on.</p>
      </Panel>
    );
  }
  if (!q.data) return null;
  return (
    <Panel>
      <div className="flex items-center justify-between gap-3">
        <h3 className="font-semibold">Ice breakers & menu</h3>
        <div className="flex items-center gap-2">
          <GuideButton guide="entry-points" />
          <StatusBadge tone="neutral">Beta</StatusBadge>
        </div>
      </div>
      {lastSync ? (
        <div className="mt-3 rounded-md border p-3 text-xs">
          <p className="font-medium">Last sync at {lastSync.at}</p>
          {lastSync.results.length === 0 ? <p className="text-muted-foreground">No Instagram or Facebook account connected.</p> : null}
          {lastSync.results.map((r, i) => (
            <p key={i} className={r.ok ? "text-foreground" : "text-destructive"}>
              {r.ok ? "✓" : "✗"} {r.account} ({r.platform}) — {r.ok ? "live on Meta" : r.error === "needs_reconnect" ? "reconnect this account first" : r.error}
            </p>
          ))}
        </div>
      ) : null}
      <p className="mt-1 text-sm text-muted-foreground">
        Questions people see when they open your DMs for the first time. To answer one, create a “New DM” rule with the question as its keyword.
      </p>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <span className="text-xs text-muted-foreground">Use a ready-made set:</span>
        {ENTRY_PRESETS.map((p) => (
          <Button key={p.key} size="sm" variant="outline" onClick={() => {
            setQuestions([...p.questions, "", "", "", ""].slice(0, 4));
            setMenu(p.menu.map((m) => ({ ...m })));
            toast.info("Preset filled in — change links if needed, then Save and Sync to Meta.");
          }}>{p.label}</Button>
        ))}
      </div>
      <div className="mt-4 grid gap-2">
        {questions.map((v, i) => (
          <Input
            key={i}
            value={v}
            maxLength={80}
            placeholder={`Question ${i + 1}`}
            onChange={(e) => setQuestions(questions.map((x, j) => (j === i ? e.target.value : x)))}
          />
        ))}
      </div>
      <div className="mt-5">
        <Label>Messenger menu (Facebook only, up to 5)</Label>
        <div className="mt-2 grid gap-2">
          {menu.map((m, i) => (
            <div key={i} className="grid grid-cols-[1fr_1.5fr_auto] gap-2">
              <Input value={m.title} maxLength={30} placeholder="Title"
                onChange={(e) => setMenu(menu.map((x, j) => (j === i ? { ...x, title: e.target.value } : x)))} />
              <Input value={m.url} placeholder="https://… (empty = quick answer)"
                onChange={(e) => setMenu(menu.map((x, j) => (j === i ? { ...x, url: e.target.value } : x)))} />
              <Button variant="ghost" onClick={() => setMenu(menu.filter((_, j) => j !== i))}>Remove</Button>
            </div>
          ))}
          {menu.length < 5 && (
            <Button variant="outline" size="sm" className="w-fit" onClick={() => setMenu([...menu, { title: "", url: "" }])}>
              Add menu item
            </Button>
          )}
        </div>
      </div>
      <div className="mt-4 flex gap-2">
        <Button onClick={() => save.mutate()} disabled={save.isPending}>Save</Button>
        <Button variant="outline" onClick={() => push.mutate()} disabled={push.isPending}>Sync to Meta</Button>
      </div>
    </Panel>
  );
}
