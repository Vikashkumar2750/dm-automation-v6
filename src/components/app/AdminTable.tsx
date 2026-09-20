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
    <div className="overflow-x-auto">
      <table className="w-full text-sm" style={{ minWidth }}>
        <thead className="text-left text-xs tracking-wide text-muted-foreground uppercase">
          <tr>
            {columns.map((c) => (
              <th key={c.header} className="pb-2">
                {c.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id} className="border-t border-border align-top">
              {columns.map((c) => (
                <td key={c.header} className={c.className ?? "py-3"}>
                  {c.cell(row)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
