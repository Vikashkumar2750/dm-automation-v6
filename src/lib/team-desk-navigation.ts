export type TeamDeskTab = "members" | "inbox" | "approvals" | "reports" | "api";

export function teamDeskNeedsInbox(tab: string): boolean {
  return tab === "inbox" || tab === "approvals";
}

export function teamDeskTab(requested: unknown, advanced: boolean, reviewer: boolean): TeamDeskTab {
  if (!advanced || requested === "members") return "members";
  if (requested === "api") return reviewer ? "api" : "inbox";
  if (requested === "approvals" || requested === "reports") return requested;
  return "inbox";
}