import type { ReactNode } from "react";

export type Column<T> = {
  header: string;
  cell: (row: T) => ReactNode;
  className?: string;
};

export function AdminTable<T extends { id: string }>({
  rows,
  columns,
  minWidth = 720,
}: {
  rows: T[];
  columns: Column<T>[];
  minWidth?: number;
}) {
  return (
    <div className="min-w-0 max-w-full overflow-x-auto">
      <table className="block w-full min-w-0 text-sm sm:table sm:min-w-[var(--admin-table-width)]" style={{ "--admin-table-width": `${minWidth}px` } as React.CSSProperties}>
        <thead className="hidden text-left text-xs text-muted-foreground uppercase sm:table-header-group">
          <tr>
            {columns.map((c) => (
              <th key={c.header} className="pb-2">
                {c.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="block divide-y sm:table-row-group sm:divide-y-0">
          {rows.map((row) => (
            <tr key={row.id} className="block space-y-3 py-4 align-top sm:table-row sm:space-y-0 sm:border-t sm:border-border sm:py-0">
              {columns.map((c) => (
                <td key={c.header} className={`block min-w-0 max-w-full sm:table-cell ${c.className ?? "sm:py-3"}`}>
                  <span className="mb-1 block text-xs font-medium text-muted-foreground sm:hidden">{c.header}</span>
                  <div className="min-w-0 max-w-full overflow-x-auto break-words">{c.cell(row)}</div>
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
