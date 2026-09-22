import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { Loader2, Plus, ShieldCheck, Trash2, Workflow, Zap } from "lucide-react";
import { toast } from "sonner";

import { AppShell } from "@/components/app/AppShell";
import { EmptyState, PageHeader, Panel, StatusBadge } from "@/components/app/primitives";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useTenant } from "@/hooks/useTenant";
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
  updateAutomationRule,
  type AutomationRule,
  type AutomationSettings,
} from "@/lib/automations.functions";


export const Route = createFileRoute("/_authenticated/automations")({
  head: () => ({
    meta: [
      { title: "Automations — DM FB-IG-YT by Techaasvik" },
      {
        name: "description",
        content: "Keyword rules that auto-reply to DMs and comments with safety limits.",
      },
      { property: "og:title", content: "Automations — DM FB-IG-YT by Techaasvik" },
      {
        property: "og:description",
        content: "Keyword rules that auto-reply to DMs and comments with safety limits.",
      },
    ],
  }),
  component: AutomationsPage,
});

type Trigger = "dm_received" | "comment_received";
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
  platform: "all" | "instagram" | "facebook";
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
  trigger: "dm_received",
  matchType: "contains",
  keywords: "price, cost",
  action: "reply_dm",
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
  dmAttachmentType: "none",
  followerCondition: "any",
  requireFollow: false,
  followPromptText: "",
};

/** One-click message packs: a main reply plus three ready variations. */
const MESSAGE_TEMPLATES: Array<{
  label: string;
  text: string;
  variations: string[];
  comment: string;
  commentVariations: string[];
}> = [
  {
    label: "Price enquiry",
    text: "Thanks for asking! Sharing our pricing and packages with you right now 👇",
    variations: [
      "Hi! Here are our current plans and prices — have a look 👇",
      "Happy to help! Sending the price list your way 👇",
      "Thanks for your interest — full pricing details below 👇",
    ],
    comment: "Just sent you the pricing in DM 📩",
    commentVariations: [
      "Check your inbox — details sent 📩",
      "DM kar diya hai, please check 📩",
      "Sent you everything in a message 📩",
    ],
  },
  {
    label: "Send the link",
    text: "Here you go! Tap the link below to see everything.",
    variations: [
      "All the details are on this link 👇",
      "Sharing the link — take a look and tell me what you think.",
      "Link niche hai, koi bhi sawal ho to bataiye!",
    ],
    comment: "Link bhej diya hai DM me 📩",
    commentVariations: [
      "Sent the link in your inbox 📩",
      "Check DM — link shared 📩",
      "Just messaged you the link 📩",
    ],
  },
  {
    label: "Thanks + follow up",
    text: "Thank you so much for reaching out! How can we help you today?",
    variations: [
      "Hey, thanks for the message! What would you like to know?",
      "Thanks for getting in touch — tell us what you need 🙂",
      "Hi! We're here to help. What are you looking for?",
    ],
    comment: "Thanks for commenting! Replied in DM 📩",
    commentVariations: [
      "Appreciate it! Check your inbox 📩",
      "Thanks 🙏 sent you a message",
      "Answered you in DM 📩",
    ],
  },
  {
    label: "Order / booking",
    text: "Great choice! Share your name and city and we'll confirm your order.",
    variations: [
      "Awesome — send your name + city and we'll book it for you.",
      "Let's get you started! Reply with your name and city.",
      "Sure! Bas apna naam aur city bhej dijiye, hum confirm kar denge.",
    ],
    comment: "Details DM me bhej diye hain 📩",
    commentVariations: [
      "Sent the booking steps in DM 📩",
      "Check inbox to place your order 📩",
      "Messaged you how to order 📩",
    ],
  },
];

const triggerLabel: Record<Trigger, string> = {
  dm_received: "New DM",
  comment_received: "New comment",
};

const actionLabel: Record<Action, string> = {
  reply_dm: "Send a DM reply",
  comment_public_reply: "Public reply under comment",
  comment_private_reply: "Private DM from comment",
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
    platform: (rule.platform === "instagram" || rule.platform === "facebook"
      ? rule.platform
      : "all") as Draft["platform"],
    trigger: rule.trigger,
    matchType: rule.match_type,
    keywords: (rule.keywords ?? []).join(", "),
    action: rule.action,
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
    dmAttachmentType: rule.dm_attachment_type ?? "none",
    followerCondition: rule.follower_condition ?? "any",
    requireFollow: rule.require_follow ?? false,
    followPromptText: rule.follow_prompt_text ?? "",
  };
}

function AutomationsPage() {
  const { activeOrg } = useTenant();
  const orgId = activeOrg?.id;
  const queryClient = useQueryClient();

  const fetchRules = useServerFn(listAutomationRules);
  const fetchRuns = useServerFn(listAutomationRuns);
  const createFn = useServerFn(createAutomationRule);
  const updateFn = useServerFn(updateAutomationRule);
  const deleteFn = useServerFn(deleteAutomationRule);

  const [draft, setDraft] = useState<Draft | null>(null);

  const rulesQuery = useQuery({
    queryKey: ["automation-rules", orgId],
    enabled: Boolean(orgId),
    queryFn: () => fetchRules({ data: { organizationId: orgId! } }),
  });

  const runsQuery = useQuery({
    queryKey: ["automation-runs", orgId],
    enabled: Boolean(orgId),
    refetchInterval: 20000,
    queryFn: () => fetchRuns({ data: { organizationId: orgId! } }),
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
        dmAttachmentType: value.dmAttachmentType,
        followerCondition: value.followerCondition,
        requireFollow: value.requireFollow,
        followPromptText: value.followPromptText.trim() || null,
      };
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
  const runs = runsQuery.data ?? [];
  const ruleName = (id: string | null) =>
    rules.find((r) => r.id === id)?.name ?? "Deleted rule";

  const needsText = draft
    ? ["reply_dm", "comment_public_reply", "comment_private_reply"].includes(draft.action)
    : false;

  return (
    <AppShell>
      <PageHeader
        title="Automations"
        description="Keyword rules that reply to DMs and comments automatically, with cooldowns and daily caps."
        actions={
          <Button onClick={() => setDraft({ ...emptyDraft })} disabled={!orgId}>
            <Plus className="size-4" /> New rule
          </Button>
        }
      />

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <Panel title="Rules" bodyClassName="p-0">
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
                    <Plus className="size-4" /> New rule
                  </Button>
                }
              />
            </div>
          ) : (
            <ul className="divide-y">
              {rules.map((rule) => (
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

        <Panel title="Recent activity" bodyClassName="p-0">
          {runs.length === 0 ? (
            <div className="p-5">
              <EmptyState
                icon={Zap}
                title="No automation activity yet"
                description="Every time a rule fires, skips or fails you will see it here."
              />
            </div>
          ) : (
            <ul className="divide-y">
              {runs.map((run) => (
                <li key={run.id} className="flex items-start gap-3 px-5 py-3">
                  <StatusBadge tone={runTone[run.status]}>{run.status}</StatusBadge>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{ruleName(run.rule_id)}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {run.detail ?? "—"} ·{" "}
                      {new Date(run.created_at).toLocaleString()}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>

      <SafetyPanel orgId={orgId} />


      <Dialog open={Boolean(draft)} onOpenChange={(open) => !open && setDraft(null)}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{draft?.id ? "Edit automation" : "New automation"}</DialogTitle>
          </DialogHeader>
          {draft && (
            <div className="grid gap-4">
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
                  <Label>When</Label>
                  <Select
                    value={draft.trigger}
                    onValueChange={(v) =>
                      setDraft({
                        ...draft,
                        trigger: v as Trigger,
                        action: v === "comment_received" ? "comment_public_reply" : "reply_dm",
                      })
                    }
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="dm_received">New DM</SelectItem>
                      <SelectItem value="comment_received">New comment</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2">
                  <Label>Platform</Label>
                  <Select
                    value={draft.platform}
                    onValueChange={(v) =>
                      setDraft({ ...draft, platform: v as Draft["platform"] })
                    }
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All platforms</SelectItem>
                      <SelectItem value="instagram">Instagram</SelectItem>
                      <SelectItem value="facebook">Facebook</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="grid gap-2">
                  <Label>Match</Label>
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
                <Label>Then</Label>
                <Select
                  value={draft.action}
                  onValueChange={(v) => setDraft({ ...draft, action: v as Action })}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {draft.trigger === "dm_received" ? (
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
              </div>

              {draft.trigger === "comment_received" && (
                <PostPicker
                  orgId={orgId}
                  selected={draft.targetPostIds}
                  onChange={(ids) => setDraft({ ...draft, targetPostIds: ids })}
                />
              )}

              {draft.trigger === "comment_received" && (
                <div className="grid gap-2">
                  <Label>Public reply under the comment (optional)</Label>
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
                <div className="grid gap-2">
                  <Label>Ready-made messages</Label>
                  <div className="flex flex-wrap gap-2">
                    {MESSAGE_TEMPLATES.map((template) => (
                      <Button
                        key={template.label}
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          setDraft({
                            ...draft,
                            responseText: template.text,
                            responseVariations: template.variations.join("\n"),
                            commentReplyText:
                              draft.trigger === "comment_received"
                                ? template.comment
                                : draft.commentReplyText,
                            commentReplyVariations:
                              draft.trigger === "comment_received"
                                ? template.commentVariations.join("\n")
                                : draft.commentReplyVariations,
                          })
                        }
                      >
                        {template.label}
                      </Button>
                    ))}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    One tap fills the message plus three alternates — edit them as you like.
                  </p>
                </div>
              )}

              {needsText && (
                <div className="grid gap-2">
                  <Label>Message</Label>
                  <Textarea
                    rows={3}
                    value={draft.responseText}
                    placeholder="Thanks for reaching out! Our pricing starts at ₹4,999/month."
                    onChange={(e) => setDraft({ ...draft, responseText: e.target.value })}
                  />
                </div>
              )}

              {needsText && (
                <div className="grid gap-2">
                  <Label>Alternate messages (one per line)</Label>
                  <Textarea
                    rows={3}
                    value={draft.responseVariations}
                    placeholder={"Hi! Pricing starts at ₹4,999/month.\nHey — plans begin at ₹4,999/month."}
                    onChange={(e) =>
                      setDraft({ ...draft, responseVariations: e.target.value })
                    }
                  />
                  <p className="text-xs text-muted-foreground">
                    One is picked at random each time, so replies never look robotic.
                  </p>
                </div>
              )}

              {needsDm && (
                <div className="grid gap-4 rounded-lg border p-4">
                  <p className="text-sm font-medium">Link & attachment (optional)</p>
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
                      <Label>Attachment URL</Label>
                      <Input
                        value={draft.dmAttachmentUrl}
                        disabled={draft.dmAttachmentType === "none"}
                        placeholder="https://your-site.com/catalogue.pdf"
                        onChange={(e) =>
                          setDraft({ ...draft, dmAttachmentUrl: e.target.value })
                        }
                      />
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Leave both empty for a plain text reply. With a button text the link
                    is shown as a tappable button.
                  </p>
                </div>
              )}

              {needsDm && (
                <div className="grid gap-4 rounded-lg border p-4">
                  <p className="text-sm font-medium">Follower check</p>
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
                        <SelectItem value="any">Everyone</SelectItem>
                        <SelectItem value="followers_only">Followers only</SelectItem>
                        <SelectItem value="non_followers">Non-followers only</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex items-center justify-between rounded-lg border px-4 py-3">
                    <div className="pr-4">
                      <p className="text-sm font-medium">Ask to follow first</p>
                      <p className="text-xs text-muted-foreground">
                        Non-followers get a follow request with an “I followed” button.
                        The main reply is sent only after the follow is confirmed.
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
                    Follower status is available on Instagram. On Facebook the reply is
                    always sent.
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
          <DialogFooter>
            <Button variant="outline" onClick={() => setDraft(null)}>
              Cancel
            </Button>
            <Button
              onClick={() => draft && saveMutation.mutate(draft)}
              disabled={!draft?.name.trim() || saveMutation.isPending}
            >
              {saveMutation.isPending && <Loader2 className="size-4 animate-spin" />}
              Save rule
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
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
                disabled={saveMutation.isPending || !orgId}
              >
                {saveMutation.isPending && <Loader2 className="size-4 animate-spin" />}
                Save safety settings
              </Button>
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

