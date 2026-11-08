import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { CheckCircle2, AlertTriangle, XCircle, PlayCircle } from "lucide-react";

import { Panel } from "@/components/app/primitives";
import { Button } from "@/components/ui/button";
import { runSelfCheck } from "@/lib/self-check.functions";

const icon = { pass: CheckCircle2, warn: AlertTriangle, fail: XCircle } as const;
const tone = { pass: "text-success", warn: "text-warning", fail: "text-destructive" } as const;

export function SelfCheckPanel() {
  const run = useServerFn(runSelfCheck);
  const m = useMutation({ mutationFn: () => run() });
  const results = m.data?.results ?? [];
  const fails = results.filter((r) => r.status === "fail").length;
  return (
    <Panel
      title="Automated self-check"
      description="One click checks tables, plans, scheduler, webhook safety, paid-file privacy and Team Desk. Read-only — nothing is sent."
    >
      <div className="flex flex-wrap items-center gap-3">
        <Button onClick={() => m.mutate()} disabled={m.isPending}>
          <PlayCircle className="size-4" /> {m.isPending ? "Checking…" : "Run self-check"}
        </Button>
        {m.data && (
          <span className="text-sm text-muted-foreground">
            {fails ? `${fails} problem(s) found` : "All checks passed or need only attention"} · {new Date(m.data.ranAt).toLocaleTimeString()}
          </span>
        )}
      </div>
      {m.isError && <p role="alert" className="mt-3 text-sm text-destructive">Self-check could not run. Try again.</p>}
      {results.length > 0 && (
        <ul className="mt-4 divide-y divide-border rounded-md border border-border">
          {results.map((r) => {
            const Icon = icon[r.status];
            return (
              <li key={r.id} className="flex items-start gap-3 px-4 py-3">
                <Icon className={`mt-0.5 size-5 shrink-0 ${tone[r.status]}`} />
                <div className="min-w-0">
                  <p className="text-sm font-medium">{r.label} <span className="text-xs font-normal text-muted-foreground">· {r.area}</span></p>
                  <p className="break-words text-sm text-muted-foreground">{r.detail}</p>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </Panel>
  );
}
