import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { Loader2, Plus, Trash2, Workflow, Zap } from "lucide-react";
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
  listAutomationRules,
  listAutomationRuns,
  updateAutomationRule,
  type AutomationRule,
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
  setStatus: "open" | "pending" | "resolved";
  cooldownSeconds: number;
  dailyLimit: number;
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
  setStatus: "pending",
  cooldownSeconds: 60,
  dailyLimit: 200,
};

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
    setStatus: rule.set_status ?? "pending",
    cooldownSeconds: rule.cooldown_seconds,
    dailyLimit: rule.daily_limit,
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
        setStatus: value.action === "set_status" ? value.setStatus : null,
        cooldownSeconds: Number(value.cooldownSeconds) || 0,
        dailyLimit: Number(value.dailyLimit) || 1,
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
