import type { ReactNode } from "react";
import { TabsContent } from "@/components/ui/tabs";

export function RetainedSettingsTab({ value, active, visited, children }: { value: string; active: string; visited: string[]; children: ReactNode }) {
  if (!visited.includes(value)) return null;
  return <TabsContent forceMount value={value} hidden={active !== value} className="space-y-6 data-[state=inactive]:hidden">{children}</TabsContent>;
}