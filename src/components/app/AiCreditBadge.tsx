import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Sparkles } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { getAiUsage } from "@/lib/ai.functions";

export const AI_USAGE_KEY = ["ai-usage"] as const;

/** Shows how many AI requests an action costs and how many are left today. */
export function AiCreditBadge({ cost = 1 }: { cost?: number }) {
  const fetchUsage = useServerFn(getAiUsage);
  const q = useQuery({ queryKey: AI_USAGE_KEY, queryFn: () => fetchUsage(), staleTime: 30_000 });
  const left = q.data?.remaining;
  const empty = left !== undefined && left < cost;
  return (
    <Badge variant={empty ? "destructive" : "secondary"} className="gap-1 font-normal">
      <Sparkles className="size-3" />
      Uses {cost} AI request{cost === 1 ? "" : "s"}
      {q.data ? ` · ${q.data.remaining} of ${q.data.limit} left today` : ""}
    </Badge>
  );
}
