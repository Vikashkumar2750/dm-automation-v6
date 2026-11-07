import { createContext, createElement, useContext, useState, type ReactNode } from "react";

export const INITIAL_SIDEBAR_GROUP: string | null = null;

export function nextSidebarGroup(current: string | null, clicked: string): string | null {
  return current === clicked ? null : clicked;
}

type Scope = "user" | "admin";
type Groups = Record<Scope, string | null>;
const SidebarGroupContext = createContext<{
  groups: Groups;
  toggle: (scope: Scope, group: string) => void;
} | null>(null);

export function SidebarGroupProvider({ children }: { children: ReactNode }) {
  const [groups, setGroups] = useState<Groups>({ user: null, admin: null });
  const toggle = (scope: Scope, group: string) => setGroups((current) => ({
    ...current, [scope]: nextSidebarGroup(current[scope], group),
  }));
  return createElement(SidebarGroupContext.Provider, { value: { groups, toggle } }, children);
}

export function useSidebarGroup(scope: Scope = "user") {
  const shared = useContext(SidebarGroupContext);
  // Local fallback keeps isolated consumers usable; app shells use the persistent provider.
  const [localGroup, setLocalGroup] = useState<string | null>(INITIAL_SIDEBAR_GROUP);
  const toggleGroup = (group: string) => {
    if (shared) shared.toggle(scope, group);
    else setLocalGroup((current) => nextSidebarGroup(current, group));
  };
  return { openGroup: shared ? shared.groups[scope] : localGroup, toggleGroup };
}