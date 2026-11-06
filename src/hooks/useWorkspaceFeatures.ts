import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useTenant } from "@/hooks/useTenant";
import { getWorkspaceFeatures } from "@/lib/workspace-features.functions";

/** Merged feature switches (platform + Super Admin override) for the active workspace. */
export function useWorkspaceFeatures() {
  const { activeOrg } = useTenant();
  const fetch = useServerFn(getWorkspaceFeatures);
  const orgId = activeOrg?.id ?? null;
  return useQuery({
    queryKey: ["workspace-features", orgId],
    queryFn: () => fetch({ data: { orgId } }),
    enabled: !!orgId,
    staleTime: 60_000,
  });
}
