import type { AutomationRun } from "./automations.functions";
import { groupRuns, type RunGroup } from "./activity-groups";

export type ActivityJourney = { key: string; groups: RunGroup[]; startKey: string | null; endKey: string | null };

const code = (row: AutomationRun) => (row.detail ?? "").toLowerCase();
const isClick = (row: AutomationRun) => /^click:(link|attachment)/.test(code(row));
const isContinuation = (group: RunGroup) => group.steps.some((row) => /^(gate_|follow_|click:)/.test(code(row)));
const isOpening = (group: RunGroup) => !isContinuation(group) && group.steps.some((row) => row.status === "sent" || /^post_reply:/.test(code(row)));
const isWaiting = (group: RunGroup) => group.steps.some((row) => /^(tap_prompt|follow_prompt|follow_status_unavailable|gate_follow_prompt_pending|gate_follow_status_unavailable)/.test(code(row))) || group.status === "in_progress";

/** Presentation only: callbacks retain their run groups, but share outer journey boundaries.
 * Correlate by stored rule + conversation IDs, never by display name or adjacent rows.
 * Missing initial/terminal events do not invent START/END markers.
 */
export function activityJourneys(rows: AutomationRun[]): ActivityJourney[] {
  const chronological = groupRuns(rows).sort((a, b) => a.startedAt.localeCompare(b.startedAt) || a.key.localeCompare(b.key));
  const journeys: ActivityJourney[] = [];
  const current = new Map<string, ActivityJourney>();
  for (const group of chronological) {
    const first = group.steps[0];
    if (!first) continue;
    const scope = first.rule_id && first.conversation_id && !code(first).startsWith("flow:")
      ? `${first.rule_id}:${first.conversation_id}` : null;
    const opening = isOpening(group);
    let journey = scope && !opening && isContinuation(group) ? current.get(scope) : undefined;
    if (!journey) {
      journey = { key: group.key, groups: [], startKey: opening ? group.key : null, endKey: null };
      journeys.push(journey);
      if (scope) current.set(scope, journey);
    }
    journey.groups.push(group);
    if (group.steps.some(isClick) || group.status === "failed" || group.steps.some((row) => /^(follow_gate_expired|gate_gave_up)/.test(code(row))) || (opening && !isWaiting(group))) {
      journey.endKey = group.key;
    }
  }
  return journeys.sort((a, b) => {
    const lastA = a.groups.at(-1)?.steps.at(-1)?.created_at ?? "";
    const lastB = b.groups.at(-1)?.steps.at(-1)?.created_at ?? "";
    return lastB.localeCompare(lastA);
  });
}

/** Filter after correlation: hiding a boundary must not turn a middle stage into START/END. */
export function filterActivityJourneys(journeys: ActivityJourney[], status: string): ActivityJourney[] {
  if (status === "all") return journeys;
  return journeys.flatMap((journey) => {
    const groups = journey.groups.flatMap((group) => {
      const steps = group.steps.filter((row) => row.status === status);
      return steps.length ? [{ ...group, steps }] : [];
    });
    return groups.length ? [{ ...journey, groups }] : [];
  });
}