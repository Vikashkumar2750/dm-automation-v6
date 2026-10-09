/** Display helpers so people see @handles, never raw platform IDs. */
type Named = { platform: string; external_user_id: string; external_user_name: string | null };

const PLATFORM_LABEL: Record<string, string> = { instagram: "Instagram", facebook: "Facebook", youtube: "YouTube" };

/** A readable label: the saved handle, else "Instagram user · 4f2a91". */
export function contactLabel(c: Named): string {
  const n = c.external_user_name?.trim();
  if (n) return n.startsWith("@") || n.includes(" ") ? n : `@${n}`;
  return `${PLATFORM_LABEL[c.platform] ?? "Unknown"} user · ${c.external_user_id.slice(-6)}`;
}

/**
 * DMs often arrive without a name while the same person's comment carries
 * the handle. Copy a known name to every thread of the same person.
 */
export function fillSiblingNames<T extends Named>(rows: T[], known: Named[] = []): T[] {
  const names = new Map<string, string>();
  for (const r of [...known, ...rows]) {
    if (r.external_user_name) names.set(`${r.platform}:${r.external_user_id}`, r.external_user_name);
  }
  return rows.map((r) =>
    r.external_user_name ? r : { ...r, external_user_name: names.get(`${r.platform}:${r.external_user_id}`) ?? null },
  );
}
