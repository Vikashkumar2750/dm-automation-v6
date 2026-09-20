import { createFileRoute } from "@tanstack/react-router";
import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { Copy, Loader2, Sparkles } from "lucide-react";
import { toast } from "sonner";

import { AppShell } from "@/components/app/AppShell";
import { PageHeader, Panel } from "@/components/app/primitives";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import {
  generateCaptions,
  suggestAutomation,
  suggestReplies,
  type SuggestedRule,
} from "@/lib/ai.functions";

export const Route = createFileRoute("/_authenticated/ai-assistant")({
  head: () => ({
    meta: [
      { title: "AI Assistant — DM FB-IG-YT by Techaasvik" },
      {
        name: "description",
        content: "Draft captions, reply suggestions and automation rules with AI.",
      },
      { property: "og:title", content: "AI Assistant — DM FB-IG-YT by Techaasvik" },
      {
        property: "og:description",
        content: "Draft captions, reply suggestions and automation rules with AI.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AiAssistantPage,
});

const TONES = ["Friendly", "Professional", "Playful", "Bold", "Calm & helpful"];

function copy(text: string) {
  void navigator.clipboard.writeText(text);
  toast.success("Copied");
}

function Options({ options }: { options: string[] }) {
  if (options.length === 0) return null;
  return (
    <ul className="mt-4 space-y-3">
      {options.map((option, index) => (
        <li
          key={index}
          className="flex items-start gap-3 rounded-lg border bg-muted/30 p-3"
        >
          <p className="min-w-0 flex-1 whitespace-pre-wrap text-sm">{option}</p>
          <Button
            size="icon"
            variant="ghost"
            aria-label="Copy option"
            onClick={() => copy(option)}
          >
            <Copy className="size-4" />
          </Button>
        </li>
      ))}
    </ul>
  );
}

function CaptionTab() {
  const run = useServerFn(generateCaptions);
  const [topic, setTopic] = useState("");
  const [platform, setPlatform] = useState<"instagram" | "facebook">("instagram");
  const [tone, setTone] = useState(TONES[0]!);
  const [withHashtags, setWithHashtags] = useState(true);
  const [options, setOptions] = useState<string[]>([]);

  const mutation = useMutation({
    mutationFn: () => run({ data: { topic, platform, tone, withHashtags } }),
    onSuccess: (result) => setOptions(result.options),
    onError: (error: Error) => toast.error(error.message),
  });

  return (
    <Panel title="Caption writer" description="Three ready-to-post captions per idea.">
      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="topic">What is the post about?</Label>
          <Textarea
            id="topic"
            rows={4}
            value={topic}
            onChange={(event) => setTopic(event.target.value)}
            placeholder="Diwali offer — 20% off on all skincare kits, free delivery above ₹999"
          />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>Platform</Label>
            <Select
              value={platform}
              onValueChange={(value) => setPlatform(value as "instagram" | "facebook")}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="instagram">Instagram</SelectItem>
                <SelectItem value="facebook">Facebook Page</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Tone</Label>
            <Select value={tone} onValueChange={setTone}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TONES.map((item) => (
                  <SelectItem key={item} value={item}>
                    {item}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Switch
            id="hashtags"
            checked={withHashtags}
            onCheckedChange={setWithHashtags}
          />
          <Label htmlFor="hashtags">Add hashtags</Label>
        </div>
        <Button
          disabled={topic.trim().length < 3 || mutation.isPending}
          onClick={() => mutation.mutate()}
        >
          {mutation.isPending ? (
            <Loader2 className="mr-2 size-4 animate-spin" />
          ) : (
            <Sparkles className="mr-2 size-4" />
          )}
          Write captions
        </Button>
        <Options options={options} />
      </div>
    </Panel>
  );
}

function ReplyTab() {
  const run = useServerFn(suggestReplies);
  const [message, setMessage] = useState("");
  const [context, setContext] = useState("");
  const [tone, setTone] = useState(TONES[0]!);
  const [options, setOptions] = useState<string[]>([]);

  const mutation = useMutation({
    mutationFn: () => run({ data: { message, tone, context } }),
    onSuccess: (result) => setOptions(result.options),
    onError: (error: Error) => toast.error(error.message),
  });

  return (
    <Panel
      title="Reply drafts"
      description="Paste a customer message and pick the answer you like."
    >
      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="message">Customer message</Label>
          <Textarea
            id="message"
            rows={3}
            value={message}
            onChange={(event) => setMessage(event.target.value)}
            placeholder="Hi, is the serum available in 100ml? What's the price?"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="context">About your business (optional)</Label>
          <Input
            id="context"
            value={context}
            onChange={(event) => setContext(event.target.value)}
            placeholder="Skincare brand, ships across India, delivery in 3-5 days"
          />
        </div>
        <div className="space-y-2">
          <Label>Tone</Label>
          <Select value={tone} onValueChange={setTone}>
            <SelectTrigger className="sm:w-60">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {TONES.map((item) => (
                <SelectItem key={item} value={item}>
                  {item}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button
          disabled={message.trim().length < 2 || mutation.isPending}
          onClick={() => mutation.mutate()}
        >
          {mutation.isPending ? (
            <Loader2 className="mr-2 size-4 animate-spin" />
          ) : (
            <Sparkles className="mr-2 size-4" />
          )}
          Suggest replies
        </Button>
        <Options options={options} />
      </div>
    </Panel>
  );
}

const triggerLabel: Record<string, string> = {
  dm_received: "New DM",
  comment_received: "New comment",
};
const matchLabel: Record<string, string> = {
  any: "Every message",
  contains: "Contains keyword",
  exact: "Exact match",
  starts_with: "Starts with",
};
const actionLabel: Record<string, string> = {
  reply_dm: "Reply in DM",
  comment_public_reply: "Public reply",
  comment_private_reply: "Private DM from comment",
  hide_comment: "Hide comment",
  set_status: "Change status",
};

function AutomationTab() {
  const run = useServerFn(suggestAutomation);
  const [goal, setGoal] = useState("");
  const [rule, setRule] = useState<SuggestedRule | null>(null);

  const mutation = useMutation({
    mutationFn: () => run({ data: { goal } }),
    onSuccess: (result) => setRule(result.rule),
    onError: (error: Error) => toast.error(error.message),
  });

  return (
    <Panel
      title="Automation ideas"
      description="Describe what should happen — get a rule you can copy into Automations."
    >
      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="goal">What should the automation do?</Label>
          <Textarea
            id="goal"
            rows={3}
            value={goal}
            onChange={(event) => setGoal(event.target.value)}
            placeholder="When someone comments 'price' on my reel, send them the price list in DM"
          />
        </div>
        <Button
          disabled={goal.trim().length < 5 || mutation.isPending}
          onClick={() => mutation.mutate()}
        >
          {mutation.isPending ? (
            <Loader2 className="mr-2 size-4 animate-spin" />
          ) : (
            <Sparkles className="mr-2 size-4" />
          )}
          Suggest a rule
        </Button>

        {rule && (
          <div className="space-y-3 rounded-lg border bg-muted/30 p-4">
            <p className="text-sm font-medium">{rule.name}</p>
            <dl className="grid gap-2 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-xs text-muted-foreground">Trigger</dt>
                <dd>{triggerLabel[rule.trigger] ?? rule.trigger}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Match</dt>
                <dd>{matchLabel[rule.matchType] ?? rule.matchType}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Action</dt>
                <dd>{actionLabel[rule.action] ?? rule.action}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Keywords</dt>
                <dd>{rule.keywords.join(", ") || "—"}</dd>
              </div>
            </dl>
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground">Reply variations</p>
              <Options options={rule.responseVariations} />
            </div>
            <Button variant="outline" size="sm" onClick={() => copy(rule.keywords.join(", "))}>
              <Copy className="mr-2 size-4" /> Copy keywords
            </Button>
          </div>
        )}
      </div>
    </Panel>
  );
}

function AiAssistantPage() {
  return (
    <AppShell>
      <PageHeader
        title="AI Assistant"
        description="Write captions, draft replies and design automation rules in seconds."
      />
      <Tabs defaultValue="captions" className="space-y-4">
        <TabsList>
          <TabsTrigger value="captions">Captions</TabsTrigger>
          <TabsTrigger value="replies">Replies</TabsTrigger>
          <TabsTrigger value="automations">Automations</TabsTrigger>
        </TabsList>
        <TabsContent value="captions">
          <CaptionTab />
        </TabsContent>
        <TabsContent value="replies">
          <ReplyTab />
        </TabsContent>
        <TabsContent value="automations">
          <AutomationTab />
        </TabsContent>
      </Tabs>
    </AppShell>
  );
}
