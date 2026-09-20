import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { BarChart3, Inbox, Workflow } from "lucide-react";
import { useEffect } from "react";

import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "DM FB-IG-YT by Techaasvik — Social automation made simple" },
      {
        name: "description",
        content:
          "Publish, reply and automate across Instagram, Facebook and YouTube from one workspace.",
      },
      {
        property: "og:title",
        content: "DM FB-IG-YT by Techaasvik — Social automation made simple",
      },
      {
        property: "og:description",
        content:
          "One inbox, smart automations and analytics for Instagram, Facebook and YouTube.",
      },
    ],
  }),
  component: LandingPage,
});

const features = [
  {
    icon: Inbox,
    title: "Unified inbox",
    body: "Every DM and comment from Instagram, Facebook and YouTube in one thread view.",
  },
  {
    icon: Workflow,
    title: "Automations",
    body: "Keyword triggers, comment-to-DM flows and safe auto-replies that follow platform rules.",
  },
  {
    icon: BarChart3,
    title: "Analytics",
    body: "Track conversations, automation runs, qualified leads and conversion in real time.",
  },
];

function LandingPage() {
  const navigate = useNavigate();

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/dashboard", replace: true });
    });
  }, [navigate]);

  return (
    <div className="min-h-screen bg-background">
      <header className="flex items-center justify-between border-b px-6 py-4">
        <div className="flex items-center gap-3">
          <span className="inline-flex size-9 items-center justify-center rounded-xl bg-primary text-base font-bold text-primary-foreground">
            W
          </span>
          <div>
            <p className="text-sm font-bold">DM FB-IG-YT</p>
            <p className="text-xs text-subtle-foreground">by Techaasvik</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button asChild variant="ghost">
            <Link to="/auth">Sign in</Link>
          </Button>
          <Button asChild>
            <Link to="/auth">Get started</Link>
          </Button>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-6 py-20">
        <div className="max-w-2xl">
          <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
            Social automation without the complexity
          </h1>
          <p className="mt-4 text-lg text-muted-foreground">
            Manage Instagram, Facebook and YouTube conversations, comments and publishing
            from a single workspace built for teams and agencies.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Button asChild size="lg">
              <Link to="/auth">Create your workspace</Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link to="/auth">Sign in</Link>
            </Button>
          </div>
        </div>

        <div className="mt-16 grid gap-4 sm:grid-cols-3">
          {features.map((f) => (
            <div key={f.title} className="panel p-5">
              <f.icon className="size-5 text-primary" />
              <p className="mt-3 text-sm font-semibold">{f.title}</p>
              <p className="mt-1 text-sm text-muted-foreground">{f.body}</p>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
