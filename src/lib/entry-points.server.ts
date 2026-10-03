/**
 * Phase A entry points (story replies, story mentions, ice breakers, menu).
 * Isolated from the locked comment/DM automation and gated by a feature flag
 * that is OFF by default. When the flag is off, nothing here changes behavior.
 */
type AdminClient = import("@supabase/supabase-js").SupabaseClient;

export type StoryKind = "story_reply" | "story_mention" | null;

/** Detect Instagram story replies / mentions in a raw messaging event. */
export function detectStoryEvent(event: unknown): StoryKind {
  const msg = (event as { message?: Record<string, unknown> } | null)?.message;
  if (!msg || msg["is_echo"]) return null;
  const replyTo = msg["reply_to"] as { story?: unknown } | undefined;
  if (replyTo?.story) return "story_reply";
  const attachments = msg["attachments"] as Array<{ type?: string }> | undefined;
  if (Array.isArray(attachments) && attachments.some((a) => a?.type === "story_mention")) {
    return "story_mention";
  }
  return null;
}

export type EntryPointsFlags = { enabled: boolean; orgs: string[] };

export function readEntryPointFlags(flags: Record<string, unknown> | null | undefined): EntryPointsFlags {
  const f = flags ?? {};
  const orgs = Array.isArray(f["entry_points_orgs"])
    ? (f["entry_points_orgs"] as unknown[]).filter((x): x is string => typeof x === "string")
    : [];
  return { enabled: f["entry_points_enabled"] !== false, orgs };
}

/** Enabled globally (orgs list empty) or only for the listed workspaces. */
export function entryPointsActiveFor(flags: EntryPointsFlags, orgId: string) {
  if (!flags.enabled) return false;
  return flags.orgs.length === 0 || flags.orgs.includes(orgId);
}

export async function entryPointsEnabled(admin: AdminClient, orgId: string) {
  try {
    const { data } = await admin
      .from("platform_settings")
      .select("feature_flags")
      .eq("id", true)
      .maybeSingle();
    return entryPointsActiveFor(
      readEntryPointFlags(data?.feature_flags as Record<string, unknown> | null),
      orgId,
    );
  } catch {
    return false;
  }
}

/** Is there at least one active rule for this story trigger? */
export async function hasActiveTriggerRule(admin: AdminClient, orgId: string, trigger: string) {
  const { count } = await admin
    .from("automation_rules")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", orgId)
    .eq("is_active", true)
    .eq("trigger", trigger as never);
  return (count ?? 0) > 0;
}

// ---------- Ice breakers & persistent menu config ----------

export type IceBreaker = { question: string };
export type MenuItem = { title: string; url?: string | null };
export type EntryConfig = { iceBreakers: IceBreaker[]; menu: MenuItem[] };

export const entryConfigKey = (orgId: string) => `entry_points_cfg_${orgId}`;

export function sanitizeEntryConfig(raw: unknown): EntryConfig {
  const r = (raw ?? {}) as { iceBreakers?: unknown; menu?: unknown };
  const iceBreakers = (Array.isArray(r.iceBreakers) ? r.iceBreakers : [])
    .map((x) => String((x as IceBreaker)?.question ?? "").trim().slice(0, 80))
    .filter(Boolean)
    .slice(0, 4)
    .map((question) => ({ question }));
  const menu = (Array.isArray(r.menu) ? r.menu : [])
    .map((x) => {
      const m = x as MenuItem;
      const title = String(m?.title ?? "").trim().slice(0, 30);
      const url = m?.url ? String(m.url).trim() : null;
      return { title, url: url && /^https:\/\//i.test(url) ? url : null };
    })
    .filter((m) => m.title)
    .slice(0, 5);
  return { iceBreakers, menu };
}

/**
 * Body for Meta's messenger_profile endpoint. Ice breaker taps arrive as a
 * normal postback whose title is the question, so ordinary "New DM" keyword
 * rules answer them — no change to the locked DM engine is needed.
 */
export function messengerProfileBody(platform: "instagram" | "facebook", cfg: EntryConfig) {
  const body: Record<string, unknown> = {};
  if (platform === "instagram") body["platform"] = "instagram";
  body["ice_breakers"] = [
    {
      locale: "default",
      call_to_actions: cfg.iceBreakers.map((b, i) => ({ question: b.question, payload: `IB:${i}` })),
    },
  ];
  if (platform === "facebook" && cfg.menu.length > 0) {
    body["persistent_menu"] = [
      {
        locale: "default",
        composer_input_disabled: false,
        call_to_actions: cfg.menu.map((m, i) =>
          m.url
            ? { type: "web_url", title: m.title, url: m.url }
            : { type: "postback", title: m.title, payload: `MENU:${i}` },
        ),
      },
    ];
  }
  return body;
}
