import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AlertTriangle, Lightbulb, Sparkles, Trash2, TrendingUp } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { AppShell } from "@/components/app/AppShell";
import { GuideButton } from "@/components/app/GuideButton";
import { EmptyState, PageHeader, Panel, StatusBadge } from "@/components/app/primitives";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useTenant } from "@/hooks/useTenant";
import { benchmarkTips, engagementRate, FUNNEL_STAGES, hourLabel, WEEKDAYS } from "@/lib/growth";
import { deleteCompetitor, generateContentIdeas, getGrowthOverview, saveCompetitor, type ContentIdea } from "@/lib/growth.functions";

export const Route = createFileRoute("/_authenticated/growth")({
  head: () => ({
    meta: [
      { title: "Growth insights — AutoDM by Techaasvik" },
      { name: "description", content: "Best time to post, competitor benchmark, AI content ideas, funnel heatmap and anomaly alerts." },
      { property: "og:title", content: "Growth insights — AutoDM by Techaasvik" },
      { property: "og:description", content: "Know when to post, what to post and where your DM funnel leaks." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: GrowthPage,
});

type Overview = Awaited<ReturnType<typeof getGrowthOverview>>;

function GrowthPage() {
  const { activeOrg } = useTenant();
  const orgId = activeOrg?.id ?? null;
  const fetchOverview = useServerFn(getGrowthOverview);
  const q = useQuery({ queryKey: ["growth", orgId], enabled: !!orgId, refetchInterval: 300_000, queryFn: () => fetchOverview({ data: { organizationId: orgId! } }) });
  const role = activeOrg?.role;
  const manager = role === "owner" || role === "admin" || role === "manager";

  return (
    <AppShell>
      <PageHeader title="Growth insights" description="When to post, what to post, and where your DM funnel leaks." actions={<GuideButton guide="growth" />} />
      {!orgId || !q.data ? (
        <p className="text-sm text-muted-foreground">{q.error ? (q.error as Error).message : "Loading…"}</p>
      ) : (
        <div className="space-y-5">
          <Alerts data={q.data} />
          <Tabs defaultValue="time">
            <TabsList className="flex-wrap">
              <TabsTrigger value="time">Best time to post</TabsTrigger>
              <TabsTrigger value="funnel">Funnel heatmap</TabsTrigger>
              <TabsTrigger value="ideas">AI content ideas</TabsTrigger>
              <TabsTrigger value="bench">Competitor benchmark</TabsTrigger>
            </TabsList>
            <TabsContent value="time"><BestTime data={q.data} /></TabsContent>
            <TabsContent value="funnel"><Funnel data={q.data} /></TabsContent>
            <TabsContent value="ideas"><Ideas orgId={orgId} /></TabsContent>
            <TabsContent value="bench"><Bench orgId={orgId} data={q.data} manager={manager} /></TabsContent>
          </Tabs>
        </div>
      )}
    </AppShell>
  );
}

function Alerts({ data }: { data: Overview }) {
  return (
    <Panel title="Anomaly alerts" action={<StatusBadge tone={data.anomalies.length ? "warning" : "success"}>{data.anomalies.length ? `${data.anomalies.length} alert(s)` : "All normal"}</StatusBadge>}>
      {data.anomalies.length === 0 ? (
        <p className="text-sm text-muted-foreground">Last 24 hours look normal compared with your previous 7 days.</p>
      ) : (
        <ul className="space-y-2">
          {data.anomalies.map((a) => (
            <li key={a.metric} className="flex items-start gap-2 text-sm">
              <AlertTriangle className={a.severity === "danger" ? "mt-0.5 size-4 text-destructive" : "mt-0.5 size-4 text-warning"} />
              <span>{a.message}</span>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}

function BestTime({ data }: { data: Overview }) {
  const max = Math.max(1, ...data.grid.flat());
  return (
    <div className="space-y-5">
      <Panel title="Suggested slots (India time)">
        {data.best.length === 0 ? (
          <p className="text-sm text-muted-foreground">Need at least 10 comments/DMs to suggest times — you have {data.sampleSize}. Keep automations running and check back.</p>
        ) : (
          <div className="flex flex-wrap gap-3">
            {data.best.map((b, i) => (
              <div key={b.label} className="rounded-lg border px-4 py-3">
                <p className="text-xs text-muted-foreground">#{i + 1}</p>
                <p className="text-lg font-semibold">{b.label}</p>
                <p className="text-xs text-muted-foreground">{b.count} comments/DMs</p>
              </div>
            ))}
          </div>
        )}
      </Panel>
      <Panel title="When your audience is active (last 60 days)">
        <div className="overflow-x-auto">
          <table className="text-[10px]">
            <thead>
              <tr><th />{Array.from({ length: 24 }, (_, h) => <th key={h} className="px-0.5 font-normal text-muted-foreground">{h % 3 === 0 ? hourLabel(h) : ""}</th>)}</tr>
            </thead>
            <tbody>
              {data.grid.map((row, d) => (
                <tr key={d}>
                  <td className="pr-2 text-xs text-muted-foreground">{WEEKDAYS[d]}</td>
                  {row.map((c, h) => (
                    <td key={h} className="p-0.5">
                      <div title={`${WEEKDAYS[d]} ${hourLabel(h)}: ${c}`} className="size-5 rounded-sm bg-primary" style={{ opacity: c ? 0.15 + (c / max) * 0.85 : 0.05 }} />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
    </div>
  );
}

function Funnel({ data }: { data: Overview }) {
  const f = data.funnel;
  return (
    <Panel title="Comment → DM → open → click → sale (last 30 days)">
      <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-5">
        {FUNNEL_STAGES.map((s, i) => (
          <div key={s.key} className="rounded-lg border p-3">
            <p className="text-xs text-muted-foreground">{s.label}</p>
            <p className="text-xl font-semibold">{f.totals[i]}</p>
            {i > 0 && <p className="text-xs text-muted-foreground">{f.conversion[i]}% of previous</p>}
          </div>
        ))}
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead><tr><th className="text-left font-normal text-muted-foreground">Stage</th>{WEEKDAYS.map((d) => <th key={d} className="font-normal text-muted-foreground">{d}</th>)}</tr></thead>
          <tbody>
            {FUNNEL_STAGES.map((s) => (
              <tr key={s.key}>
                <td className="py-1 pr-3">{s.label}</td>
                {f.rows[s.key].map((c, d) => (
                  <td key={d} className="p-0.5">
                    <div className="relative flex h-8 items-center justify-center rounded-sm">
                      <div className="absolute inset-0 rounded-sm bg-primary" style={{ opacity: c ? 0.12 + (c / f.max) * 0.8 : 0.04 }} />
                      <span className="relative font-medium">{c}</span>
                    </div>
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-3 text-xs text-muted-foreground">Darker = more activity. The biggest drop between two rows is where to improve first.</p>
    </Panel>
  );
}

function Ideas({ orgId }: { orgId: string }) {
  const gen = useServerFn(generateContentIdeas);
  const [niche, setNiche] = useState("");
  const [goal, setGoal] = useState("");
  const [ideas, setIdeas] = useState<ContentIdea[]>([]);
  const m = useMutation({
    mutationFn: () => gen({ data: { organizationId: orgId, niche, goal: goal || undefined } }),
    onSuccess: setIdeas,
    onError: (e) => toast.error((e as Error).message),
  });
  return (
    <div className="space-y-5">
      <Panel title="Get post ideas">
        <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto]">
          <Input placeholder="Your niche, e.g. home baking classes" value={niche} onChange={(e) => setNiche(e.target.value)} />
          <Input placeholder="Goal (optional), e.g. sell my ebook" value={goal} onChange={(e) => setGoal(e.target.value)} />
          <Button onClick={() => m.mutate()} disabled={niche.trim().length < 2 || m.isPending}>
            <Sparkles className="size-4" /> {m.isPending ? "Thinking…" : "Generate ideas"}
          </Button>
        </div>
        <p className="mt-2 text-xs text-muted-foreground">Uses 1 of your daily AI requests.</p>
      </Panel>
      {ideas.length === 0 ? (
        <EmptyState icon={Lightbulb} title="No ideas yet" description="Type your niche and press Generate ideas." />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {ideas.map((i, n) => (
            <div key={n} className="rounded-lg border p-4">
              <div className="flex items-center justify-between gap-2">
                <p className="font-semibold">{i.title}</p>
                <StatusBadge>{i.format}</StatusBadge>
              </div>
              <p className="mt-2 text-sm">“{i.hook}”</p>
              <p className="mt-2 text-xs text-muted-foreground">Comment keyword: <span className="font-mono font-semibold">{i.keyword}</span></p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

const sel = "h-9 rounded-md border border-input bg-background px-2 text-sm";

function Bench({ orgId, data, manager }: { orgId: string; data: Overview; manager: boolean }) {
  const qc = useQueryClient();
  const save = useServerFn(saveCompetitor);
  const del = useServerFn(deleteCompetitor);
  const [f, setF] = useState({ name: "", handle: "", platform: "instagram" as "instagram" | "facebook" | "youtube", followers: "", postsPerWeek: "", avgComments: "" });
  const [yourFollowers, setYourFollowers] = useState("");
  const add = useMutation({
    mutationFn: () => save({ data: { organizationId: orgId, name: f.name, handle: f.handle || undefined, platform: f.platform, followers: Number(f.followers) || 0, postsPerWeek: Number(f.postsPerWeek) || 0, avgComments: Number(f.avgComments) || 0 } }),
    onSuccess: () => { toast.success("Competitor saved"); setF({ ...f, name: "", handle: "", followers: "", postsPerWeek: "", avgComments: "" }); qc.invalidateQueries({ queryKey: ["growth", orgId] }); },
    onError: (e) => toast.error((e as Error).message),
  });
  const remove = useMutation({
    mutationFn: (id: string) => del({ data: { organizationId: orgId, id } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["growth", orgId] }),
    onError: (e) => toast.error((e as Error).message),
  });
  const yf = Number(yourFollowers) || 0;
  const you = { name: "You", followers: yf, postsPerWeek: data.you.postsPerWeek, avgComments: data.you.avgComments, engagementRate: engagementRate(yf, data.you.avgComments), isYou: true };
  const tips = yf > 0 ? benchmarkTips(you, data.competitors) : [];
  const rows = [you, ...data.competitors];

  return (
    <div className="space-y-5">
      <Panel title="You vs competitors">
        <div className="mb-3 flex items-center gap-2 text-sm">
          <span className="text-muted-foreground">Your followers:</span>
          <Input className="h-9 w-40" inputMode="numeric" placeholder="e.g. 12000" value={yourFollowers} onChange={(e) => setYourFollowers(e.target.value.replace(/\D/g, ""))} />
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-xs text-muted-foreground">
              <tr><th className="py-2">Account</th><th>Followers</th><th>Posts / week</th><th>Avg comments / post</th><th>Engagement</th><th /></tr>
            </thead>
            <tbody>
              {rows.map((r: any) => (
                <tr key={r.id ?? "you"} className="border-t">
                  <td className="py-2 font-medium">{r.isYou ? "You" : r.name}{r.handle ? <span className="ml-1 text-xs text-muted-foreground">@{r.handle}</span> : null}</td>
                  <td>{r.followers.toLocaleString("en-IN")}</td>
                  <td>{r.postsPerWeek}</td>
                  <td>{r.avgComments}</td>
                  <td>{r.engagementRate}%</td>
                  <td className="text-right">{!r.isYou && manager && <Button size="icon" variant="ghost" aria-label={`Remove ${r.name}`} onClick={() => remove.mutate(r.id)}><Trash2 className="size-4" /></Button>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {tips.length > 0 && (
          <ul className="mt-4 space-y-1 text-sm">{tips.map((t) => <li key={t} className="flex gap-2"><TrendingUp className="mt-0.5 size-4 text-primary" />{t}</li>)}</ul>
        )}
        <p className="mt-3 text-xs text-muted-foreground">Your numbers come from the last 28 days of published posts and received comments/DMs. Competitor numbers are typed in by you from their public profile.</p>
      </Panel>
      {manager && (
        <Panel title="Add a competitor">
          <div className="grid gap-3 sm:grid-cols-3">
            <Input placeholder="Name" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
            <Input placeholder="@handle" value={f.handle} onChange={(e) => setF({ ...f, handle: e.target.value })} />
            <select className={sel} value={f.platform} onChange={(e) => setF({ ...f, platform: e.target.value as typeof f.platform })}>
              <option value="instagram">Instagram</option><option value="facebook">Facebook</option><option value="youtube">YouTube</option>
            </select>
            <Input inputMode="numeric" placeholder="Followers" value={f.followers} onChange={(e) => setF({ ...f, followers: e.target.value.replace(/\D/g, "") })} />
            <Input inputMode="decimal" placeholder="Posts per week" value={f.postsPerWeek} onChange={(e) => setF({ ...f, postsPerWeek: e.target.value })} />
            <Input inputMode="decimal" placeholder="Avg comments per post" value={f.avgComments} onChange={(e) => setF({ ...f, avgComments: e.target.value })} />
          </div>
          <Button className="mt-3" onClick={() => add.mutate()} disabled={!f.name.trim() || add.isPending}>Save competitor</Button>
        </Panel>
      )}
    </div>
  );
}
