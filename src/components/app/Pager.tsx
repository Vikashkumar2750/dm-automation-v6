import { Button } from "@/components/ui/button";

/** Simple Previous / Page X of Y / Next control. Renders nothing for a single page. */
export function Pager({ page, total, perPage, onPage }: { page: number; total: number; perPage: number; onPage: (p: number) => void }) {
  const pages = Math.max(1, Math.ceil(total / perPage));
  if (pages <= 1) return null;
  return (
    <div className="flex items-center justify-between gap-2 pt-3">
      <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => onPage(page - 1)}>Previous</Button>
      <span className="text-xs text-muted-foreground">Page {page} of {pages}</span>
      <Button size="sm" variant="outline" disabled={page >= pages} onClick={() => onPage(page + 1)}>Next</Button>
    </div>
  );
}

export function pageSlice<T>(rows: T[], page: number, perPage: number): T[] {
  const pages = Math.max(1, Math.ceil(rows.length / perPage));
  const p = Math.min(Math.max(page, 1), pages);
  return rows.slice((p - 1) * perPage, p * perPage);
}
