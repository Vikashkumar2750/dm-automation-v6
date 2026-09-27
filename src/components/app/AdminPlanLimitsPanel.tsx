import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Panel } from "@/components/app/primitives";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getOrgLimitOverride, saveOrgLimitOverride } from "@/lib/plan-limits.functions";

const toNum = (v: string) => (v.trim() === "" ? null : Math.max(0, parseInt(v, 10) || 0));

export function AdminPlanLimitsPanel({ orgId }: { orgId: string }) {
  const fetchOv = useServerFn(getOrgLimitOverride);
  const save = useServerFn(saveOrgLimitOverride);
  const qc = useQueryClient();
  const { data, isFetched } = useQuery({
    queryKey: ["admin-org-limits", orgId],
    queryFn: () => fetchOv({ data: { organizationId: orgId } }),
    retry: false,
  });
  const [dms, setDms] = useState("");
  const [rules, setRules] = useState("");
  useEffect(() => {
    setDms(data?.monthlyDms != null ? String(data.monthlyDms) : "");
    setRules(data?.maxRules != null ? String(data.maxRules) : "");
  }, [data]);

  const m = useMutation({
    mutationFn: (override: { monthlyDms: number | null; maxRules: number | null } | null) =>
      save({ data: { organizationId: orgId, override } }),
    onSuccess: () => {
      toast.success("Plan limits saved");
      void qc.invalidateQueries({ queryKey: ["admin-org-limits", orgId] });
    },
    onError: (e: Error) => toast.error(e.message || "Could not save"),
  });

  return (
    <Panel title="Plan limits override">
      <p className="mb-3 text-sm text-muted-foreground">
        {data ? "This workspace uses custom limits." : "This workspace follows its plan's limits."} Leave a box empty for unlimited.
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="text-sm">
          <span className="font-medium">Automated DMs / month</span>
          <Input className="mt-1" inputMode="numeric" value={dms} onChange={(e) => setDms(e.target.value)} />
        </label>
        <label className="text-sm">
          <span className="font-medium">Active automation rules</span>
          <Input className="mt-1" inputMode="numeric" value={rules} onChange={(e) => setRules(e.target.value)} />
        </label>
      </div>
      <div className="mt-3 flex gap-2">
        <Button disabled={!isFetched || m.isPending} onClick={() => m.mutate({ monthlyDms: toNum(dms), maxRules: toNum(rules) })}>
          Save override
        </Button>
        <Button variant="outline" disabled={!data || m.isPending} onClick={() => m.mutate(null)}>
          Use plan limits
        </Button>
      </div>
    </Panel>
  );
}
