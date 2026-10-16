import { supabase } from "@/integrations/supabase/client";
import { GuideButton } from "@/components/app/GuideButton";
import { PostPicker } from "@/components/app/PostPicker";
import { getPlanUsage } from "@/lib/plan-limits.functions";
import { createFileRoute, Link } from "@tanstack/react-router";
import { MESSAGE_TEMPLATES } from "@/lib/rule-templates";
import { DASH_TEMPLATES } from "@/lib/dashboard-templates";
import { uploadPostMedia } from "@/lib/media-upload";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { checkPolicy } from "@/lib/trust-safety";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useState } from "react";
import { ChevronDown, ChevronLeft, Copy, Loader2, Plus, ShieldCheck, Sparkles, Trash2, Workflow, Zap } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { AutomationPreview } from "@/components/app/AutomationPreview";
import { toast } from "sonner";

import { AppShell } from "@/components/app/AppShell";
import { EmptyState, PageHeader, Panel, StatusBadge } from "@/components/app/primitives";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useTenant } from "@/hooks/useTenant";
import { activityName, explainReason, stepLabel } from "@/lib/activity-explain";
import {
  createAutomationRule,
  deleteAutomationRule,
  getAutomationSettings,
  getAutomationUsage,
  listAutomationRules,
  listAutomationRuns,
  listOptOuts,
  removeOptOut,
  resumeAutomations,
  saveAutomationSettings,
  listTargetablePosts,
  listRecentRemotePosts,
  updateAutomationRule,
  type AutomationRule,
  type AutomationSettings,
} from "@/lib/automations.functions";
import { getSimulatorAccess } from "@/lib/simulation.functions";
import { getEntryConfig } from "@/lib/entry-points.functions";
import { getFlows } from "@/lib/flows.functions";


export const Route = createFileRoute("/_authenticated/automations")({
  head: () => ({
    meta: [
      { title: "Automations — AutoDM by Techaasvik" },
      {
        name: "description",
        content: "Keyword rules that auto-reply to DMs and comments with safety limits.",
      },
      { property: "og:title", content: "Automations — AutoDM by Techaasvik" },
      {
        property: "og:description",
        content: "Keyword rules that auto-reply to DMs and comments with safety limits.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  validateSearch: (s: Record<string, unknown>): { template?: string; new?: boolean } => ({
    ...(typeof s["template"] === "string" ? { template: s["template"] } : {}),
    ...(s["new"] === true || s["new"] === "1" || s["new"] === 1 ? { new: true } : {}),
  }),
  component: AutomationsPage,
});

type Trigger = "dm_received" | "comment_received" | "story_reply" | "story_mention";
type MatchType = "any" | "contains" | "exact" | "starts_with";
type Action =
  | "reply_dm"
  | "comment_public_reply"
  | "comment_private_reply"
  | "hide_comment"
  | "set_status";

type Draft = {
  id?: string;
  name: string;
  isActive: boolean;
  priority: number;
  platform: "all" | "instagram" | "facebook" | "youtube";
  trigger: Trigger;
  matchType: MatchType;
  keywords: string;
  action: Action;
  responseText: string;
  responseVariations: string;
  setStatus: "open" | "pending" | "resolved";
  cooldownSeconds: number;
  dailyLimit: number;
  targetPostIds: string[];
  commentReplyText: string;
  commentReplyVariations: string;
  dmLinkUrl: string;
  dmButtonLabel: string;
  dmLinkInText: boolean;
  dmExtraButtons: Array<{ url: string; label: string }>;
  dmAttachmentUrl: string;
  dmAttachmentType: "none" | "image" | "video" | "file";
  followerCondition: "any" | "followers_only" | "non_followers";
  requireFollow: boolean;
  followPromptText: string;
};

const emptyDraft: Draft = {
  name: "",
  isActive: true,
  priority: 100,
  platform: "all",
  trigger: "comment_received",
  matchType: "contains",
  keywords: "price, cost",
  action: "comment_private_reply",
  responseText: "",
  responseVariations: "",
  setStatus: "pending",
  cooldownSeconds: 60,
  dailyLimit: 200,
  targetPostIds: [],
  commentReplyText: "",
  commentReplyVariations: "",
  dmLinkUrl: "",
  dmButtonLabel: "",
  dmAttachmentUrl: "",
  dmLinkInText: false,
  dmExtraButtons: [],
  dmAttachmentType: "none",
  followerCondition: "any",
  requireFollow: true,
  followPromptText: "",
};

type TemplatePack = { label: string; text: string; variations: string[]; comment?: string; commentVariations?: string[] };

function TemplateMenu({ templates, onPick }: { templates: TemplatePack[]; onPick: (t: TemplatePack) => void }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button type="button" size="sm" variant="outline" className="border-primary/40 text-primary hover:bg-primary/10">
          <Sparkles className="size-3.5" /> Autofill <ChevronDown className="size-3.5" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        {templates.map((t) => (
          <DropdownMenuItem key={t.label} onSelect={() => onPick(t)} className="flex-col items-start gap-0.5 focus:bg-primary/10 focus:text-primary">
            <span className="text-sm font-medium">{t.label}</span>
            <span className="line-clamp-1 text-xs text-muted-foreground">{t.text}</span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/** One-click message packs: a main reply plus three ready variations. */
const YOUTUBE_MESSAGE_TEMPLATES: Array<{
  label: string;
  text: string;
  variations: string[];
}> = [
  {
    label: "Warm thanks",
    text: "Bahut shukriya! Khushi hui ki aapko video pasand aayi 🙏",
    variations: [
      "Thank you so much for watching and supporting! 🙏",
      "Glad you enjoyed the video — aise hi support karte rahiye ❤️",
      "Thanks a lot! Aapke comments se hi motivation milta hai 🙏",
    ],
  },
  {
    label: "Helpful reply",
    text: "Great question! Saari details video description me de rahi hain, check kar lijiye 🙂",
    variations: [
      "Thanks for asking! Description me pura detail diya hai — dekh lijiye.",
      "Good question! Iske baare me video me detail se bataya hai, dobara dekh lijiye 🙂",
      "Happy to help! Description aur pinned comment me saari info hai.",
    ],
  },
  {
    label: "Engage back",
    text: "Thanks for watching! Aapko video ka kaunsa part sabse achha laga? 🙂",
    variations: [
      "Glad you watched! Next video kis topic par chahiye, batayein?",
      "Thank you! Aapke suggestions se hi next videos banti hain 🙂",
      "Shukriya! Aur kya dekhna chahenge channel par? Comment me batayein.",
    ],
  },
  {
    label: "Short & sweet",
    text: "Thanks for the love! ❤️",
    variations: [
      "Glad you liked it! 🙏",
      "Thank you! ❤️",
      "Shukriya ji! 🙏",
    ],
  },
];

const triggerLabel: Record<Trigger, string> = {
  dm_received: "New DM",
  comment_received: "New comment",
  story_reply: "Story reply (IG)",
  story_mention: "Story mention (IG)",
};

const actionLabel: Record<Action, string> = {
  reply_dm: "Send a DM reply",
  comment_public_reply: "Public reply only (no DM)",
  comment_private_reply: "Public reply + DM with link (recommended)",
  hide_comment: "Hide the comment",
  set_status: "Change conversation status",
};

const matchLabel: Record<MatchType, string> = {
  any: "Any message",
  contains: "Contains keyword",
  exact: "Exactly matches",
  starts_with: "Starts with",
};

const runTone = {
  sent: "success",
  matched: "info",
  skipped: "neutral",
  failed: "danger",
} as const;

function toDraft(rule: AutomationRule): Draft {
  return {
    id: rule.id,
    name: rule.name,
    isActive: rule.is_active,
    priority: rule.priority,
    platform: (rule.platform === "instagram" || rule.platform === "facebook" ||
      rule.platform === "youtube"
      ? rule.platform
      : "all") as Draft["platform"],
    matchType: rule.match_type,
    keywords: (rule.keywords ?? []).join(", "),
    action: rule.platform === "youtube" ? "comment_public_reply" : rule.action,
    trigger: rule.platform === "youtube" ? "comment_received" : rule.trigger,
    responseText: rule.response_text ?? "",
    responseVariations: (rule.response_variations ?? []).join("\n"),
    setStatus: rule.set_status ?? "pending",
    cooldownSeconds: rule.cooldown_seconds,
    dailyLimit: rule.daily_limit,
    targetPostIds: rule.target_post_ids ?? [],
    commentReplyText: rule.comment_reply_text ?? "",
    commentReplyVariations: (rule.comment_reply_variations ?? []).join("\n"),
    dmLinkUrl: rule.dm_link_url ?? "",
    dmButtonLabel: rule.dm_button_label ?? "",
    dmAttachmentUrl: rule.dm_attachment_url ?? "",
    dmLinkInText: rule.dm_link_in_text ?? false,
    dmExtraButtons: Array.isArray(rule.dm_extra_buttons) ? rule.dm_extra_buttons : [],
    dmAttachmentType: rule.dm_attachment_type ?? "none",
    followerCondition: rule.follower_condition ?? "any",
    requireFollow: rule.require_follow ?? false,
    followPromptText: rule.follow_prompt_text ?? "",
  };
}

function AutomationsPage() {
  const { activeOrg } = useTenant();
  const orgId = activeOrg?.id;
  const [uploadingAttachment, setUploadingAttachment] = useState(false);
  const queryClient = useQueryClient();

  const fetchRules = useServerFn(listAutomationRules);
  const fetchRuns = useServerFn(listAutomationRuns);
  const createFn = useServerFn(createAutomationRule);
  const updateFn = useServerFn(updateAutomationRule);
  const deleteFn = useServerFn(deleteAutomationRule);
  const fetchSimulatorAccess = useServerFn(getSimulatorAccess);
  const fetchEntryConfig = useServerFn(getEntryConfig);
  const entryQuery = useQuery({
    queryKey: ["entry-points", orgId],
    queryFn: () => fetchEntryConfig({ data: { organizationId: orgId! } }),
    enabled: !!orgId,
  });
  const entryPointsOn = entryQuery.data?.enabled === true;

  const [draft, setDraft] = useState<Draft | null>(null);
  const search = Route.useSearch();
  const navigateSelf = Route.useNavigate();
  useEffect(() => {
    if (!search.new && !search.template) return;
    const d = DASH_TEMPLATES.find((x) => x.key === search.template);
    const t = MESSAGE_TEMPLATES.find((x) => x.label === search.template);
    if (d) {
      setDraft({
        ...emptyDraft,
        name: d.title,
        trigger: d.trigger,
        matchType: d.matchType,
        keywords: d.keywords,
        action: d.trigger === "comment_received" ? "comment_private_reply" : "reply_dm",
        responseText: d.dmText,
        commentReplyText: d.comment ?? "",
        dmButtonLabel: d.button.replace(/\s*→$/, ""),
        requireFollow: Boolean(d.requireFollow),
      });
    } else {
      setDraft(t ? { ...emptyDraft, name: t.label, responseText: t.text, responseVariations: t.variations.join("\n"), commentReplyText: t.comment, commentReplyVariations: t.commentVariations.join("\n") } : { ...emptyDraft });
    }
    void navigateSelf({ search: {}, replace: true });
  }, [search.new, search.template, navigateSelf]);
  const editing = Boolean(draft);
  useEffect(() => { if (typeof window !== "undefined") window.scrollTo({ top: 0 }); }, [editing]);

  const deliveryPagesQuery = useQuery({
    queryKey: ["delivery-pages-pick", orgId],
    enabled: !!orgId,
    staleTime: 5 * 60_000,
    meta: { background: true },
    queryFn: async () => {
      const { data } = await supabase
        .from("delivery_pages")
        .select("id, title, slug, button_label, active")
        .eq("organization_id", orgId!)
        .order("created_at");
      return (data ?? []) as Array<{ id: string; title: string; slug: string; button_label: string | null; active: boolean }>;
    },
  });
  const rulesQuery = useQuery({
    queryKey: ["automation-rules", orgId],
    enabled: Boolean(orgId),
    queryFn: () => fetchRules({ data: { organizationId: orgId! } }),
  });

  const runsQuery = useQuery({
    queryKey: ["automation-runs", orgId, "rules"],
    enabled: Boolean(orgId),
    refetchInterval: 20000,
    queryFn: () => fetchRuns({ data: { organizationId: orgId!, source: "rules" } }),
  });
  const flowRunsQuery = useQuery({
    queryKey: ["automation-runs", orgId, "flows"], enabled: Boolean(orgId), refetchInterval: 20000,
    queryFn: () => fetchRuns({ data: { organizationId: orgId ?? "", source: "flows" } }),
  });
  const fetchFlowsInfo = useServerFn(getFlows);
  const flowsQuery = useQuery({
    queryKey: ["flows", orgId],
    enabled: !!orgId,
    retry: false,
    queryFn: () => fetchFlowsInfo({ data: { organizationId: orgId! } }),
  });
  const simulatorAccess = useQuery({
    queryKey: ["simulator-access", orgId],
    enabled: Boolean(orgId),
    queryFn: () => fetchSimulatorAccess({ data: { organizationId: orgId! } }),
  });

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ["automation-rules", orgId] });
    void queryClient.invalidateQueries({ queryKey: ["automation-runs", orgId] });
  };

  const saveMutation = useMutation({
    mutationFn: async (value: Draft) => {
      const payload = {
        name: value.name,
        isActive: value.isActive,
        priority: Number(value.priority) || 100,
        platform: value.platform === "all" ? null : value.platform,
        trigger: value.trigger,
        matchType: value.matchType,
        keywords: value.keywords
          .split(",")
          .map((k) => k.trim())
          .filter(Boolean),
        action: value.action,
        responseText: value.responseText.trim() ? value.responseText.trim() : null,
        responseVariations: value.responseVariations
          .split("\n")
          .map((t) => t.trim())
          .filter(Boolean),
        setStatus: value.action === "set_status" ? value.setStatus : null,
        cooldownSeconds: Number(value.cooldownSeconds) || 0,
        dailyLimit: Number(value.dailyLimit) || 1,
        targetPostIds: value.targetPostIds,
        commentReplyText: value.commentReplyText.trim() || null,
        commentReplyVariations: value.commentReplyVariations
          .split("\n")
          .map((t) => t.trim())
          .filter(Boolean),
        dmLinkUrl: value.dmLinkUrl.trim() || null,
        dmButtonLabel: value.dmButtonLabel.trim() || null,
        dmAttachmentUrl: value.dmAttachmentUrl.trim() || null,
        dmLinkInText: value.dmLinkInText,
        dmExtraButtons: value.dmLinkUrl.trim()
          ? value.dmExtraButtons.filter((b) => b.url.trim()).map((b) => ({ url: b.url.trim(), label: b.label.trim() }))
          : [],
        dmAttachmentType: value.dmAttachmentType,
        followerCondition: value.followerCondition,
        requireFollow: value.requireFollow,
        followPromptText: value.followPromptText.trim() || null,
      };
      const issues = checkPolicy([payload.responseText, ...payload.responseVariations, payload.commentReplyText, ...payload.commentReplyVariations, payload.followPromptText]);
      const blocker = issues.find((i) => i.severity === "block");
      if (blocker) throw new Error(`Policy check: ${blocker.message}`);
      for (const w of issues) toast.warning(`Policy tip: ${w.message}`);
      if (value.id) {
        return updateFn({ data: { id: value.id, ...payload } });
      }
      return createFn({ data: { organizationId: orgId!, ...payload } });
    },
    onSuccess: () => {
      toast.success("Automation saved");
      setDraft(null);
      invalidate();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const toggleMutation = useMutation({
    mutationFn: (vars: { id: string; isActive: boolean }) =>
      updateFn({ data: { id: vars.id, isActive: vars.isActive } }),
    onSuccess: invalidate,
    onError: (error: Error) => toast.error(error.message),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteFn({ data: { id } }),
    onSuccess: () => {
      toast.success("Automation deleted");
      invalidate();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const rules = rulesQuery.data ?? [];
  const [rulePlatform, setRulePlatform] = useState("all");
  const shownRules = rules.filter((r) => rulePlatform === "all" || !r.platform || r.platform === rulePlatform);
  const fetchPlanUsage = useServerFn(getPlanUsage);
  const planUsage = useQuery({
    queryKey: ["plan-usage", orgId],
    enabled: !!orgId,
    queryFn: () => fetchPlanUsage({ data: { organizationId: orgId! } }),
  });
  const maxRules = planUsage.data?.maxRules ?? null;
  const activeCount = rules.filter((r) => r.is_active).length;
  const ruleLimitHit = maxRules !== null && activeCount >= maxRules;
  const runs = runsQuery.data ?? [];
  const ruleName = (id: string | null) => {
    if (!id) return "Safety settings";
    return rules.find((r) => r.id === id)?.name ?? "Deleted rule";
  };

  const needsText = draft
    ? ["reply_dm", "comment_public_reply", "comment_private_reply"].includes(draft.action)
    : false;

  const needsDm = draft
    ? ["reply_dm", "comment_private_reply"].includes(draft.action)
    : false;

  const pickTemplate = (template: TemplatePack) =>
    setDraft((d) =>
      d
        ? {
            ...d,
            responseText: template.text,
            responseVariations: template.variations.join("\n"),
            commentReplyText: d.trigger === "comment_received" && template.comment ? template.comment : d.commentReplyText,
            commentReplyVariations:
              d.trigger === "comment_received" && template.commentVariations
                ? template.commentVariations.join("\n")
                : d.commentReplyVariations,
          }
        : d,
    );

  return (
    <AppShell>
      <div className={draft ? "hidden" : "contents"}>
      <PageHeader
        title="Automations"
        description="Keyword rules that reply to DMs and comments automatically, with cooldowns and daily caps."
        actions={
          <div className="flex gap-2">
            {flowsQuery.data?.enabled && (
              <Button asChild variant="outline">
                <Link to="/automations/flows">Flow builder</Link>
              </Button>
            )}
            <GuideButton guide="automations" />
            <Button asChild variant="outline">
              <Link to="/automations/ai-agent">AI agent</Link>
            </Button>
            {simulatorAccess.data?.allowed && (
              <Button asChild variant="outline">
                <Link to="/automations/simulator">Test console</Link>
              </Button>
            )}
            <Button onClick={() => setDraft({ ...emptyDraft })} disabled={!orgId}>
              <Plus className="size-4" /> {ruleLimitHit ? `Automation limit reached (${activeCount}/${maxRules})` : "New automation"}
            </Button>
          </div>
        }
      />

      <Panel title="How an automation works">
        <ol className="grid gap-2 text-sm text-muted-foreground sm:grid-cols-2 lg:grid-cols-4">
          <li>
            <span className="font-medium text-foreground">1. When</span>
            <br />
            Someone sends a DM, or comments on your post. Choose “New comment” to pick
            one specific post (or leave it on all posts).
          </li>
          <li>
            <span className="font-medium text-foreground">2. Match</span>
            <br />
            The rule fires if their text matches your keywords — or on every message if
            you choose “Any message”.
          </li>
          <li>
            <span className="font-medium text-foreground">3. Reply</span>
            <br />
            A public reply can go under the comment, then the DM is sent with your text,
            link button or attachment.
          </li>
          <li>
            <span className="font-medium text-foreground">4. Guardrails</span>
            <br />
            Follower check, cooldown, daily cap, quiet hours and opt-out words all run
            before anything is sent.
          </li>
        </ol>
        <p className="mt-3 text-xs text-muted-foreground">
          Automations only run on connected accounts, and only for messages received
          after the rule is switched on. Every fire, skip and failure is listed under
          Recent activity.
        </p>
      </Panel>


      <div className="grid gap-5 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <Panel title="Rules" bodyClassName="p-0" action={<select aria-label="Platform" value={rulePlatform} onChange={(e) => setRulePlatform(e.target.value)} className="h-8 rounded-md border bg-background px-2 text-xs"><option value="all">All platforms</option><option value="instagram">Instagram</option><option value="facebook">Facebook</option></select>}>
          {rulesQuery.isLoading ? (
            <div className="flex items-center justify-center py-16 text-muted-foreground">
              <Loader2 className="size-5 animate-spin" />
            </div>
          ) : rules.length === 0 ? (
            <div className="p-5">
              <EmptyState
                icon={Workflow}
                title="No automations yet"
                description="Create a rule so incoming DMs or comments get an instant reply."
                action={
                  <Button onClick={() => setDraft({ ...emptyDraft })} disabled={!orgId}>
                    <Plus className="size-4" /> New automation
                  </Button>
                }
              />
            </div>
          ) : (
            <ul className="divide-y">
              {shownRules.map((rule) => (
                <li key={rule.id} className="flex flex-wrap items-start gap-3 px-5 py-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        className="text-sm font-semibold hover:underline"
                        onClick={() => setDraft(toDraft(rule))}
                      >
                        {rule.name}
                      </button>
                      <StatusBadge tone={rule.is_active ? "success" : "neutral"}>
                        {rule.is_active ? "Active" : "Paused"}
                      </StatusBadge>
                      <StatusBadge tone="info">{triggerLabel[rule.trigger]}</StatusBadge>
                      {rule.platform && (
                        <StatusBadge tone="neutral">{rule.platform}</StatusBadge>
                      )}
                    </div>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {matchLabel[rule.match_type]}
                      {rule.match_type !== "any" && rule.keywords.length > 0
                        ? `: ${rule.keywords.join(", ")}`
                        : ""}{" "}
                      → {actionLabel[rule.action]}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Priority {rule.priority} · cooldown {rule.cooldown_seconds}s · max{" "}
                      {rule.daily_limit}/day
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={rule.is_active}
                      onCheckedChange={(checked) =>
                        toggleMutation.mutate({ id: rule.id, isActive: checked })
                      }
                    />
                    <Button
                      variant="ghost"
                      size="icon"
                      title="Duplicate rule"
                      aria-label="Duplicate rule"
                      onClick={() => {
                        const { id: _omit, ...copy } = toDraft(rule);
                        setDraft({
                          ...copy,
                          name: `${rule.name} (copy)`.slice(0, 80),
                          isActive: false,
                        });
                        toast.info("Copy opened — edit and save. It starts paused.");
                      }}
                    >
                      <Copy className="size-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => deleteMutation.mutate(rule.id)}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        {(() => {
          const entries = [
            ...(flowRunsQuery.data ?? []).map((r) => ({ run: r, source: "flows" as const })),
            ...runs.map((r) => ({ run: r, source: "rules" as const })),
          ].sort((a, b) => b.run.created_at.localeCompare(a.run.created_at));
          return (
            <Panel title="Recent activity" bodyClassName="p-0">
              {entries.length === 0 ? <div className="p-5"><EmptyState icon={Zap} title="No activity yet" description="Sent, skipped and failed steps appear here." /></div> : <ul className="divide-y">
                {entries.slice(0, 6).map(({ run, source }) => {
                  const sent = run.status === "sent" || run.status === "matched";
                  const ex = sent ? null : explainReason(run.detail);
                  return <li key={`${source}-${run.id}`}><Link to="/automations/activity/$runId" params={{ runId: run.id }} search={{ source, filter: "all" }} className="flex items-start gap-3 px-5 py-3 hover:bg-muted/50">
                    <div className="flex shrink-0 flex-col gap-1"><StatusBadge tone={runTone[run.status]}>{run.status}</StatusBadge><span className="text-[10px] font-medium uppercase text-muted-foreground">{source === "flows" ? "Flow" : "Rule"}</span></div>
                    <div className="min-w-0 flex-1"><p className="truncate text-sm font-medium">{activityName(run, ruleName)}: {sent ? stepLabel(run.detail) : ex?.title}</p>
                    {ex?.hint && <p className="truncate text-xs text-muted-foreground">{ex.hint}</p>}<p className="text-xs text-muted-foreground">{new Date(run.created_at).toLocaleString()}</p></div>
                  </Link></li>;
                })}
              </ul>}
              <div className="border-t p-3 text-center"><Button asChild variant="ghost" size="sm"><Link to="/automations/activity" search={{ source: "rules", filter: "all" }}>View all activity</Link></Button></div>
            </Panel>
          );
        })()}
      </div>

      <SafetyPanel orgId={orgId} />


      </div>
      {draft && (
      <div className="mx-auto w-full max-w-6xl space-y-4">
        <Button variant="ghost" size="sm" onClick={() => setDraft(null)}><ChevronLeft className="size-4" /> Back to automations</Button>
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-start">
        <section className="panel min-w-0">
          <div className="border-b px-5 py-4">
            <h1 className="text-xl font-semibold">{draft?.id ? "Edit automation" : "New automation"}</h1>
          </div>
          <div className="p-5">
          {draft && (
            <div className="grid gap-6">
              <div className="grid gap-2">
                <Label>Name</Label>
                <Input
                  value={draft.name}
                  placeholder="Pricing auto-reply"
                  onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="grid gap-2">
                  <Label>If you receieve a&nbsp;</Label>
                  <Select
                    value={draft.trigger}
                    onValueChange={(v) =>
                      setDraft({
                        ...draft,
                        trigger: v as Trigger,
                        action: v === "comment_received" ? "comment_private_reply" : "reply_dm",
                      })
                    }
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {draft.platform !== "youtube" && (
                        <SelectItem value="dm_received">New DM</SelectItem>
                      )}
                      <SelectItem value="comment_received">New comment</SelectItem>
                      {draft.platform !== "youtube" && entryPointsOn && (
                        <>
                          <SelectItem value="story_reply">Story reply (Instagram)</SelectItem>
                          <SelectItem value="story_mention">Story mention (Instagram)</SelectItem>
                        </>
                      )}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2">
                  <Label>On Platform</Label>
                  <Select
                    value={draft.platform}
                    onValueChange={(v) => {
                      const platform = v as Draft["platform"];
                      if (platform === "youtube") {
                        setDraft({
                          ...draft,
                          platform,
                          trigger: "comment_received",
                          action: "comment_public_reply",
                          targetPostIds: [],
                          responseText: draft.platform === "youtube" ? draft.responseText : "",
                          responseVariations:
                            draft.platform === "youtube" ? draft.responseVariations : "",
                          commentReplyText: "",
                          commentReplyVariations: "",
                          requireFollow: false,
                        });
                      } else {
                        setDraft({
                          ...draft,
                          platform,
                          targetPostIds: draft.platform === "youtube" ? [] : draft.targetPostIds,
                        });
                      }
                    }}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Both platforms (FB+IG only)</SelectItem>
                      <SelectItem value="instagram">Instagram</SelectItem>
                      <SelectItem value="facebook">Facebook</SelectItem>
                      <SelectItem value="youtube">YouTube (public reply only)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="grid gap-2">
                  <Label>if the user comment matches with</Label>
                  <Select
                    value={draft.matchType}
                    onValueChange={(v) => setDraft({ ...draft, matchType: v as MatchType })}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {(Object.keys(matchLabel) as MatchType[]).map((m) => (
                        <SelectItem key={m} value={m}>
                          {matchLabel[m]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2">
                  <Label>Keywords (comma separated)</Label>
                  <Input
                    value={draft.keywords}
                    disabled={draft.matchType === "any"}
                    onChange={(e) => setDraft({ ...draft, keywords: e.target.value })}
                  />
                </div>
              </div>

              <div className="grid gap-2">
                <Label>Trigger the automation</Label>
                <Select
                  value={draft.action}
                  onValueChange={(v) => setDraft({ ...draft, action: v as Action })}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {draft.platform === "youtube" ? (
                      <SelectItem value="comment_public_reply">
                        {actionLabel.comment_public_reply}
                      </SelectItem>
                    ) : draft.trigger !== "comment_received" ? (
                      <>
                        <SelectItem value="reply_dm">{actionLabel.reply_dm}</SelectItem>
                        <SelectItem value="set_status">{actionLabel.set_status}</SelectItem>
                      </>
                    ) : (
                      <>
                        <SelectItem value="comment_public_reply">
                          {actionLabel.comment_public_reply}
                        </SelectItem>
                        <SelectItem value="comment_private_reply">
                          {actionLabel.comment_private_reply}
                        </SelectItem>
                        <SelectItem value="hide_comment">{actionLabel.hide_comment}</SelectItem>
                        <SelectItem value="set_status">{actionLabel.set_status}</SelectItem>
                      </>
                    )}
                  </SelectContent>
                </Select>
                {draft.trigger === "comment_received" &&
                  draft.action === "comment_public_reply" && (
                    <p className="text-xs text-muted-foreground">
                      This posts a public reply only. To also send a DM with a link,
                      button or attachment, choose “{actionLabel.comment_private_reply}”.
                    </p>
                  )}
                {draft.trigger === "comment_received" &&
                  draft.action === "comment_private_reply" && (
                    <div className="rounded-lg border bg-muted/40 p-3 text-xs text-muted-foreground">
                      <p className="font-medium text-foreground">What happens</p>
                      <ol className="mt-1 list-decimal space-y-0.5 pl-4">
                        <li>Comment arrives on a selected post and matches your keywords.</li>
                        <li>A public reply is posted under the comment.</li>
                        <li>
                          With a follower check or attachment, the commenter gets a DM with a
                          “Send me the link” button. Tapping it opens the chat so Instagram
                          can tell us whether they follow you.
                        </li>
                        <li>
                          Followers instantly get your message with the link as a button, plus
                          the attachment.
                        </li>
                        <li>
                          Non-followers get “Visit profile” + “I followed ✅”. After they
                          follow and tap, the link DM is sent automatically (up to 3 checks).
                        </li>
                      </ol>
                    </div>
                  )}
              </div>

              <PostPicker
                orgId={orgId}
                trigger={draft.trigger}
                platform={draft.platform}
                selected={draft.targetPostIds}
                onChange={(ids) => setDraft({ ...draft, targetPostIds: ids })}
              />

              {draft.trigger === "comment_received" && draft.platform !== "youtube" && (
                <div className="grid gap-2 rounded-lg border p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <Label className="text-sm font-semibold">Reply User comment - Public reply</Label>
                    <TemplateMenu templates={MESSAGE_TEMPLATES} onPick={pickTemplate} />
                  </div>
                  <Textarea
                    rows={2}
                    value={draft.commentReplyText}
                    placeholder="Just sent you the details in DM 📩"
                    onChange={(e) =>
                      setDraft({ ...draft, commentReplyText: e.target.value })
                    }
                  />
                  <Textarea
                    rows={3}
                    value={draft.commentReplyVariations}
                    placeholder={"Check your inbox 📩\nDM kar diya hai 📩\nSent you a message 📩"}
                    onChange={(e) =>
                      setDraft({ ...draft, commentReplyVariations: e.target.value })
                    }
                  />
                  <p className="text-xs text-muted-foreground">
                    One line per alternate reply — a random one is posted, then the DM is
                    sent.
                  </p>
                </div>
              )}

              {needsText && (
                <div className="grid gap-2 rounded-lg border p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <Label className="text-sm font-semibold">{draft.platform === "youtube" ? "YouTube public reply" : draft.action === "comment_public_reply" ? "Public reply text" : "DM to user - Private Reply"}</Label>
                    {!(draft.trigger === "comment_received" && draft.platform !== "youtube") && (
                      <TemplateMenu templates={draft.platform === "youtube" ? YOUTUBE_MESSAGE_TEMPLATES : MESSAGE_TEMPLATES} onPick={pickTemplate} />
                    )}
                  </div>
                  <Textarea
                    rows={3}
                    value={draft.responseText}
                    placeholder={draft.platform === "youtube"
                      ? "Thanks for watching! 🙌 The link is in the video description."
                      : "Thanks for reaching out! Our pricing starts at ₹4,999/month."}
                    onChange={(e) => setDraft({ ...draft, responseText: e.target.value })}
                  />
                </div>
              )}

              {needsText && (
                <div className="grid gap-2">
                  <Label>Randomize messages - Alternatives (one per line)</Label>
                  <Textarea
                    rows={3}
                    value={draft.responseVariations}
                    placeholder={draft.platform === "youtube"
                      ? "Glad you liked it! Check the description for the link 👇\nThanks for the comment! Link is in the description."
                      : "Hi! Pricing starts at ₹4,999/month.\nHey — plans begin at ₹4,999/month."}
                    onChange={(e) =>
                      setDraft({ ...draft, responseVariations: e.target.value })
                    }
                  />
                  <p className="text-xs text-muted-foreground">
                    One is picked at random each time, so replies never look robotic.
                    {draft.platform === "youtube" &&
                      " YouTube allows only a public reply under the comment — no DM, buttons or follow check."}
                  </p>
                </div>
              )}

              {needsDm && (
                <div className="grid gap-4 rounded-lg border bg-muted/30 p-4">
                  <p className="text-sm font-semibold">What you want to send / attach</p>
                  {(deliveryPagesQuery.data?.length ?? 0) > 0 && (
                    <div className="grid gap-2">
                      <Label>Fill from a delivery page (optional)</Label>
                      <Select
                        value=""
                        onValueChange={(id) => {
                          const pg = deliveryPagesQuery.data?.find((x) => x.id === id);
                          if (!pg) return;
                          setDraft({
                            ...draft,
                            dmLinkUrl: `${window.location.origin}/p/${pg.slug}`,
                            dmButtonLabel: draft.dmButtonLabel.trim() || (pg.button_label ?? "View offer").slice(0, 20),
                          });
                        }}
                      >
                        <SelectTrigger><SelectValue placeholder="Choose a delivery page…" /></SelectTrigger>
                        <SelectContent>
                          {deliveryPagesQuery.data!.map((pg) => (
                            <SelectItem key={pg.id} value={pg.id}>{pg.title}{pg.active ? "" : " (inactive)"}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="grid gap-2">
                      <Label>Link URL</Label>
                      <Input
                        value={draft.dmLinkUrl}
                        placeholder="https://your-site.com/offer"
                        onChange={(e) => setDraft({ ...draft, dmLinkUrl: e.target.value })}
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label>Button text</Label>
                      <Input
                        value={draft.dmButtonLabel}
                        maxLength={20}
                        placeholder="View offer"
                        onChange={(e) =>
                          setDraft({ ...draft, dmButtonLabel: e.target.value })
                        }
                      />
                    </div>
                  </div>
                  {draft.dmLinkUrl.trim() && (
                    <div className="grid gap-3">
                      {draft.dmExtraButtons.map((b, i) => (
                        <div key={i} className="grid gap-2 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
                          <div className="grid gap-2">
                            <Label>Button {i + 2} link</Label>
                            <Input
                              value={b.url}
                              placeholder="https://chat.whatsapp.com/…"
                              onChange={(e) => setDraft({ ...draft, dmExtraButtons: draft.dmExtraButtons.map((x, j) => j === i ? { ...x, url: e.target.value } : x) })}
                            />
                          </div>
                          <div className="grid gap-2">
                            <Label>Button {i + 2} text</Label>
                            <Input
                              value={b.label}
                              maxLength={20}
                              placeholder="Join group"
                              onChange={(e) => setDraft({ ...draft, dmExtraButtons: draft.dmExtraButtons.map((x, j) => j === i ? { ...x, label: e.target.value } : x) })}
                            />
                          </div>
                          <Button type="button" variant="ghost" size="icon" aria-label="Remove button"
                            onClick={() => setDraft({ ...draft, dmExtraButtons: draft.dmExtraButtons.filter((_, j) => j !== i) })}>
                            <Trash2 className="size-4" />
                          </Button>
                        </div>
                      ))}
                      {draft.dmExtraButtons.length < 2 && (
                        <Button type="button" variant="outline" size="sm" className="w-fit"
                          onClick={() => setDraft({ ...draft, dmExtraButtons: [...draft.dmExtraButtons, { url: "", label: "" }] })}>
                          <Plus className="size-4" /> Add another button ({draft.dmExtraButtons.length + 1}/3)
                        </Button>
                      )}
                    </div>
                  )}
                  {draft.dmLinkUrl.trim() && (
                    <div className="flex items-center justify-between gap-4 rounded-md border p-3">
                      <div>
                        <p className="text-sm font-medium">Also add the link in the message text</p>
                        <p className="text-xs text-muted-foreground">
                          Instagram/Facebook on a computer hides buttons. With this on, the link
                          also shows in the message. The button stays on mobile.
                        </p>
                      </div>
                      <Switch
                        checked={draft.dmLinkInText}
                        onCheckedChange={(checked) => setDraft({ ...draft, dmLinkInText: checked })}
                      />
                    </div>
                  )}
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="grid gap-2">
                      <Label>Attachment type</Label>
                      <Select
                        value={draft.dmAttachmentType}
                        onValueChange={(v) =>
                          setDraft({
                            ...draft,
                            dmAttachmentType: v as Draft["dmAttachmentType"],
                          })
                        }
                      >
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">No attachment</SelectItem>
                          <SelectItem value="image">Image</SelectItem>
                          <SelectItem value="video">Video</SelectItem>
                          <SelectItem value="file">File</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="grid gap-2">
                      <Label>Attachment URL or upload</Label>
                      <Input
                        value={draft.dmAttachmentUrl.startsWith("storage:") ? "Uploaded file ✓" : draft.dmAttachmentUrl}
                        disabled={draft.dmAttachmentType === "none" || draft.dmAttachmentUrl.startsWith("storage:")}
                        placeholder="https://your-site.com/catalogue.pdf"
                        onChange={(e) =>
                          setDraft({ ...draft, dmAttachmentUrl: e.target.value })
                        }
                      />
                      <div className="flex items-center gap-2">
                        <label className={`inline-flex cursor-pointer items-center gap-1 rounded-md border px-2 py-1 text-xs ${draft.dmAttachmentType === "none" || uploadingAttachment ? "pointer-events-none opacity-50" : "hover:bg-muted"}`}>
                          {uploadingAttachment && <Loader2 className="size-3 animate-spin" />}Upload file
                          <input
                            type="file"
                            className="hidden"
                            accept={draft.dmAttachmentType === "image" ? "image/*" : draft.dmAttachmentType === "video" ? "video/mp4,video/*" : undefined}
                            onChange={async (e) => {
                              const file = e.target.files?.[0];
                              e.target.value = "";
                              if (!file || !orgId) return;
                              if (file.size > 25 * 1024 * 1024) { toast.error("File must be under 25 MB (Instagram limit)."); return; }
                              setUploadingAttachment(true);
                              try {
                                const ref = await uploadPostMedia(orgId, file);
                                setDraft((d) => (d ? { ...d, dmAttachmentUrl: ref } : d));
                                toast.success("File uploaded");
                              } catch (err) {
                                toast.error(err instanceof Error ? err.message : "Upload failed");
                              } finally { setUploadingAttachment(false); }
                            }}
                          />
                        </label>
                        {draft.dmAttachmentUrl.startsWith("storage:") && (
                          <button type="button" className="text-xs text-muted-foreground hover:text-foreground" onClick={() => setDraft({ ...draft, dmAttachmentUrl: "" })}>Remove</button>
                        )}
                      </div>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    The link is sent as a tappable button (label “Open link” if left empty).
                    For comments, the attachment is sent after the person taps “Send me the
                    link”, because a comment reply can carry only one message.
                  </p>
                </div>
              )}

              {needsDm && (
                <div className="grid gap-4 rounded-lg border p-4">
                  <p className="text-sm font-semibold">Who should get the DM? (follower check)</p>
                  <div className="grid gap-2">
                    <Label>Reply to</Label>
                    <Select
                      value={draft.followerCondition}
                      onValueChange={(v) =>
                        setDraft({
                          ...draft,
                          followerCondition: v as Draft["followerCondition"],
                        })
                      }
                    >
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="any">Everyone (followers get it directly, others follow first)</SelectItem>
                        <SelectItem value="followers_only">Followers only</SelectItem>
                        <SelectItem value="non_followers">Non-followers only</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex items-center justify-between rounded-lg border px-4 py-3">
                    <div className="pr-4">
                      <p className="text-sm font-medium">Ask to follow first</p>
                      <p className="text-xs text-muted-foreground">
                        Commenters first tap “Send me the link”. Followers then get the link
                        right away; non-followers get “Visit profile” + “I followed ✅” and
                        receive the link once the follow is confirmed.
                      </p>
                    </div>
                    <Switch
                      checked={draft.requireFollow}
                      onCheckedChange={(checked) =>
                        setDraft({ ...draft, requireFollow: checked })
                      }
                    />
                  </div>
                  {draft.requireFollow && (
                    <div className="grid gap-2">
                      <Label>Follow request message</Label>
                      <Textarea
                        rows={2}
                        value={draft.followPromptText}
                        placeholder="Please follow us first, then tap the button below and we'll send the details."
                        onChange={(e) =>
                          setDraft({ ...draft, followPromptText: e.target.value })
                        }
                      />
                    </div>
                  )}
                  <p className="text-xs text-muted-foreground">
                    Instagram reveals follower status only after the person taps a button or
                    messages you. Facebook never reveals it, so Facebook contacts always get
                    the reply after their tap.
                  </p>
                </div>
              )}

              {draft.action === "set_status" && (
                <div className="grid gap-2">
                  <Label>Set status to</Label>
                  <Select
                    value={draft.setStatus}
                    onValueChange={(v) =>
                      setDraft({ ...draft, setStatus: v as Draft["setStatus"] })
                    }
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="open">Open</SelectItem>
                      <SelectItem value="pending">Pending</SelectItem>
                      <SelectItem value="resolved">Resolved</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}

              <div className="grid gap-4 sm:grid-cols-3">
                <div className="grid gap-2">
                  <Label>Priority</Label>
                  <Input
                    type="number"
                    value={draft.priority}
                    onChange={(e) =>
                      setDraft({ ...draft, priority: Number(e.target.value) })
                    }
                  />
                </div>
                <div className="grid gap-2">
                  <Label>Cooldown (s)</Label>
                  <Input
                    type="number"
                    value={draft.cooldownSeconds}
                    onChange={(e) =>
                      setDraft({ ...draft, cooldownSeconds: Number(e.target.value) })
                    }
                  />
                </div>
                <div className="grid gap-2">
                  <Label>Max / day</Label>
                  <Input
                    type="number"
                    value={draft.dailyLimit}
                    onChange={(e) =>
                      setDraft({ ...draft, dailyLimit: Number(e.target.value) })
                    }
                  />
                </div>
              </div>

              <div className="flex items-center justify-between rounded-lg border px-4 py-3">
                <div>
                  <p className="text-sm font-medium">Active</p>
                  <p className="text-xs text-muted-foreground">
                    Paused rules never fire.
                  </p>
                </div>
                <Switch
                  checked={draft.isActive}
                  onCheckedChange={(checked) => setDraft({ ...draft, isActive: checked })}
                />
              </div>
            </div>
          )}
          </div>
          <div className="sticky bottom-0 flex justify-end gap-2 border-t bg-card px-5 py-3">
            <Button variant="outline" onClick={() => setDraft(null)}>
              Cancel
            </Button>
            <Button
              className="bg-success text-success-foreground hover:bg-success/90"
              onClick={() => draft && saveMutation.mutate(draft)}
              disabled={!draft?.name.trim() || saveMutation.isPending}
            >
              {saveMutation.isPending && <Loader2 className="size-4 animate-spin" />}
              Save automation
            </Button>
          </div>
        </section>
        <AutomationPreview draft={draft} orgId={orgId} selectedPostIds={draft.targetPostIds} />
        </div>
      </div>
      )}
    </AppShell>
  );
}

function SafetyPanel({ orgId }: { orgId: string | undefined }) {
  const queryClient = useQueryClient();
  const fetchSettings = useServerFn(getAutomationSettings);
  const saveSettings = useServerFn(saveAutomationSettings);
  const fetchOptOuts = useServerFn(listOptOuts);
  const removeFn = useServerFn(removeOptOut);

  const [form, setForm] = useState<AutomationSettings | null>(null);

  const settingsQuery = useQuery({
    queryKey: ["automation-settings", orgId],
    enabled: Boolean(orgId),
    queryFn: async () => {
      const value = await fetchSettings({ data: { organizationId: orgId! } });
      setForm(value);
      return value;
    },
  });

  const optOutsQuery = useQuery({
    queryKey: ["automation-optouts", orgId],
    enabled: Boolean(orgId),
    queryFn: () => fetchOptOuts({ data: { organizationId: orgId! } }),
  });

  const saveMutation = useMutation({
    mutationFn: (value: AutomationSettings) =>
      saveSettings({
        data: {
          organizationId: orgId!,
          isPaused: value.is_paused,
          blockedKeywords: value.blocked_keywords,
          optOutKeywords: value.opt_out_keywords,
          perContactDailyLimit: Number(value.per_contact_daily_limit) || 1,
          quietHoursEnabled: value.quiet_hours_enabled,
          quietHoursStart: Number(value.quiet_hours_start) || 0,
          quietHoursEnd: Number(value.quiet_hours_end) || 0,
          timezoneOffsetMinutes: Number(value.timezone_offset_minutes) || 0,
          hourlySendLimit: Number(value.hourly_send_limit) || 120,
          dailySendLimit: Number(value.daily_send_limit) || 1000,
          viralGuardEnabled: value.viral_guard_enabled,
          viralThresholdPerMinute: Number(value.viral_threshold_per_minute) || 30,
          viralCooldownMinutes: Number(value.viral_cooldown_minutes) || 15,
        },
      }),

    onSuccess: () => {
      toast.success("Safety settings saved");
      void queryClient.invalidateQueries({ queryKey: ["automation-settings", orgId] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const unblockMutation = useMutation({
    mutationFn: (id: string) => removeFn({ data: { id } }),
    onSuccess: () => {
      toast.success("Contact can receive automations again");
      void queryClient.invalidateQueries({ queryKey: ["automation-optouts", orgId] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const optOuts = optOutsQuery.data ?? [];

  return (
    <div className="mt-5 grid gap-5 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
      <Panel title="Safety">
        {settingsQuery.isLoading || !form ? (
          <div className="flex items-center justify-center py-10 text-muted-foreground">
            <Loader2 className="size-5 animate-spin" />
          </div>
        ) : (
          <div className="grid gap-4">
            <div className="flex items-center justify-between rounded-lg border px-4 py-3">
              <div>
                <p className="text-sm font-medium">Pause all automations</p>
                <p className="text-xs text-muted-foreground">
                  Emergency switch — nothing auto-replies while this is on.
                </p>
              </div>
              <Switch
                checked={form.is_paused}
                onCheckedChange={(checked) => setForm({ ...form, is_paused: checked })}
              />
            </div>

            <div className="grid gap-2">
              <Label>Sensitive words (comma separated)</Label>
              <Input
                value={form.blocked_keywords.join(", ")}
                placeholder="refund, legal, complaint"
                onChange={(e) =>
                  setForm({
                    ...form,
                    blocked_keywords: e.target.value
                      .split(",")
                      .map((k) => k.trim())
                      .filter(Boolean),
                  })
                }
              />
              <p className="text-xs text-muted-foreground">
                These messages skip automation and stay open for a human.
              </p>
            </div>

            <div className="grid gap-2">
              <Label>Opt-out words (comma separated)</Label>
              <Input
                value={form.opt_out_keywords.join(", ")}
                placeholder="stop, unsubscribe"
                onChange={(e) =>
                  setForm({
                    ...form,
                    opt_out_keywords: e.target.value
                      .split(",")
                      .map((k) => k.trim())
                      .filter(Boolean),
                  })
                }
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="grid gap-2">
                <Label>Max auto-replies per person / day</Label>
                <Input
                  type="number"
                  value={form.per_contact_daily_limit}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      per_contact_daily_limit: Number(e.target.value),
                    })
                  }
                />
              </div>
              <div className="grid gap-2">
                <Label>Timezone offset (minutes)</Label>
                <Input
                  type="number"
                  value={form.timezone_offset_minutes}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      timezone_offset_minutes: Number(e.target.value),
                    })
                  }
                />
              </div>
            </div>

            <div className="flex items-center justify-between rounded-lg border px-4 py-3">
              <div>
                <p className="text-sm font-medium">Quiet hours</p>
                <p className="text-xs text-muted-foreground">
                  No auto-replies during these hours.
                </p>
              </div>
              <Switch
                checked={form.quiet_hours_enabled}
                onCheckedChange={(checked) =>
                  setForm({ ...form, quiet_hours_enabled: checked })
                }
              />
            </div>

            {form.quiet_hours_enabled && (
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="grid gap-2">
                  <Label>From (hour)</Label>
                  <Input
                    type="number"
                    value={form.quiet_hours_start}
                    onChange={(e) =>
                      setForm({ ...form, quiet_hours_start: Number(e.target.value) })
                    }
                  />
                </div>
                <div className="grid gap-2">
                  <Label>To (hour)</Label>
                  <Input
                    type="number"
                    value={form.quiet_hours_end}
                    onChange={(e) =>
                      setForm({ ...form, quiet_hours_end: Number(e.target.value) })
                    }
                  />
                </div>
              </div>
            )}

            <div className="grid gap-4 rounded-lg border p-4">
              <div>
                <p className="text-sm font-medium">Sending limits</p>
                <p className="text-xs text-muted-foreground">
                  Hard caps so a busy day never turns into spam.
                </p>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="grid gap-2">
                  <Label>Max auto-replies / hour</Label>
                  <Input
                    type="number"
                    value={form.hourly_send_limit}
                    onChange={(e) =>
                      setForm({ ...form, hourly_send_limit: Number(e.target.value) })
                    }
                  />
                </div>
                <div className="grid gap-2">
                  <Label>Max auto-replies / day</Label>
                  <Input
                    type="number"
                    value={form.daily_send_limit}
                    onChange={(e) =>
                      setForm({ ...form, daily_send_limit: Number(e.target.value) })
                    }
                  />
                </div>
              </div>

              <div className="flex items-center justify-between rounded-lg border px-4 py-3">
                <div>
                  <p className="text-sm font-medium">Viral protection</p>
                  <p className="text-xs text-muted-foreground">
                    If a post blows up, automation pauses itself for a while.
                  </p>
                </div>
                <Switch
                  checked={form.viral_guard_enabled}
                  onCheckedChange={(checked) =>
                    setForm({ ...form, viral_guard_enabled: checked })
                  }
                />
              </div>

              {form.viral_guard_enabled && (
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="grid gap-2">
                    <Label>Spike threshold (events / minute)</Label>
                    <Input
                      type="number"
                      value={form.viral_threshold_per_minute}
                      onChange={(e) =>
                        setForm({
                          ...form,
                          viral_threshold_per_minute: Number(e.target.value),
                        })
                      }
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label>Pause for (minutes)</Label>
                    <Input
                      type="number"
                      value={form.viral_cooldown_minutes}
                      onChange={(e) =>
                        setForm({
                          ...form,
                          viral_cooldown_minutes: Number(e.target.value),
                        })
                      }
                    />
                  </div>
                </div>
              )}
            </div>

            <div>
              <Button
                onClick={() => form && saveMutation.mutate(form)}
                disabled={saveMutation.isPending || !orgId || Boolean((settingsQuery.data as { locked?: boolean } | undefined)?.locked)}
              >
                {saveMutation.isPending && <Loader2 className="size-4 animate-spin" />}
                Save safety settings
              </Button>
              {(settingsQuery.data as { locked?: boolean } | undefined)?.locked && (
                <p className="mt-2 text-xs text-muted-foreground">
                  These settings are locked by the platform admin.
                </p>
              )}
            </div>
          </div>
        )}
      </Panel>

      <div className="grid gap-5">
      <UsagePanel orgId={orgId} />

      <Panel title="Opted out contacts" bodyClassName="p-0">

        {optOuts.length === 0 ? (
          <div className="p-5">
            <EmptyState
              icon={ShieldCheck}
              title="No opt-outs"
              description="Anyone who replies STOP is added here and never gets automated messages again."
            />
          </div>
        ) : (
          <ul className="divide-y">
            {optOuts.map((row) => (
              <li key={row.id} className="flex items-center gap-3 px-5 py-3">
                <StatusBadge tone="neutral">{row.platform}</StatusBadge>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{row.external_user_id}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {row.reason ?? "opted out"} ·{" "}
                    {new Date(row.created_at).toLocaleDateString()}
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => unblockMutation.mutate(row.id)}
                >
                  Allow
                </Button>
              </li>
            ))}
          </ul>
        )}
      </Panel>
      </div>
    </div>
  );
}

function UsagePanel({ orgId }: { orgId: string | undefined }) {
  const queryClient = useQueryClient();
  const fetchUsage = useServerFn(getAutomationUsage);
  const resumeFn = useServerFn(resumeAutomations);

  const usageQuery = useQuery({
    queryKey: ["automation-usage", orgId],
    enabled: Boolean(orgId),
    refetchInterval: 20000,
    queryFn: () => fetchUsage({ data: { organizationId: orgId! } }),
  });

  const resumeMutation = useMutation({
    mutationFn: () => resumeFn({ data: { organizationId: orgId! } }),
    onSuccess: () => {
      toast.success("Automation resumed");
      void queryClient.invalidateQueries({ queryKey: ["automation-usage", orgId] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const usage = usageQuery.data;
  const paused =
    usage?.autoPausedUntil && new Date(usage.autoPausedUntil) > new Date()
      ? usage
      : null;

  return (
    <Panel title="Usage today">
      {!usage ? (
        <div className="flex items-center justify-center py-8 text-muted-foreground">
          <Loader2 className="size-5 animate-spin" />
        </div>
      ) : (
        <div className="grid gap-4">
          {paused && (
            <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-3">
              <p className="text-sm font-medium">Automation paused automatically</p>
              <p className="text-xs text-muted-foreground">
                {paused.autoPauseReason ?? "Traffic spike"} · resumes{" "}
                {new Date(paused.autoPausedUntil!).toLocaleTimeString()}
              </p>
              <Button
                size="sm"
                variant="outline"
                className="mt-2"
                onClick={() => resumeMutation.mutate()}
                disabled={resumeMutation.isPending}
              >
                Resume now
              </Button>
            </div>
          )}

          <div className="grid gap-3 sm:grid-cols-2">
            <Stat
              label="Sent this hour"
              value={`${usage.sentLastHour} / ${usage.hourlyLimit}`}
            />
            <Stat
              label="Sent today"
              value={`${usage.sentLastDay} / ${usage.dailyLimit}`}
            />
            <Stat label="Incoming events / hour" value={String(usage.inboundLastHour)} />
            <Stat
              label="Skipped · failed today"
              value={`${usage.skippedLastDay} · ${usage.failedLastDay}`}
            />
          </div>
        </div>
      )}
    </Panel>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border px-4 py-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="num mt-1 text-lg font-semibold">{value}</p>
    </div>
  );
}


/** Pull a post/media id out of a pasted link or raw id. */
