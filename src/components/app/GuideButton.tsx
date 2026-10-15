import { marked } from "marked";
import { BookOpen } from "lucide-react";
import { useMemo } from "react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import automationsMd from "@/content/guides/automations.md?raw";
import aiAgentMd from "@/content/guides/ai-agent.md?raw";
import contactsMd from "@/content/guides/contacts.md?raw";
import revenueMd from "@/content/guides/revenue.md?raw";
import teamDeskMd from "@/content/guides/team-desk.md?raw";
import trustSafetyMd from "@/content/guides/trust-safety.md?raw";
import growthMd from "@/content/guides/growth.md?raw";
import entryPointsMd from "@/content/guides/entry-points.md?raw";

const GUIDES = {
  automations: { title: "Automations guide", file: "automations-guide.md", md: automationsMd },
  "ai-agent": { title: "AI Agent guide", file: "ai-agent-guide.md", md: aiAgentMd },
  contacts: { title: "Contacts guide", file: "contacts-guide.md", md: contactsMd },
  revenue: { title: "Sales & Revenue guide", file: "revenue-guide.md", md: revenueMd },
  "team-desk": { title: "Team desk guide", file: "team-desk-guide.md", md: teamDeskMd },
  "trust-safety": { title: "Trust & safety guide", file: "trust-safety-guide.md", md: trustSafetyMd },
  growth: { title: "Growth insights guide", file: "growth-guide.md", md: growthMd },
  "entry-points": { title: "Ice breakers & menu guide", file: "ice-breakers-guide.md", md: entryPointsMd },
} as const;

/** Opens a readable .md guide in a dialog, with a download of the raw file. */
export function GuideButton({ guide }: { guide: keyof typeof GUIDES }) {
  const g = GUIDES[guide];
  const html = useMemo(() => marked.parse(g.md, { async: false }) as string, [g.md]);
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline"><BookOpen className="size-4" /> Guide</Button>
      </DialogTrigger>
      <DialogContent className="max-h-[85vh] max-w-2xl overflow-y-auto">
        <DialogHeader className="pr-6">
          <DialogTitle>{g.title}</DialogTitle>
        </DialogHeader>
        <div
          className="space-y-3 text-sm leading-relaxed [&_h2]:mt-5 [&_h2]:text-base [&_h2]:font-semibold [&_h3]:mt-3 [&_h3]:font-semibold [&_li]:ml-5 [&_ol]:list-decimal [&_ul]:list-disc [&_code]:rounded [&_code]:bg-muted [&_code]:px-1"
          dangerouslySetInnerHTML={{ __html: html }}
        />
      </DialogContent>
    </Dialog>
  );
}
