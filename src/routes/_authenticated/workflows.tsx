import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  Bot,
  CheckCircle2,
  ChevronRight,
  Loader2,
  MessageCircle,
  Send,
  SkipForward,
  UserRound,
  Workflow,
  XCircle,
  Zap,
} from "lucide-react";
import { useMemo, useState, type ReactNode } from "react";
import { AppShell } from "@/components/app/AppShell";
import { EmptyState, PageHeader, PlatformBadge } from "@/components/app/primitives";
import { PostSidebar, type SidebarPost } from "@/components/app/PostSidebar";
import { PostThumbnail } from "@/components/app/PostThumbnail";
import { useTenant } from "@/hooks/useTenant";
import { Button } from "@/components/ui/button";
import { useWorkflowsEnabled } from "@/hooks/useWorkflowsEnabled";
import { listAutomationRules } from "@/lib/automations.functions";
import { getPostJourney } from "@/lib/post-journey.functions";
import { activityName, activitySource, explainReason, stepLabel } from "@/lib/activity-explain";

export const Route = createFileRoute("/_authenticated/workflows")({
  head: () => ({
    meta: [
      { title: "Automation workflows — AutoDM by Techaasvik" },
      {
        name: "description",
        content:
          "Post-wise automation journeys: comment, rule, bot or manual replies and taps, left to right.",
      },
      { property: "og:title", content: "Automation workflows" },
      {
        property: "og:description",
        content: "See exactly what happened on every post, step by step.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: WorkflowsPage,
});

type Node = {
  id: string;
  kind: "comment" | "bot" | "manual" | "step" | "skipped" | "failed" | "dm";
  title: string;
  text: string;
  at: string;
  automation?: string;
  runId?: string;
  source?: "flows" | "rules" | "system";
};

const STYLE: Record<Node["kind"], { icon: ReactNode; cls: string; label: string }> = {
  comment: {
    icon: <MessageCircle className="size-4" />,
    cls: "border-foreground/30",
    label: "Comment",
  },
  dm: { icon: <MessageCircle className="size-4" />, cls: "border-foreground/30", label: "User DM" },
  bot: { icon: <Bot className="size-4" />, cls: "border-primary/60", label: "Bot reply" },
  manual: { icon: <UserRound className="size-4" />, cls: "border-info/60", label: "Manual reply" },
  step: { icon: <Zap className="size-4" />, cls: "border-success/60", label: "Automation step" },
  skipped: { icon: <SkipForward className="size-4" />, cls: "border-warning/60", label: "Skipped" },
  failed: { icon: <XCircle className="size-4" />, cls: "border-destructive/60", label: "Failed" },
};

function WorkflowsPage() {
  const { activeOrg } = useTenant();
  const orgId = activeOrg?.id ?? null;
  const [post, setPost] = useState<SidebarPost | null>(null);
  const [postWorkspace, setPostWorkspace] = useState<string | null>(null);
  const workflowsOn = useWorkflowsEnabled();
  if (!workflowsOn) {
    return (
      <AppShell>
        <PageHeader title="Automation workflows" description="This section is not available yet." />
        <EmptyState
          icon={Workflow}
          title="Workflows are switched off"
          description="This section is currently disabled for your workspace. Check your automation journeys under Automations → Recent activity."
        />
      </AppShell>
    );
  }
  return (
    <AppShell>
      <PageHeader
        title="Automation workflows"
        description="Choose a post to see every automation journey on it — comment, rule, bot or manual reply, taps — from left to right."
      />
      <div className="grid gap-4 lg:grid-cols-[320px_minmax(0,1fr)]">
        <PostSidebar
          orgId={orgId}
          selectedId={postWorkspace === orgId ? (post?.externalPostId ?? null) : null}
          onSelect={(selected) => {
            setPostWorkspace(orgId);
            setPost(selected);
          }}
          onPlatformChange={() => setPost(null)}
        />
        {post && orgId && postWorkspace === orgId ? (
          <Journeys key={`${orgId}:${post.externalPostId}`} orgId={orgId} post={post} />
        ) : (
          <div className="hidden min-h-[420px] items-center justify-center rounded-xl border border-dashed text-sm text-muted-foreground lg:flex">
            Select a post to see its workflow journeys.
          </div>
        )}
      </div>
    </AppShell>
  );
}

function Journeys({ orgId, post }: { orgId: string; post: SidebarPost }) {
  const fetchJourney = useServerFn(getPostJourney);
  const fetchRules = useServerFn(listAutomationRules);
  const journey = useQuery({
    queryKey: ["post-journey", orgId, post.externalPostId],
    refetchInterval: 20_000,
    queryFn: () =>
      fetchJourney({ data: { organizationId: orgId, postExternalId: post.externalPostId } }),
  });
  const rules = useQuery({
    queryKey: ["automation-rules", orgId],
    queryFn: () => fetchRules({ data: { organizationId: orgId } }),
  });
  const [open, setOpen] = useState<Node | null>(null);

  const lanes = useMemo(() => {
    const d = journey.data;
    if (!d) return [];
    const ruleName = (id: string | null) =>
      (rules.data as { id: string; name: string }[] | undefined)?.find((r) => r.id === id)?.name ??
      "Automation rule";
    return d.conversations
      .map((c) => {
        const nodes: Node[] = [];
        for (const m of d.messages.filter((x) => x.conversation_id === c.id)) {
          nodes.push({
            id: `m:${m.id}`,
            kind:
              m.direction === "inbound"
                ? c.channel === "comment"
                  ? "comment"
                  : "dm"
                : m.manual
                  ? "manual"
                  : "bot",
            title:
              m.direction === "inbound"
                ? (m.sender_name ?? c.name ?? "Contact")
                : m.manual
                  ? "Your team"
                  : "Bot",
            text: m.body,
            at: m.sent_at,
          });
        }
        for (const r of d.runs.filter((x) => x.conversation_id === c.id)) {
          const kind: Node["kind"] =
            r.status === "failed" ? "failed" : r.status === "skipped" ? "skipped" : "step";
          nodes.push({
            id: `r:${r.id}`,
            kind,
            title: activityName(r, ruleName),
            text: kind === "step" ? stepLabel(r.detail) : explainReason(r.detail).title,
            at: r.created_at,
            automation: activityName(r, ruleName),
            runId: r.id,
            source: activitySource(r),
          });
        }
        nodes.sort((a, b) => a.at.localeCompare(b.at));
        return { conv: c, nodes };
      })
      .filter((l) => l.nodes.length)
      .sort((a, b) => (b.nodes.at(-1)?.at ?? "").localeCompare(a.nodes.at(-1)?.at ?? ""));
  }, [journey.data, rules.data]);

  return (
    <div className="min-w-0 space-y-3">
      <div className="flex items-center gap-3 rounded-xl border p-3">
        <PostThumbnail src={post.mediaUrl} />
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-2 text-sm font-semibold">
            <PlatformBadge platform={post.platform} size="sm" />
            {post.accountName}
          </p>
          <p className="line-clamp-2 text-xs text-muted-foreground">
            {post.caption || "Untitled post"}
          </p>
        </div>
        <p className="text-xs text-muted-foreground">{lanes.length} journeys</p>
      </div>
      <div className="flex flex-wrap gap-2 text-sm text-muted-foreground">
        {(Object.keys(STYLE) as Node["kind"][]).map((k) => (
          <span
            key={k}
            className={`flex items-center gap-1 rounded-full border-2 px-2 py-0.5 ${STYLE[k].cls}`}
          >
            {STYLE[k].icon}
            {STYLE[k].label}
          </span>
        ))}
      </div>
      {(journey.isError || rules.isError) && (
        <div role="alert" className="space-y-2 text-sm text-destructive">
          <p>Some journey details could not be refreshed. Loaded results may be incomplete.</p>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              void journey.refetch();
              void rules.refetch();
            }}
          >
            Try again
          </Button>
        </div>
      )}
      {journey.isLoading ? (
        <Loader2 className="mx-auto my-10 size-5 animate-spin text-muted-foreground" />
      ) : journey.isError && !journey.data ? (
        <p role="status" className="text-sm text-muted-foreground">
          Journeys unavailable.
        </p>
      ) : lanes.length === 0 ? (
        <EmptyState
          icon={Workflow}
          title="No automation journeys yet"
          description="When someone comments on this post, its journey appears here."
        />
      ) : (
        <div className="overflow-x-auto rounded-xl border bg-[radial-gradient(hsl(var(--border))_1px,transparent_1px)] [background-size:18px_18px] p-4">
          <div className="space-y-5 min-w-max">
            {lanes.map(({ conv, nodes }) => (
              <div key={conv.id} className="flex items-center">
                <div className="mr-3 w-28 shrink-0 text-xs">
                  <p className="truncate font-semibold">{conv.name ?? "Contact"}</p>
                  <p className="text-muted-foreground capitalize">
                    {conv.channel === "comment" ? "Comment" : "DM"} · {conv.platform}
                  </p>
                </div>
                <span className="mr-1 rounded bg-foreground px-1.5 py-0.5 text-[9px] font-bold tracking-wider text-background">
                  START
                </span>
                {nodes.map((n, i) => (
                  <div key={n.id} className="flex items-center">
                    <span className="h-0.5 w-6 bg-border" />
                    {i > 0 && <ChevronRight className="-ml-2 size-3 text-muted-foreground" />}
                    <button
                      type="button"
                      onClick={() => setOpen(n)}
                      className={`w-48 rounded-lg border-2 bg-card p-2 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md ${STYLE[n.kind].cls} ${open?.id === n.id ? "ring-2 ring-primary" : ""}`}
                    >
                      <p className="flex items-center gap-1 text-xs font-semibold uppercase text-muted-foreground">
                        {STYLE[n.kind].icon}
                        {STYLE[n.kind].label}
                      </p>
                      <p className="truncate text-sm font-semibold">{n.title}</p>
                      <p className="line-clamp-2 text-sm">{n.text}</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {new Date(n.at).toLocaleString()}
                      </p>
                    </button>
                  </div>
                ))}
                <span className="h-0.5 w-6 bg-border" />
                <span className="rounded bg-foreground px-1.5 py-0.5 text-[9px] font-bold tracking-wider text-background">
                  END
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
      {open && (
        <div className="rounded-xl border p-4 text-sm">
          <p className="flex items-center gap-2 font-semibold">
            {STYLE[open.kind].icon}
            {STYLE[open.kind].label} · {open.title}
          </p>
          <p className="mt-1 whitespace-pre-wrap break-words">{open.text}</p>
          <p className="mt-1 text-xs text-muted-foreground">{new Date(open.at).toLocaleString()}</p>
          {open.runId && (
            <Link
              to="/automations/activity/$runId"
              params={{ runId: open.runId }}
              search={{ source: open.source ?? "rules", filter: "all" }}
              className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
            >
              <CheckCircle2 className="size-3" /> See all steps of this automation{" "}
              <Send className="size-3" />
            </Link>
          )}
        </div>
      )}
    </div>
  );
}
