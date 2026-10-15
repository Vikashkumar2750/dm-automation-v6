import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getPlatformStatus } from "@/lib/platform-status.functions";

/** Workflows section is off unless a Super Admin turns on `workflows_enabled`. */
export function useWorkflowsEnabled() {
  const fetchStatus = useServerFn(getPlatformStatus);
  const q = useQuery({ queryKey: ["platform-status"], queryFn: () => fetchStatus(), staleTime: 60_000 });
  return q.data?.workflowsEnabled === true;
}
