/** Summarizes only the returned lead rows; never represents an all-time total. */
export function summarizeDashboardLeads(leads: ReadonlyArray<{ answers: Record<string, string> }>) {
  const completed = leads.filter((lead) => !lead.answers["_stage"] || lead.answers["_stage"] === "completed").length;
  return { captured: leads.length, completed, incomplete: leads.length - completed };
}