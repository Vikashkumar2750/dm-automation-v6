import { Link } from "@tanstack/react-router";
import { ChevronLeft, ChevronRight, CornerDownRight } from "lucide-react";
import { useRef, useState, type ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { DASH_CATEGORIES, templatesFor, type DashCategory, type DashTemplate } from "@/lib/dashboard-templates";

function Card({ t }: { t: DashTemplate }) {
  return (
    <div className={cn("flex h-full flex-col rounded-2xl border-2 bg-card p-4 text-left transition hover:border-foreground/40", t.highlight ? "border-foreground/30" : "border-border")}>
      <div className="text-base font-bold leading-tight">{t.title}</div>
      <p className="mt-1 text-sm text-muted-foreground">{t.description}</p>
      <div className="mt-3 flex-1 px-2">
        <div className="flex items-center gap-2 rounded-xl border bg-background p-2 shadow-sm">
          <div className="grid size-8 shrink-0 place-items-center rounded-full bg-muted text-xs font-bold uppercase">{t.user[0]}</div>
          <div className="min-w-0">
            <div className="truncate text-xs font-semibold">{t.user}</div>
            <div className="truncate text-xs text-muted-foreground">{t.incoming}</div>
          </div>
        </div>
        <div className="mt-1 flex items-start gap-1">
          <CornerDownRight className="mt-1 size-4 shrink-0 text-muted-foreground" />
          <div className={cn("rounded-xl p-2.5 text-xs", t.highlight ? "bg-primary text-primary-foreground" : "bg-muted-foreground text-background")}>
            <div className="font-medium">{t.reply}</div>
            <div className="mt-1.5 rounded-md bg-background/25 px-2 py-1 text-center font-semibold">{t.button}</div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function TemplateSlider({ canCreate, onNeedAccount }: { canCreate: boolean; onNeedAccount: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const [cat, setCat] = useState<DashCategory | "all">("all");
  const list = templatesFor(cat);
  const meta = DASH_CATEGORIES.find((c) => c.key === cat)!;
  const many = list.length > 4;
  const scroll = (dir: number) => ref.current?.scrollBy({ left: dir * ref.current.clientWidth * 0.8, behavior: "smooth" });
  const wrap = (t: DashTemplate, card: ReactNode) =>
    canCreate ? (
      <Link key={t.key} to="/automations" search={{ template: t.key }} aria-label={`Use template: ${t.title}`} className="block h-full">{card}</Link>
    ) : (
      <button key={t.key} type="button" onClick={onNeedAccount} aria-label={`Use template: ${t.title}`} className="block h-full w-full">{card}</button>
    );
  return (
    <div>
      <p className="-mt-2 mb-3 text-sm text-muted-foreground">Pre-filled automations to get you started. Pick one, customize the message and link, then go live.</p>
      <div className="flex flex-wrap gap-2">
        {DASH_CATEGORIES.map((c) => (
          <button key={c.key} type="button" onClick={() => { setCat(c.key); ref.current?.scrollTo({ left: 0 }); }}
            className={cn("rounded-full border px-4 py-1.5 text-sm font-semibold transition", cat === c.key ? "border-foreground bg-foreground text-background" : "hover:bg-muted")}>
            {c.label}
          </button>
        ))}
      </div>
      <div className="mt-5 flex items-end justify-between gap-2">
        <div>
          <div className="text-lg font-bold">{meta.title}</div>
          <div className="text-sm text-muted-foreground">{meta.sub} · {list.length} templates</div>
        </div>
        {many && (
          <div className="flex gap-1">
            <Button size="icon" variant="outline" className="size-8" aria-label="Previous templates" onClick={() => scroll(-1)}><ChevronLeft className="size-4" /></Button>
            <Button size="icon" variant="outline" className="size-8" aria-label="Next templates" onClick={() => scroll(1)}><ChevronRight className="size-4" /></Button>
          </div>
        )}
      </div>
      <div ref={ref}
        onWheel={(e) => { if (many && ref.current && Math.abs(e.deltaY) > Math.abs(e.deltaX)) ref.current.scrollLeft += e.deltaY; }}
        className="mt-3 flex snap-x snap-mandatory gap-3 overflow-x-auto overscroll-x-contain pb-2 [scrollbar-width:thin]">
        {list.map((t) => (
          <div key={t.key} className="w-[80%] shrink-0 snap-start sm:w-[calc((100%-0.75rem)/2)] xl:w-[calc((100%-2.25rem)/4)]">
            {wrap(t, <Card t={t} />)}
          </div>
        ))}
      </div>
    </div>
  );
}
