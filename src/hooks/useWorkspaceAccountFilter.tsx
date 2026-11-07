import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";

export type AccountPlatform = "all" | "instagram" | "facebook" | "youtube";
type Selection = { platform: AccountPlatform; accountId: string };
const EMPTY: Selection = { platform: "all", accountId: "all" };
const Context = createContext<{
  selections: Record<string, Selection>;
  update: (orgId: string, patch: Partial<Selection>) => void;
} | null>(null);

/** Session-scoped selections keyed by workspace; never change the active workspace. */
export function WorkspaceAccountFilterProvider({ children }: { children: ReactNode }) {
  const [selections, setSelections] = useState<Record<string, Selection>>({});
  const update = useCallback((orgId: string, patch: Partial<Selection>) => {
    setSelections((current) => ({ ...current, [orgId]: { ...(current[orgId] ?? EMPTY), ...patch } }));
  }, []);
  const value = useMemo(() => ({ selections, update }), [selections, update]);
  return <Context.Provider value={value}>{children}</Context.Provider>;
}

export function useWorkspaceAccountFilter(orgId: string | null | undefined) {
  const shared = useContext(Context);
  const [local, setLocal] = useState<Record<string, Selection>>({});
  const selection = orgId ? (shared?.selections ?? local)[orgId] ?? EMPTY : EMPTY;
  const update = useCallback((patch: Partial<Selection>) => {
    if (!orgId) return;
    if (shared) shared.update(orgId, patch);
    else setLocal((current) => ({ ...current, [orgId]: { ...(current[orgId] ?? EMPTY), ...patch } }));
  }, [orgId, shared]);
  const setPlatform = useCallback((platform: AccountPlatform) => update({ platform, accountId: "all" }), [update]);
  const setAccountId = useCallback((accountId: string) => update({ accountId }), [update]);
  return { ...selection, setPlatform, setAccountId };
}