import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import {
  ArrowRight,
  BarChart3,
  Bot,
  CalendarDays,
  CheckCircle2,
  Clock,
  Inbox,
  MessageSquare,
  ShieldCheck,
  Sparkles,
  Users,
  Workflow,
} from "lucide-react";
import { useEffect } from "react";

import metaPartnerBadge from "@/assets/meta-business-partner.png.asset.json";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";

const pageTitle =
  "DM FB-IG-YT by Techaasvik — Turn Instagram, Facebook & YouTube comments into leads";
const pageDescription =
  "One inbox, comment-to-DM automations, scheduling and analytics for Instagram, Facebook and YouTube. Reply in seconds, capture every lead, stay inside platform rules.";

const faqs = [
  {
    q: "What does DM FB-IG-YT actually do?",
    a: "It brings your Instagram, Facebook and YouTube DMs and comments into one inbox, replies automatically using keyword rules, schedules and publishes posts, and shows which conversations turn into leads.",
  },
  {
    q: "Is automated replying safe for my accounts?",
    a: "Yes. Every workspace starts with safe defaults: quiet hours, per-contact daily caps, hourly and daily send limits, blocked sensitive words, an opt-out list and viral-spike auto-pause. You also have a one-click kill switch.",
  },
  {
    q: "Which platforms are supported?",
    a: "Instagram and Facebook for DMs, comments and publishing, and YouTube for comments and channel content. All connections use the official APIs with permissions you approve.",
  },
  {
    q: "Can agencies manage multiple clients?",
    a: "Yes. Create a separate workspace per client, invite your team with Admin, Manager, Agent or Viewer roles, and switch between clients without signing out.",
  },
  {
    q: "Do I need a credit card to start?",
    a: "No. Create your workspace, connect an account and try the inbox and automations first.",
  },
];

const benefits = [
  {
    icon: Clock,
    title: "Reply in seconds, not hours",
    body: "Buyers ask a question under a reel and get an answer immediately — even at 2am — so the interest never cools off.",
  },
  {
    icon: MessageSquare,
    title: "Turn comments into conversations",
    body: "A keyword in a comment triggers a public reply plus a private DM, moving the lead from a noisy thread into a real chat.",
  },
  {
    icon: Inbox,
    title: "Nothing slips through",
    body: "Every DM and comment from all three platforms lands in one queue, so your team never re-checks three apps or misses a buyer.",
  },
  {
    icon: ShieldCheck,
    title: "Protect your accounts by default",
    body: "Quiet hours, send limits, opt-outs and spike auto-pause are on from day one — growth without risking a ban.",
  },
  {
    icon: Sparkles,
    title: "Write faster with AI",
    body: "Get caption options and reply drafts in your tone, then edit and send. No blank-page stalling before a launch.",
  },
  {
    icon: BarChart3,
    title: "See what actually earns",
    body: "Track conversations, answered rate, automation runs and qualified leads so you double down on what works.",
  },
];

const steps = [
  {
    title: "Connect your accounts",
    body: "Link Instagram, Facebook and YouTube through the official login. Permissions stay yours and can be revoked anytime.",
  },
  {
    title: "Set your rules",
    body: "Choose keywords, write the reply, pick the safety limits. Start with one rule and grow from there.",
  },
  {
    title: "Watch leads arrive",
    body: "Replies go out on their own, your team handles the real conversations, and analytics shows the result.",
  },
];

const forWho = [
  {
    icon: Users,
    title: "Creators & coaches",
    body: "Sell from your comments section without living inside the app.",
  },
  {
    icon: Workflow,
    title: "D2C & local businesses",
    body: "Answer price, size and availability questions instantly, every time.",
  },
  {
    icon: Bot,
    title: "Agencies",
    body: "Run every client from separate workspaces with clean role-based access.",
  },
];

const plans = [
  {
    name: "Free",
    price: "₹9",
    cadence: "One-time payment, lifetime access",
    popular: false,
    features: [
      { text: "1× Instagram account", included: true },
      { text: "1× Facebook page", included: true },
      { text: "1× YouTube channel", included: true },
      { text: "AI content analysis", included: true },
      { text: "DM & comment automation", included: true },
      { text: "Multi-account publish", included: false },
      { text: "Priority support", included: false },
    ],
    cta: "Start with Free",
  },
  {
    name: "Pro",
    price: "₹59",
    cadence: "per month · or ₹299 / 6 months · ₹599 / year",
    popular: true,
    features: [
      { text: "5× Instagram accounts", included: true },
      { text: "5× Facebook pages", included: true },
      { text: "5× YouTube channels", included: true },
      { text: "AI content analysis", included: true },
      { text: "DM & comment automation", included: true },
      { text: "Publish to all accounts at once", included: true },
      { text: "Priority support", included: true },
    ],
    cta: "Upgrade to Pro",
  },
];

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: pageTitle },
      { name: "description", content: pageDescription },
      { property: "og:title", content: pageTitle },
      { property: "og:description", content: pageDescription },
      { property: "og:type", content: "website" },
      { property: "og:url", content: "/" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: pageTitle },
      { name: "twitter:description", content: pageDescription },
    ],
    links: [{ rel: "canonical", href: "/" }],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@graph": [
            {
              "@type": "SoftwareApplication",
              name: "DM FB-IG-YT by Techaasvik",
              applicationCategory: "BusinessApplication",
              operatingSystem: "Web",
              description: pageDescription,
              featureList: [
                "Unified inbox for Instagram, Facebook and YouTube",
                "Comment-to-DM automations",
                "Post scheduling and publishing",
                "AI caption and reply assistance",
                "Team roles and multi-client workspaces",
                "Conversation and lead analytics",
              ],
              publisher: { "@type": "Organization", name: "Techaasvik" },
              offers: [
                {
                  "@type": "Offer",
                  name: "Free",
                  price: "9",
                  priceCurrency: "INR",
                  description: "One-time payment, lifetime access",
                },
                {
                  "@type": "Offer",
                  name: "Pro",
                  price: "59",
                  priceCurrency: "INR",
                  description: "Per month; ₹299 for 6 months or ₹599 per year",
                },
              ],
            },
            {
              "@type": "FAQPage",
              mainEntity: faqs.map((f) => ({
                "@type": "Question",
                name: f.q,
                acceptedAnswer: { "@type": "Answer", text: f.a },
              })),
            },
          ],
        }),
      },
    ],
  }),
  component: LandingPage,
});

function LandingPage() {
  const navigate = useNavigate();

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/dashboard", replace: true });
    });
  }, [navigate]);

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-30 border-b bg-surface/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-3.5">
          <div className="flex items-center gap-3">
            <span className="inline-flex size-9 items-center justify-center rounded-xl bg-primary text-base font-bold text-primary-foreground">
              D
            </span>
            <div>
              <p className="text-sm font-bold">DM FB-IG-YT</p>
              <p className="text-xs text-subtle-foreground">by Techaasvik</p>
            </div>
          </div>
          <nav className="hidden items-center gap-6 text-sm text-muted-foreground md:flex">
            <a className="hover:text-foreground" href="#benefits">
              Benefits
            </a>
            <a className="hover:text-foreground" href="#how-it-works">
              How it works
            </a>
            <a className="hover:text-foreground" href="#safety">
              Safety
            </a>
            <a className="hover:text-foreground" href="#pricing">
              Pricing
            </a>
            <a className="hover:text-foreground" href="#faq">
              FAQ
            </a>
          </nav>
          <div className="flex items-center gap-2">
            <Button asChild variant="ghost">
              <Link to="/auth">Sign in</Link>
            </Button>
            <Button asChild>
              <Link to="/auth">Start free</Link>
            </Button>
          </div>
        </div>
      </header>

      <main>
        {/* Hero */}
        <section className="border-b">
          <div className="mx-auto grid max-w-6xl gap-10 px-6 py-16 lg:grid-cols-[1.1fr_0.9fr] lg:py-24">
            <div>
              <span className="inline-flex items-center gap-2 rounded-full border bg-surface px-3 py-1 text-xs font-medium text-muted-foreground">
                <Sparkles className="size-3.5 text-primary" />
                Instagram · Facebook · YouTube in one workspace
              </span>
              <h1 className="mt-5 text-4xl font-bold tracking-tight sm:text-5xl">
                Turn every comment and DM into a paying customer
              </h1>
              <p className="mt-5 text-lg text-muted-foreground">
                DM FB-IG-YT answers your Instagram, Facebook and YouTube audience
                instantly, moves interested people into a private chat, and shows your
                team exactly which conversations became leads — all from one inbox.
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <Button asChild size="lg">
                  <Link to="/auth">
                    Create your free workspace
                    <ArrowRight className="size-4" />
                  </Link>
                </Button>
                <Button asChild size="lg" variant="outline">
                  <a href="#how-it-works">See how it works</a>
                </Button>
              </div>
              <ul className="mt-6 flex flex-wrap gap-x-6 gap-y-2 text-sm text-muted-foreground">
                {[
                  "No credit card needed",
                  "Official platform APIs",
                  "Safe-send limits on by default",
                ].map((item) => (
                  <li key={item} className="flex items-center gap-2">
                    <CheckCircle2 className="size-4 text-success" />
                    {item}
                  </li>
                ))}
              </ul>
              <div className="mt-8 inline-flex items-center gap-3 rounded-xl border bg-surface px-4 py-3">
                <img
                  src={metaPartnerBadge.url}
                  alt="Meta Business Partner"
                  className="h-9 w-auto"
                />
                <p className="text-xs text-muted-foreground">
                  Built on the official Meta platform
                  <br />
                  as a Meta Business Partner
                </p>
              </div>
            </div>

            <div className="panel p-5">
              <p className="text-xs font-semibold tracking-wide text-subtle-foreground uppercase">
                What a rule looks like
              </p>
              <div className="mt-4 space-y-3">
                {[
                  {
                    label: "Trigger",
                    value: "Comment on a reel contains “price”",
                    tone: "text-instagram",
                  },
                  {
                    label: "Public reply",
                    value: "“Sent you the details in DM 💬”",
                    tone: "text-facebook",
                  },
                  {
                    label: "Private DM",
                    value: "Price list + link, then hand over to your team",
                    tone: "text-primary",
                  },
                  {
                    label: "Safety",
                    value: "Quiet hours, per-person cap, opt-out respected",
                    tone: "text-success",
                  },
                ].map((row) => (
                  <div key={row.label} className="rounded-lg border bg-surface-secondary p-3">
                    <p className={`text-xs font-semibold ${row.tone}`}>{row.label}</p>
                    <p className="mt-1 text-sm text-foreground">{row.value}</p>
                  </div>
                ))}
              </div>
              <p className="mt-4 text-xs text-muted-foreground">
                Build it in a few minutes — no code, no Zapier, no developer.
              </p>
            </div>
          </div>
        </section>

        {/* Benefits */}
        <section id="benefits" className="border-b">
          <div className="mx-auto max-w-6xl px-6 py-16 lg:py-20">
            <h2 className="max-w-2xl text-3xl font-bold tracking-tight">
              Why teams switch to one workspace
            </h2>
            <p className="mt-3 max-w-2xl text-muted-foreground">
              Slow replies lose sales. Scattered tools lose context. This fixes both.
            </p>
            <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {benefits.map((b) => (
                <div key={b.title} className="panel p-5">
                  <span className="inline-flex size-9 items-center justify-center rounded-lg bg-surface-secondary">
                    <b.icon className="size-4.5 text-primary" />
                  </span>
                  <h3 className="mt-4 text-base font-semibold">{b.title}</h3>
                  <p className="mt-2 text-sm text-muted-foreground">{b.body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* How it works */}
        <section id="how-it-works" className="border-b bg-surface">
          <div className="mx-auto max-w-6xl px-6 py-16 lg:py-20">
            <h2 className="text-3xl font-bold tracking-tight">Live in three steps</h2>
            <div className="mt-10 grid gap-4 md:grid-cols-3">
              {steps.map((s, i) => (
                <div key={s.title} className="panel p-5">
                  <span className="num inline-flex size-8 items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-foreground">
                    {i + 1}
                  </span>
                  <h3 className="mt-4 text-base font-semibold">{s.title}</h3>
                  <p className="mt-2 text-sm text-muted-foreground">{s.body}</p>
                </div>
              ))}
            </div>
            <div className="mt-8">
              <Button asChild size="lg">
                <Link to="/auth">
                  Start now — it's free
                  <ArrowRight className="size-4" />
                </Link>
              </Button>
            </div>
          </div>
        </section>

        {/* Who it's for */}
        <section className="border-b">
          <div className="mx-auto max-w-6xl px-6 py-16 lg:py-20">
            <h2 className="text-3xl font-bold tracking-tight">Built for</h2>
            <div className="mt-10 grid gap-4 md:grid-cols-3">
              {forWho.map((w) => (
                <div key={w.title} className="panel p-5">
                  <w.icon className="size-5 text-primary" />
                  <h3 className="mt-3 text-base font-semibold">{w.title}</h3>
                  <p className="mt-2 text-sm text-muted-foreground">{w.body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Safety */}
        <section id="safety" className="border-b bg-surface">
          <div className="mx-auto grid max-w-6xl gap-10 px-6 py-16 lg:grid-cols-2 lg:py-20">
            <div>
              <h2 className="text-3xl font-bold tracking-tight">
                Automation that respects the platforms
              </h2>
              <p className="mt-3 text-muted-foreground">
                Aggressive tools get accounts restricted. Every new workspace here starts
                with conservative limits, and you can tighten them further at any time.
              </p>
              <div className="mt-6">
                <Button asChild variant="outline" size="lg">
                  <Link to="/auth">Create your workspace</Link>
                </Button>
              </div>
            </div>
            <ul className="grid gap-3 sm:grid-cols-2">
              {[
                "Quiet hours so nobody gets a 3am message",
                "Daily cap per contact — no spam feeling",
                "Hourly and daily send limits per workspace",
                "Sensitive-word blocking before anything sends",
                "Opt-out keywords honoured automatically",
                "Auto-pause when a post goes viral",
                "One-click kill switch for the whole workspace",
                "Role-based access for your team",
              ].map((item) => (
                <li
                  key={item}
                  className="flex items-start gap-2 rounded-lg border bg-background p-3 text-sm"
                >
                  <ShieldCheck className="mt-0.5 size-4 shrink-0 text-success" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* Everything else */}
        <section className="border-b">
          <div className="mx-auto max-w-6xl px-6 py-16 lg:py-20">
            <h2 className="text-3xl font-bold tracking-tight">
              Everything else you'd otherwise pay for separately
            </h2>
            <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {[
                {
                  icon: CalendarDays,
                  title: "Plan & publish",
                  body: "Schedule feed posts, carousels, reels and stories on a shared calendar.",
                },
                {
                  icon: MessageSquare,
                  title: "Comment management",
                  body: "Reply publicly, DM privately or hide spam without leaving the thread.",
                },
                {
                  icon: Users,
                  title: "Contacts",
                  body: "Every person you've talked to, with their history across platforms.",
                },
                {
                  icon: BarChart3,
                  title: "Reporting",
                  body: "7, 30 and 90 day views of conversations, replies and automation runs.",
                },
              ].map((f) => (
                <div key={f.title} className="panel p-5">
                  <f.icon className="size-5 text-primary" />
                  <h3 className="mt-3 text-base font-semibold">{f.title}</h3>
                  <p className="mt-2 text-sm text-muted-foreground">{f.body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Pricing */}
        <section id="pricing" className="border-b">
          <div className="mx-auto max-w-6xl px-6 py-16 lg:py-20">
            <h2 className="text-3xl font-bold tracking-tight">
              Simple pricing that pays for itself
            </h2>
            <p className="mt-3 max-w-2xl text-muted-foreground">
              Start with a one-time pass, then upgrade when your audience grows. No
              hidden fees, cancel anytime.
            </p>
            <div className="mt-10 grid gap-6 md:grid-cols-2">
              {plans.map((plan) => (
                <div
                  key={plan.name}
                  className={
                    plan.popular
                      ? "panel relative border-primary/40 bg-surface-secondary p-6"
                      : "panel p-6"
                  }
                >
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <h3 className="text-lg font-bold">{plan.name}</h3>
                      {plan.popular && (
                        <p className="mt-0.5 text-sm font-medium text-primary">
                          Most popular
                        </p>
                      )}
                    </div>
                    <div className="text-right">
                      <p className="num text-3xl font-bold">{plan.price}</p>
                    </div>
                  </div>
                  <p className="mt-2 text-sm text-muted-foreground">{plan.cadence}</p>
                  <ul className="mt-6 space-y-2.5">
                    {plan.features.map((f) => (
                      <li
                        key={f.text}
                        className={
                          f.included
                            ? "flex items-center gap-2 text-sm"
                            : "flex items-center gap-2 text-sm text-subtle-foreground line-through"
                        }
                      >
                        {f.included ? (
                          <CheckCircle2 className="size-4 shrink-0 text-success" />
                        ) : (
                          <span className="inline-block size-4 shrink-0 rounded-full border" />
                        )}
                        {f.text}
                      </li>
                    ))}
                  </ul>
                  <Button
                    asChild
                    size="lg"
                    variant={plan.popular ? "default" : "outline"}
                    className="mt-8 w-full"
                  >
                    <Link to="/auth">
                      {plan.cta}
                      <ArrowRight className="size-4" />
                    </Link>
                  </Button>
                </div>
              ))}
            </div>
            <p className="mt-6 text-sm text-muted-foreground">
              Agency or managing many clients?{" "}
              <Link to="/auth" className="font-medium text-primary">
                Create a workspace
              </Link>{" "}
              and talk to us about multi-client plans.
            </p>
          </div>
        </section>

        {/* FAQ */}
        <section id="faq" className="border-b bg-surface">
          <div className="mx-auto max-w-3xl px-6 py-16 lg:py-20">
            <h2 className="text-3xl font-bold tracking-tight">
              Frequently asked questions
            </h2>
            <div className="mt-8 divide-y rounded-xl border bg-background">
              {faqs.map((f) => (
                <details key={f.q} className="group p-5">
                  <summary className="cursor-pointer list-none text-base font-semibold">
                    {f.q}
                  </summary>
                  <p className="mt-2 text-sm text-muted-foreground">{f.a}</p>
                </details>
              ))}
            </div>
          </div>
        </section>

        {/* Final CTA */}
        <section>
          <div className="mx-auto max-w-4xl px-6 py-20 text-center">
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
              Your next customer is already in your comments
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-lg text-muted-foreground">
              Set up one automation today and stop losing people who asked a question and
              never got an answer.
            </p>
            <div className="mt-8 flex flex-wrap justify-center gap-3">
              <Button asChild size="lg">
                <Link to="/auth">
                  Create your free workspace
                  <ArrowRight className="size-4" />
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline">
                <Link to="/auth">Sign in</Link>
              </Button>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t bg-surface">
        <div className="mx-auto flex max-w-6xl flex-col gap-3 px-6 py-8 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <img
              src={metaPartnerBadge.url}
              alt="Meta Business Partner"
              className="h-8 w-auto"
            />
            <p>DM FB-IG-YT by Techaasvik</p>
          </div>
          <p className="text-xs">
            Instagram and Facebook are trademarks of Meta Platforms, Inc. YouTube is a
            trademark of Google LLC.
          </p>
        </div>
      </footer>
    </div>
  );
}
