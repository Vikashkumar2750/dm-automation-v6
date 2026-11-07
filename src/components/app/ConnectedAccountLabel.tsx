import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listSocialAccounts } from "@/lib/social-accounts.functions";

export function ConnectedAccountLabel({ orgId, accountId, replying = false }: { orgId: string | null | undefined; accountId: string | null | undefined; replying?: boolean }) {
  const fetchAccounts = useServerFn(listSocialAccounts);
  const accounts = useQuery({ queryKey: ["social-accounts", orgId], enabled: !!orgId, staleTime: 60_000, queryFn: () => {
    if (!orgId) throw new Error("Workspace unavailable");
    return fetchAccounts({ data: { organizationId: orgId } });
  } });
  const account = accounts.data?.find((item) => item.id === accountId);
  const label = account ? account.handle ? `@${account.handle.replace(/^@/, "")}` : account.name : "Account unavailable";
  return <span className="block truncate text-xs text-muted-foreground" title={label}>{replying ? "Replying as " : ""}{label}</span>;
}