import { AccountSelect } from "@/components/app/AccountSelect";

export type PlatformValue = "all" | "instagram" | "facebook" | "youtube";

/** True when a row passes the shared platform + account filter. Exact match: a chosen platform/account hides rows of any other (or unknown) platform/account. */
export function matchesPlatformAccount(
  row: { platform?: string | null | undefined; social_account_id?: string | null | undefined },
  platform: string,
  accountId: string,
) {
  if (platform !== "all" && row.platform !== platform) return false;
  if (accountId !== "all" && row.social_account_id !== accountId) return false;
  return true;
}

/** "All platforms" + "All accounts" pickers on one line. Changing platform resets the account. */
export function PlatformAccountFilter({
  orgId, platform, onPlatformChange, accountId, onAccountChange, platforms = ["instagram", "facebook", "youtube"], className = "",
}: {
  orgId: string | null;
  platform: string;
  onPlatformChange: (p: PlatformValue) => void;
  accountId: string;
  onAccountChange: (id: string) => void;
  platforms?: string[];
  className?: string;
}) {
  const LABEL: Record<string, string> = { instagram: "Instagram", facebook: "Facebook", youtube: "YouTube" };
  return (
    <div className={`flex min-w-0 max-w-full flex-wrap items-center gap-2 ${className}`}>
      <select
        aria-label="Platform"
        value={platform}
        onChange={(e) => { onPlatformChange(e.target.value as PlatformValue); onAccountChange("all"); }}
        className="h-8 shrink-0 rounded-md border bg-background px-2 text-xs outline-none focus:ring-2 focus:ring-ring"
      >
        <option value="all">All platforms</option>
        {platforms.map((p) => <option key={p} value={p}>{LABEL[p] ?? p}</option>)}
      </select>
      <AccountSelect orgId={orgId} platform={platform} value={accountId} onChange={onAccountChange} className="w-auto max-w-[200px]" />
    </div>
  );
}
