import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Panel } from "@/components/app/primitives";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { getAgentFlags, saveAgentFlags } from "@/lib/ai-agent.functions";

/** Super Admin switch for the Phase C AI agent (off by default). */
export function AiAgentAdminPanel() {
  const qc = useQueryClient();
  const fetchFlags = useServerFn(getAgentFlags);
  const saveFlags = useServerFn(saveAgentFlags);
  const q = useQuery({ queryKey: ["ai-agent-flags"], queryFn: () => fetchFlags() });
  const [enabled, setEnabled] = useState(false);
  const [orgs, setOrgs] = useState("");
  useEffect(() => {
    if (q.data) { setEnabled(q.data.enabled); setOrgs(q.data.orgs.join("\n")); }
  }, [q.data]);
  const m = useMutation({
    mutationFn: () => saveFlags({ data: { enabled, orgs: orgs.split(/[\s,]+/).map((s) => s.trim()).filter(Boolean) } }),
    onSuccess: () => { toast.success("AI agent setting saved"); qc.invalidateQueries({ queryKey: ["ai-agent-flags"] }); },
    onError: (e) => toast.error((e as Error).message.includes("uuid") ? "Workspace IDs look invalid" : "Could not save"),
  });
  return (
    <Panel>
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="font-semibold">AI agent for DMs</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Off by default. Lets workspaces turn on an AI agent that answers DMs from their own knowledge, only when no keyword rule or flow replied. Unsure answers go to a person. Uses the AI keys set above.
          </p>
        </div>
        <Switch checked={enabled} onCheckedChange={setEnabled} aria-label="Enable AI agent" />
      </div>
      <div className="mt-4 grid gap-2">
        <Label>Only these workspace IDs (leave empty for everyone)</Label>
        <textarea value={orgs} onChange={(e) => setOrgs(e.target.value)} rows={3}
          className="rounded-md border border-input bg-background px-3 py-2 text-sm" placeholder="One workspace ID per line" />
      </div>
      <Button className="mt-4" onClick={() => m.mutate()} disabled={m.isPending}>Save</Button>
    </Panel>
  );
}
