import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listSocialAccounts } from "@/lib/social-accounts.functions";

const LABEL: Record<string, string> = { instagram: "Instagram", facebook: "Facebook", youtube: "YouTube" };

/** Shared "which connected account?" picker. Value "all" = every account. */
export function AccountSelect({ orgId, platform, value, onChange, className = "" }: {
  orgId: string | null;
  platform?: string;
  value: string;
  onChange: (id: string) => void;
  className?: string;
}) {
  const fetchAccounts = useServerFn(listSocialAccounts);
  const { data = [] } = useQuery({
    queryKey: ["social-accounts", orgId],
    enabled: !!orgId,
    staleTime: 60_000,
    queryFn: () => fetchAccounts({ data: { organizationId: orgId! } }),
  });
  const accounts = data.filter((a) => !platform || platform === "all" || a.platform === platform);
  if (data.length < 2) return null;
  return (
    <select
      aria-label="Connected account"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={`h-8 w-full min-w-0 rounded-md border bg-background px-2 text-xs outline-none focus:ring-2 focus:ring-ring ${className}`}
    >
      <option value="all">All accounts ({accounts.length})</option>
      {accounts.map((a) => (
        <option key={a.id} value={a.id}>
          {LABEL[a.platform] ?? a.platform} · {a.handle ? `@${a.handle.replace(/^@/, "")}` : a.name}
        </option>
      ))}
    </select>
  );
}
