import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Search, FileText, MessageSquare, Workflow, PenSquare, Clock, Loader2 } from "lucide-react";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/hooks/useTenant";

export type SearchPage = { label: string; to: string };

const RECENT_KEY = "autodm_recent_search";

type Hit = { id: string; label: string; sub?: string; to: string };

function useDebounced<T>(value: T, ms: number) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}

// Escape characters that have meaning inside a PostgREST ilike/or filter.
function safeTerm(q: string) {
  return q.replace(/[%_,()*\\]/g, " ").trim();
}

export function CommandSearch({ pages }: { pages: SearchPage[] }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [recent, setRecent] = useState<SearchPage[]>([]);
  const navigate = useNavigate();
  const { activeOrg } = useTenant();
  const orgId = activeOrg?.id;
  const term = safeTerm(useDebounced(query, 250));

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    window.addEventListener("keydown", onKey);
    try { setRecent(JSON.parse(localStorage.getItem(RECENT_KEY) || "[]")); } catch { /* ignore */ }
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const results = useQuery({
    queryKey: ["command-search", orgId, term],
    enabled: open && !!orgId && term.length >= 2,
    staleTime: 30_000,
    queryFn: async () => {
      const like = `%${term}%`;
      const [convos, rules, posts] = await Promise.all([
        supabase.from("conversations").select("id, external_user_name, last_message_preview, platform")
          .eq("organization_id", orgId!).or(`external_user_name.ilike.${like},last_message_preview.ilike.${like}`)
          .order("last_message_at", { ascending: false }).limit(5),
        supabase.from("automation_rules").select("id, name, platform")
          .eq("organization_id", orgId!).ilike("name", like).limit(5),
        supabase.from("posts").select("id, caption, platform, status")
          .eq("organization_id", orgId!).ilike("caption", like).order("created_at", { ascending: false }).limit(5),
      ]);
      const err = convos.error || rules.error || posts.error;
      if (err) throw err;
      return {
        conversations: (convos.data ?? []).map((c): Hit => ({ id: c.id, label: c.external_user_name || "Unknown contact", sub: `${c.platform} · ${c.last_message_preview ?? ""}`, to: "/inbox" })),
        automations: (rules.data ?? []).map((r): Hit => ({ id: r.id, label: r.name ?? "Untitled automation", sub: r.platform ?? undefined, to: "/automations" })),
        posts: (posts.data ?? []).map((p): Hit => ({ id: p.id, label: (p.caption || "Untitled post").slice(0, 80), sub: `${p.platform} · ${p.status}`, to: "/calendar" })),
      };
    },
  });

  function go(label: string, to: string) {
    const next = [{ label, to }, ...recent.filter((r) => r.label !== label)].slice(0, 5);
    setRecent(next);
    try { localStorage.setItem(RECENT_KEY, JSON.stringify(next)); } catch { /* ignore */ }
    setOpen(false);
    setQuery("");
    navigate({ to });
  }

  const q = query.trim().toLowerCase();
  const pageHits = q ? pages.filter((p) => p.label.toLowerCase().includes(q)) : [];
  const data = results.data;
  const groups: { title: string; icon: typeof FileText; hits: Hit[] }[] = data
    ? [
        { title: "Conversations & contacts", icon: MessageSquare, hits: data.conversations },
        { title: "Automations", icon: Workflow, hits: data.automations },
        { title: "Posts", icon: PenSquare, hits: data.posts },
      ]
    : [];

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="relative mx-auto hidden h-10 w-full max-w-lg items-center rounded-lg border bg-surface-secondary pr-3 pl-9 text-left text-sm text-subtle-foreground hover:border-ring focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none md:flex"
      >
        <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2" />
        <span className="flex-1 truncate">Search pages, chats, automations, posts…</span>
        <kbd className="rounded border bg-surface px-1.5 py-0.5 text-[10px] font-medium">Ctrl K</kbd>
      </button>
      <button type="button" onClick={() => setOpen(true)} className="inline-flex size-9 items-center justify-center rounded-md hover:bg-surface-secondary md:hidden" aria-label="Search">
        <Search className="size-5" />
      </button>

      <CommandDialog open={open} onOpenChange={setOpen}>
        <CommandInput placeholder="Search pages, chats, automations, posts…" value={query} onValueChange={setQuery} />
        <CommandList>
          {!q && recent.length > 0 && (
            <CommandGroup heading="Recent">
              {recent.map((r) => (
                <CommandItem key={`r-${r.label}`} value={`recent ${r.label}`} onSelect={() => go(r.label, r.to)}>
                  <Clock className="mr-2 size-4" /> {r.label}
                </CommandItem>
              ))}
            </CommandGroup>
          )}
          {!q && (
            <CommandGroup heading="Pages">
              {pages.map((p) => (
                <CommandItem key={p.to} value={`page ${p.label}`} onSelect={() => go(p.label, p.to)}>
                  <FileText className="mr-2 size-4" /> {p.label}
                </CommandItem>
              ))}
            </CommandGroup>
          )}
          {pageHits.length > 0 && (
            <CommandGroup heading="Pages">
              {pageHits.map((p) => (
                <CommandItem key={p.to} value={`page ${p.label} ${query}`} onSelect={() => go(p.label, p.to)}>
                  <FileText className="mr-2 size-4" /> {p.label}
                </CommandItem>
              ))}
            </CommandGroup>
          )}
          {groups.map((g) => g.hits.length > 0 && (
            <CommandGroup key={g.title} heading={g.title}>
              {g.hits.map((h) => (
                <CommandItem key={h.id} value={`${g.title} ${h.id} ${query}`} onSelect={() => go(h.label, h.to)}>
                  <g.icon className="mr-2 size-4 shrink-0" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate">{h.label}</span>
                    {h.sub && <span className="block truncate text-xs text-muted-foreground">{h.sub}</span>}
                  </span>
                </CommandItem>
              ))}
            </CommandGroup>
          ))}
          {q.length >= 2 && results.isFetching && (
            <div className="flex items-center gap-2 px-4 py-3 text-sm text-muted-foreground"><Loader2 className="size-4 animate-spin" /> Searching…</div>
          )}
          {results.isError && <div className="px-4 py-3 text-sm text-destructive">Search failed. Please try again.</div>}
          {q && !results.isFetching && <CommandEmpty>No results for “{query}”.</CommandEmpty>}
        </CommandList>
      </CommandDialog>
    </>
  );
}
