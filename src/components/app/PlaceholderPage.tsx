import type { LucideIcon } from "lucide-react";

import { AppShell } from "@/components/app/AppShell";
import { EmptyState, PageHeader } from "@/components/app/primitives";

export function PlaceholderPage({
  title,
  description,
  icon,
  emptyTitle,
  emptyDescription,
  phase,
}: {
  title: string;
  description: string;
  icon: LucideIcon;
  emptyTitle: string;
  emptyDescription: string;
  phase: string;
}) {
  return (
    <AppShell>
      <PageHeader title={title} description={description} />
      <EmptyState
        icon={icon}
        title={emptyTitle}
        description={emptyDescription}
        action={
          <p className="text-xs text-subtle-foreground">Scheduled for {phase}</p>
        }
      />
    </AppShell>
  );
}
