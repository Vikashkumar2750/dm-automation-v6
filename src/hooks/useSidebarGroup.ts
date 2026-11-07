import { useState } from "react";

export const INITIAL_SIDEBAR_GROUP: string | null = null;

export function nextSidebarGroup(current: string | null, clicked: string): string | null {
  return current === clicked ? null : clicked;
}

export function useSidebarGroup() {
  const [openGroup, setOpenGroup] = useState<string | null>(INITIAL_SIDEBAR_GROUP);
  const toggleGroup = (group: string) => setOpenGroup((current) => nextSidebarGroup(current, group));
  return { openGroup, toggleGroup };
}