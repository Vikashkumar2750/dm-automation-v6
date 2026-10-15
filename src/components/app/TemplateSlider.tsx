import { Link } from "@tanstack/react-router";
import { ChevronLeft, ChevronRight, Sparkles } from "lucide-react";
import { useRef } from "react";

import { Button } from "@/components/ui/button";
import { MESSAGE_TEMPLATES } from "@/lib/rule-templates";

/** Automation template cards: 4 visible, then a slider (wheel, arrows, touch). */
export function TemplateSlider({ canCreate, onNeedAccount }: { canCreate: boolean; onNeedAccount: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const scroll = (dir: number) => ref.current?.scrollBy({ left: dir * (ref.current.clientWidth * 0.8), behavior: "smooth" });
  const many = MESSAGE_TEMPLATES.length > 4;
  return (
    <div className="relative">
      {many && (
        <div className="mb-2 flex justify-end gap-1">
          <Button size="icon" variant="outline" className="size-8" aria-label="Previous templates" onClick={() => scroll(-1)}><ChevronLeft className="size-4" /></Button>
          <Button size="icon" variant="outline" className="size-8" aria-label="Next templates" onClick={() => scroll(1)}><ChevronRight className="size-4" /></Button>
        </div>
      )}
      <div
        ref={ref}
        onWheel={(e) => { if (many && ref.current && Math.abs(e.deltaY) > Math.abs(e.deltaX)) { ref.current.scrollLeft += e.deltaY; } }}
        className="flex snap-x snap-mandatory gap-3 overflow-x-auto overscroll-x-contain pb-2 [scrollbar-width:thin]"
      >
        {MESSAGE_TEMPLATES.map((t) => (
          <div key={t.label} className="flex w-[80%] shrink-0 snap-start flex-col rounded-lg border bg-surface-secondary p-4 sm:w-[calc((100%-0.75rem)/2)] xl:w-[calc((100%-2.25rem)/4)]">
            <div className="flex items-center gap-2 text-sm font-semibold"><Sparkles className="size-4 text-primary" />{t.label}</div>
            <p className="mt-2 line-clamp-3 flex-1 text-xs text-muted-foreground">{t.text}</p>
            {canCreate ? (
              <Button asChild size="sm" variant="outline" className="mt-3">
                <Link to="/automations" search={{ template: t.label }}>Use template</Link>
              </Button>
            ) : (
              <Button size="sm" variant="outline" className="mt-3" onClick={onNeedAccount}>Use template</Button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
