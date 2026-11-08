import { Instagram, Facebook, Youtube, Info, type LucideIcon } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import type { ReactNode } from "react";

import { cn } from "@/lib/utils";
import type { Platform } from "@/lib/demo-data";

/* ---------------- Panel ---------------- */

export function Panel({
  title,
  description,
  action,
  children,
  className,
  bodyClassName,
}: {
  title?: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
}) {
  return (
    <section className={cn("dashboard-panel panel flex min-w-0 flex-col", className)}>
      {(title || action) && (
        <header className="grid min-w-0 gap-3 border-b px-4 py-4 sm:flex sm:items-center sm:justify-between sm:px-6 sm:py-5">
          <div className="min-w-0">
            <h2 className="min-w-0 break-words text-lg font-semibold text-foreground sm:text-xl">{title}</h2>
            {description && <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{description}</p>}
          </div>
          {action && <div className="flex min-w-0 flex-wrap items-center gap-2">{action}</div>}
        </header>
      )}
      <div className={cn("min-w-0 p-4 sm:p-6", bodyClassName)}>{children}</div>
    </section>
  );
}

/* ---------------- Platform badge ---------------- */

const platformIcon: Record<Platform, LucideIcon> = {
  instagram: Instagram,
  facebook: Facebook,
  youtube: Youtube,
};

const platformTone: Record<Platform, string> = {
  instagram: "text-instagram",
  facebook: "text-facebook",
  youtube: "text-youtube",
};

export function PlatformBadge({
  platform,
  size = "md",
  withLabel,
}: {
  platform: Platform;
  size?: "sm" | "md";
  withLabel?: string;
}) {
  const Icon = platformIcon[platform];
  return (
    <span className="inline-flex min-w-0 max-w-full items-center gap-2">
      <span
        className={cn(
          "inline-flex shrink-0 items-center justify-center rounded-md border bg-surface-secondary",
          platformTone[platform],
          size === "sm" ? "size-6" : "size-9",
        )}
      >
        <Icon className={size === "sm" ? "size-3.5" : "size-5"} />
      </span>
      {withLabel && <span className="min-w-0 break-words text-sm font-medium">{withLabel}</span>}
    </span>
  );
}

/* ---------------- Status badge ---------------- */

type Tone = "success" | "warning" | "danger" | "info" | "neutral" | "ai";

const toneClass: Record<Tone, string> = {
  success: "bg-success-soft text-success",
  warning: "bg-warning-soft text-warning",
  danger: "bg-danger-soft text-danger",
  info: "bg-info-soft text-info",
  ai: "bg-ai-soft text-ai",
  neutral: "bg-surface-secondary text-muted-foreground",
};

export function StatusBadge({
  children,
  tone = "neutral",
}: {
  children: ReactNode;
  tone?: Tone;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium",
        toneClass[tone],
      )}
    >
      {children}
    </span>
  );
}

/* ---------------- Stat card ---------------- */

export function StatCard({
  icon: Icon,
  label,
  value,
  delta,
  sub,
  info,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  delta?: string;
  sub?: string;
  /** Plain explanation of what this card counts, shown behind an "i" button. */
  info?: string;
}) {
  return (
    <div className="panel p-5">
      <div className="flex items-start gap-3">
        <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-lg bg-surface-secondary text-primary">
          <Icon className="size-4.5" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <p className="min-w-0 break-words text-sm text-muted-foreground">{label}</p>
            {info && (
              <Popover>
                <PopoverTrigger asChild>
                  <button type="button" aria-label={`What is ${label}?`} className="shrink-0 rounded-full text-subtle-foreground hover:text-foreground">
                    <Info className="size-4" />
                  </button>
                </PopoverTrigger>
                <PopoverContent className="w-64 text-sm">{info}</PopoverContent>
              </Popover>
            )}
          </div>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="num text-2xl font-semibold">{value}</span>
            {delta && (
              <span className="text-xs font-medium text-success">{delta}</span>
            )}
          </div>
          {sub && <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{sub}</p>}
        </div>
      </div>
    </div>
  );
}

/* ---------------- Usage meter ---------------- */

export function UsageMeter({
  label,
  used,
  limit,
  unit,
}: {
  label: string;
  used: number;
  limit: number;
  unit?: string;
}) {
  const pct = Math.min(100, Math.round((used / limit) * 100));
  const tone = pct >= 90 ? "bg-danger" : pct >= 70 ? "bg-warning" : "bg-primary";
  return (
    <div>
      <div className="flex items-baseline justify-between">
        <span className="text-sm font-medium">{label}</span>
        <span className="num text-sm text-muted-foreground">{pct}%</span>
      </div>
      <div className="mt-2 h-2 overflow-hidden rounded-full bg-surface-secondary">
        <div className={cn("h-full rounded-full", tone)} style={{ width: `${pct}%` }} />
      </div>
      <p className="num mt-1.5 text-xs text-subtle-foreground">
        {used.toLocaleString("en-IN")} / {limit.toLocaleString("en-IN")} {unit ?? ""}
      </p>
    </div>
  );
}

/* ---------------- Empty state ---------------- */

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed px-6 py-16 text-center">
      <span className="inline-flex size-11 items-center justify-center rounded-xl bg-surface-secondary text-muted-foreground">
        <Icon className="size-5" />
      </span>
      <h3 className="mt-4 text-base font-semibold">{title}</h3>
      <p className="mt-1 max-w-sm text-sm text-muted-foreground">{description}</p>
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

/* ---------------- Page header ---------------- */

export function PageHeader({
  title,
  description,
  actions,
}: {
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div className="mb-8 grid min-w-0 gap-4 sm:flex sm:flex-wrap sm:items-start sm:justify-between">
      <div className="min-w-0">
        <h1 className="break-words text-2xl font-semibold text-foreground sm:text-3xl">{title}</h1>
        {description && (
          <p className="mt-2 max-w-3xl text-sm leading-relaxed text-muted-foreground sm:text-base">{description}</p>
        )}
      </div>
      {actions && <div className="flex min-w-0 flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

/* ---------------- Section header (inside pages and long forms) ---------------- */

export function SectionHeader({ title, description, icon: Icon, action, className }: { title: ReactNode; description?: ReactNode; icon?: LucideIcon; action?: ReactNode; className?: string }) {
  return (
    <div className={cn("flex min-w-0 flex-wrap items-start justify-between gap-3", className)}>
      <div className="flex min-w-0 items-start gap-3">
        {Icon && <span className="mt-0.5 grid size-9 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary"><Icon className="size-4.5" /></span>}
        <div className="min-w-0">
          <h2 className="text-lg font-semibold tracking-tight text-foreground sm:text-xl">{title}</h2>
          {description && <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{description}</p>}
        </div>
      </div>
      {action && <div className="flex flex-wrap items-center gap-2">{action}</div>}
    </div>
  );
}
