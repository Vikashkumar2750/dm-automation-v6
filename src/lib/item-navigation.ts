/** URL identifiers are hints, never authorization or permission to switch workspaces. */
export function itemSearch(value: Record<string, unknown>, key: "conversation" | "post") {
  const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  const id = typeof value[key] === "string" && uuid.test(value[key]) ? value[key] : undefined;
  const workspace = typeof value.workspace === "string" && uuid.test(value.workspace) ? value.workspace : undefined;
  return { [key]: id, workspace } as { conversation?: string; post?: string; workspace?: string };
}

export function workspaceItemId(id: string | undefined, workspace: string | undefined, activeWorkspace: string | undefined) {
  return activeWorkspace && workspace === activeWorkspace ? id : undefined;
}

export function findWorkspaceItem<T extends { id: string; organization_id: string }>(items: T[], id: string | undefined, workspace: string | undefined) {
  return id && workspace ? items.find((item) => item.id === id && item.organization_id === workspace) : undefined;
}