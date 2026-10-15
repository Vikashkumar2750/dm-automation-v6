import { effectiveAccountLimits, resolveCaps, type AccountLimit } from "@/lib/account-safety";

type AdminClient = import("@supabase/supabase-js").SupabaseClient;

/** Limits for one connected account (or the workspace when accountId is null). */
export async function accountSafetyLimits(
  admin: AdminClient,
  orgId: string,
  accountId: string | null,
  workspace: { hourly: number; daily: number; perContact: number },
) {
  const [{ data: ps }, { data: ts }] = await Promise.all([
    admin.from("platform_settings").select("feature_flags").eq("id", true).maybeSingle(),
    admin.from("trust_settings").select("account_limits").eq("organization_id", orgId).maybeSingle(),
  ]);
  const caps = resolveCaps((ps?.feature_flags ?? {}) as Record<string, unknown>, orgId);
  const map = ((ts as { account_limits?: Record<string, AccountLimit> } | null)?.account_limits ?? {}) as Record<string, AccountLimit>;
  return effectiveAccountLimits(workspace, accountId ? map[accountId] : null, caps);
}

/** Sent automation steps since a time, for one account (via its conversations) or the whole workspace. */
export async function countSentForAccount(admin: AdminClient, orgId: string, accountId: string | null, since: string) {
  if (!accountId) {
    const { count } = await admin.from("automation_runs").select("id", { count: "exact", head: true })
      .eq("organization_id", orgId).eq("status", "sent").gte("created_at", since);
    return count ?? 0;
  }
  const { count } = await admin.from("automation_runs")
    .select("id, conversations!inner(social_account_id)", { count: "exact", head: true })
    .eq("organization_id", orgId).eq("status", "sent").gte("created_at", since)
    .eq("conversations.social_account_id", accountId);
  return count ?? 0;
}
