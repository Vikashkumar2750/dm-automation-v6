export type TeamDeskTab = "members" | "inbox" | "approvals" | "reports" | "api";

export function teamDeskTab(requested: unknown, advanced: boolean, reviewer: boolean): TeamDeskTab {
  if (!advanced || requested === "members") return "members";
  if (requested === "api") return reviewer ? "api" : "inbox";
  if (requested === "approvals" || requested === "reports") return requested;
  return "inbox";
}