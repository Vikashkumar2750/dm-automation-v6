import { AccountSelect } from "@/components/app/AccountSelect";
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
import { autofillProfile, deleteCompetitor, generateContentPlan, getGrowthOverview, getProfileSources, saveCompetitor, type PlanDay } from "@/lib/growth.functions";
import { AI_USAGE_KEY, AiCreditBadge } from "@/components/app/AiCreditBadge";

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
  const [accountId, setAccountId] = useState("all");
  const q = useQuery({ queryKey: ["growth", orgId, accountId], enabled: !!orgId, refetchInterval: 300_000, queryFn: () => fetchOverview({ data: { organizationId: orgId!, ...(accountId !== "all" ? { socialAccountId: accountId } : {}) } }) });
  const role = activeOrg?.role;
  const manager = role === "owner" || role === "admin" || role === "manager";

  return (
    <AppShell>
      <PageHeader title="Growth insights" description="When to post, what to post, and where your DM funnel leaks." actions={<div className="flex flex-wrap items-center gap-2"><AccountSelect orgId={orgId ?? null} value={accountId} onChange={setAccountId} className="h-9 w-auto max-w-[240px]" /><GuideButton guide="growth" /></div>} />
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
            <TabsContent value="ideas"><Ideas orgId={orgId} bestTimes={(q.data?.best ?? []).map((b) => b.label)} /></TabsContent>
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

function Ideas({ orgId, bestTimes }: { orgId: string; bestTimes: string[] }) {
  const qc = useQueryClient();
  const refreshUsage = () => qc.invalidateQueries({ queryKey: AI_USAGE_KEY });
  const gen = useServerFn(generateContentPlan);
  const fill = useServerFn(autofillProfile);
  const fetchSources = useServerFn(getProfileSources);
  const sources = useQuery({ queryKey: ["growth-sources", orgId], queryFn: () => fetchSources({ data: { organizationId: orgId } }) });
  const [src, setSrc] = useState({ website: "", instagram: "", facebook: "", youtube: "" });
  const [touched, setTouched] = useState(false);
  const s = touched ? src : { ...src, ...Object.fromEntries(Object.entries(sources.data ?? {}).filter(([k]) => k in src)) };
  const setS = (k: keyof typeof src, v: string) => { setSrc({ ...s, [k]: v }); setTouched(true); };
  const [niche, setNiche] = useState("");
  const [goal, setGoal] = useState("");
  const [topic, setTopic] = useState("");
  const [language, setLanguage] = useState<"English" | "Hinglish" | "Hindi">("English");
  const [plan, setPlan] = useState<PlanDay[]>([]);
  const auto = useMutation({
    mutationFn: () => fill({ data: { organizationId: orgId, website: s.website || undefined, instagram: s.instagram || undefined, facebook: s.facebook || undefined, youtube: s.youtube || undefined } }),
    onSuccess: (r) => { setNiche(r.niche); setGoal(r.goal); toast.success("Niche and goal filled — edit if needed"); },
    onError: (e) => toast.error((e as Error).message),
    onSettled: refreshUsage,
  });
  const m = useMutation({
    mutationFn: () => gen({ data: { organizationId: orgId, niche, goal: goal || undefined, topic: topic || undefined, bestTimes, language } }),
    onSuccess: (r) => setPlan(r as PlanDay[]),
    onError: (e) => toast.error((e as Error).message),
    onSettled: refreshUsage,
  });
  const copy = (t: string) => { navigator.clipboard.writeText(t); toast.success("Copied"); };
  const full = (d: PlanDay) => `${d.caption}\n\n${d.hashtags.join(" ")}`;
  const exportAll = () => {
    const text = plan.map((d) => `DAY ${d.day} — ${d.title} (${d.format}, ${d.platform}, ${d.postTime})\nTheme: ${d.theme}\nHook: ${d.hook}\n\nScript:\n${d.script}\n\nCaption:\n${full(d)}\n\nComment keyword: ${d.keyword}\nAuto DM: ${d.dmReply}`).join("\n\n-----\n\n");
    const url = URL.createObjectURL(new Blob([text], { type: "text/plain" }));
    const a = document.createElement("a"); a.href = url; a.download = "7-day-content-plan.txt"; a.click(); URL.revokeObjectURL(url);
  };
  return (
    <div className="space-y-5">
      <Panel title="1. Auto-fill from your website or handles (optional)">
        <div className="grid gap-3 sm:grid-cols-2">
          <Input placeholder="Website, e.g. mybakery.in" value={s.website} onChange={(e) => setS("website", e.target.value)} />
          <Input placeholder="Instagram handle, e.g. @mybakery" value={s.instagram} onChange={(e) => setS("instagram", e.target.value)} />
          <Input placeholder="Facebook page name or link" value={s.facebook} onChange={(e) => setS("facebook", e.target.value)} />
          <Input placeholder="YouTube handle, e.g. @mybakery" value={s.youtube} onChange={(e) => setS("youtube", e.target.value)} />
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <Button variant="outline" onClick={() => auto.mutate()} disabled={auto.isPending || !Object.values(s).some((v) => v.trim())}>
            <Sparkles className="size-4" /> {auto.isPending ? "Reading…" : "Auto-fill niche & goal"}
          </Button>
          <AiCreditBadge />
        </div>
      </Panel>
      <Panel title="2. Your 7-day plan">
        <div className="grid gap-3 sm:grid-cols-2">
          <Input placeholder="Your niche, e.g. home baking classes" value={niche} onChange={(e) => setNiche(e.target.value)} />
          <Input placeholder="Goal (optional), e.g. sell my ebook" value={goal} onChange={(e) => setGoal(e.target.value)} />
          <Input placeholder="Specific topic this week (optional), e.g. Diwali sweets" value={topic} onChange={(e) => setTopic(e.target.value)} />
          <select className={sel} value={language} onChange={(e) => setLanguage(e.target.value as typeof language)} aria-label="Language">
            <option>English</option><option>Hinglish</option><option>Hindi</option>
          </select>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <Button onClick={() => m.mutate()} disabled={niche.trim().length < 2 || m.isPending}>
            <Sparkles className="size-4" /> {m.isPending ? "Writing your week… (up to 1 min)" : "Generate 7-day plan"}
          </Button>
          <AiCreditBadge />
          {plan.length > 0 && <Button variant="outline" onClick={exportAll}>Download plan</Button>}
        </div>
      </Panel>
      {plan.length === 0 ? (
        <EmptyState icon={Lightbulb} title="No plan yet" description="Fill your niche (or use Auto-fill) and press Generate 7-day plan." />
      ) : (
        <div className="grid gap-3 lg:grid-cols-2">
          {plan.map((d) => (
            <div key={d.day} className="space-y-2 rounded-lg border p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-semibold">Day {d.day} · {d.title}</p>
                <div className="flex gap-1"><StatusBadge>{d.format}</StatusBadge><StatusBadge>{d.platform}</StatusBadge></div>
              </div>
              <p className="text-xs text-muted-foreground">{d.theme}{d.postTime ? ` · Post at ${d.postTime}` : ""}</p>
              <p className="text-sm font-medium">“{d.hook}”</p>
              <details className="text-sm"><summary className="cursor-pointer text-muted-foreground">Script / slides</summary><p className="mt-1 whitespace-pre-line">{d.script}</p></details>
              <p className="whitespace-pre-line text-sm">{d.caption}</p>
              <p className="text-xs text-muted-foreground">{d.hashtags.join(" ")}</p>
              {d.keyword && <p className="text-xs">Comment keyword: <span className="font-mono font-semibold">{d.keyword}</span>{d.dmReply ? <> → DM: “{d.dmReply}”</> : null}</p>}
              <div className="flex gap-2 pt-1">
                <Button size="sm" variant="outline" onClick={() => copy(full(d))}>Copy caption</Button>
                {d.dmReply && <Button size="sm" variant="ghost" onClick={() => copy(d.dmReply)}>Copy DM</Button>}
              </div>
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
