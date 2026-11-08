export function createTenantSelection() {
  const selected = new Map<string, string | null>();
  const listeners = new Set<() => void>();
  return {
    get: (userId: string) => selected.get(userId) ?? null,
    has: (userId: string) => selected.has(userId),
    set(userId: string, orgId: string | null) {
      if (selected.has(userId) && selected.get(userId) === orgId) return;
      selected.set(userId, orgId);
      listeners.forEach((listener) => listener());
    },
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => { listeners.delete(listener); };
    },
  };
}