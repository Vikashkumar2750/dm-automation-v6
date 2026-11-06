import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import shotCommentDm from "@/assets/home-comment-to-dm.webp";
import shotInbox from "@/assets/home-inbox-revenue.webp";
import shotDelivery from "@/assets/home-delivery-page.webp";
import heroReelDm from "@/assets/home-hero-reel-dm.webp";
import { Tilt3D, Reveal } from "@/components/home/Motion";
import shotYtFb from "@/assets/home-youtube-facebook.webp";
import {
  ArrowRight,
  BarChart3,
  Bot,
  CalendarDays,
  CheckCircle2,
  Clock,
  Facebook,
  Instagram,
  Youtube,
  Inbox,
  MessageSquare,
  ShieldCheck,
  Sparkles,
  Users,
  Workflow,
} from "lucide-react";
import { useEffect } from "react";

import { PublicFooter } from "@/components/app/PublicFooter";
import { PublicHeader } from "@/components/app/PublicHeader";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";

const metaPartnerBadge = { url: "/meta-business-partner.png" };

const pageTitle =
  "AutoDM — Instagram Comment-to-DM Automation, Sales Pages & Unified Inbox";
const pageDescription =
  "Auto-reply to Instagram & Facebook comments with DMs, sell via built-in delivery pages with WhatsApp OTP leads, and reply on YouTube — official Meta APIs, from ₹9.";


const faqs = [
  {
    q: "What does AutoDM actually do?",
    a: "On Instagram and Facebook it brings DMs and comments into one inbox and replies automatically using keyword rules. On YouTube it answers public comments on your videos and publishes your videos. YouTube has no business direct messages, so AutoDM never sends DMs there.",
  },
  {
    q: "Is automated replying safe for my accounts?",
    a: "Yes. Every workspace starts with safe defaults: quiet hours, per-contact daily caps, hourly and daily send limits, blocked sensitive words, an opt-out list and viral-spike auto-pause. You also have a one-click kill switch.",
  },
  {
    q: "Which platforms are supported?",
    a: "Instagram and Facebook for DMs, comments and publishing, and YouTube for public comment replies and video publishing only. All connections use the official APIs with permissions you approve.",
  },

  {
    q: "Can agencies manage multiple clients?",
    a: "Yes. Create a separate workspace per client, invite your team with Admin, Manager, Agent or Viewer roles, and switch between clients without signing out.",
  },
  {
    q: "How does Instagram comment-to-DM automation work?",
    a: "You pick a post (or all posts) and a keyword. When someone comments that keyword, AutoDM posts a public reply and sends a private DM with your message and buttons within seconds, using Meta's official Instagram API.",
  },
  {
    q: "Can I sell digital products directly from DMs?",
    a: "Yes. Create a delivery page in Sales & Revenue, link a product and Razorpay, and attach it to a rule. Buyers get the link in DM, fill the lead form, pay and receive the product — every step is tracked.",
  },
  {
    q: "Can I automate a Facebook Professional (creator) profile?",
    a: "Meta does not allow official automation on personal profiles, even in Professional Mode. Connect a Facebook Page instead, share its m.me link or an AutoDM delivery page link on your profile posts.",
  },
  {
    q: "Do I need a credit card to start?",
    a: "No. Create your workspace, connect an account and try the inbox and automations first.",
  },
];

const funnel = [
  { icon: MessageSquare, title: "Viewer comments a keyword", body: "“PRICE”, “LINK” or any word you choose under a reel, post or video." },
  { icon: Bot, title: "Instant DM + public reply", body: "AutoDM replies in seconds with a message and up to 3 buttons — follow-gate optional." },
  { icon: ShieldCheck, title: "Delivery page + verified lead", body: "Buyer lands on your sales page, leaves email/phone (WhatsApp OTP) — even drop-offs are captured." },
  { icon: BarChart3, title: "Paid, delivered, tracked", body: "Razorpay payment, automatic delivery, and every lead stage visible in Contacts." },
];

const comparison: string[][] = [
  ["Instagram & Facebook comment-to-DM", "Yes", "Yes", "No"],
  ["YouTube comment auto-replies", "Yes", "No", "No"],
  ["Built-in delivery / sales pages", "Yes", "No", "Yes"],
  ["Lead capture with WhatsApp OTP", "Yes", "Limited", "No"],
  ["Drop-off tracking & AI follow-ups", "Yes", "No", "Limited"],
  ["Unified inbox + scheduling", "Yes", "Inbox only", "No"],
  ["Agency client workspaces", "Yes", "Paid add-on", "No"],
  ["Starting price", "₹9 trial, ₹59/mo", "≈ $15+/mo", "≈ $29+/mo"],
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
    body: "On Instagram and Facebook a keyword in a comment triggers a public reply plus a private DM. On YouTube it sends a smart public reply under the comment.",
  },
  {
    icon: Inbox,
    title: "Nothing slips through",
    body: "Instagram and Facebook DMs plus comments from all three platforms land in one queue, so your team never re-checks three apps or misses a buyer.",
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
    cadence: "₹9 for 3 days trial",
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
      { property: "og:url", content: "https://autodm.techaasvik.com/" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: pageTitle },
      { name: "twitter:description", content: pageDescription },
    ],
    links: [{ rel: "canonical", href: "https://autodm.techaasvik.com/" }],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@graph": [
            {
              "@type": "SoftwareApplication",
              name: "AutoDM by Techaasvik",
              applicationCategory: "BusinessApplication",
              operatingSystem: "Web",
              description: pageDescription,
              featureList: [
                "Unified inbox for Instagram and Facebook messages and comments",
                "Comment-to-DM automations for Instagram and Facebook",
                "Smart public comment replies for YouTube",
                "Post and video scheduling and publishing",
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
                  description: "₹9 for 3 days trial",
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
      <PublicHeader />

      <main>
        {/* Hero */}
        <section className="border-b">
          <div className="mx-auto grid max-w-6xl gap-10 px-6 py-16 items-center lg:grid-cols-[1fr_1fr] lg:py-20">
            <div>
              <span className="inline-flex items-center gap-2 rounded-full border bg-surface px-3 py-1 text-xs font-medium text-muted-foreground">
                <Sparkles className="size-3.5 text-primary" />
                Instagram · Facebook · YouTube in one workspace
              </span>
              <h1 className="mt-5 text-4xl font-bold leading-[1.05] tracking-tight sm:text-5xl lg:text-6xl">
                Turn every reel comment into a paying customer — automatically
              </h1>
              <p className="mt-5 text-lg text-muted-foreground">
                Someone comments “PRICE” → AutoDM sends the DM in seconds → they open
                your delivery page, verify, pay and get the product. Comment-to-DM for
                Instagram &amp; Facebook, smart replies for YouTube, one inbox, built-in
                sales pages.
              </p>
              <div className="mt-5 flex items-center gap-3">
                <Instagram className="size-6 text-instagram" aria-label="Instagram" />
                <Facebook className="size-6 text-facebook" aria-label="Facebook" />
                <Youtube className="size-6 text-youtube" aria-label="YouTube" />
                <span className="text-sm text-muted-foreground">Official APIs · Setup in 5 minutes</span>
              </div>

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
              <div className="mt-8 inline-flex items-center gap-4 rounded-lg border bg-surface px-5 py-4">
                <img
                  src={metaPartnerBadge.url}
                  alt="Meta Business Partner"
                  className="h-16 w-auto object-contain"
                />
                <p className="text-xs text-muted-foreground">
                  Built on the official Meta platform
                  <br />
                  as a Meta Business Partner
                </p>
              </div>
            </div>

            <div className="relative">
              <div className="anim-orb absolute -top-6 right-4 -z-10 size-56 rounded-full bg-primary/20 blur-3xl" aria-hidden />
              <div className="anim-orb absolute bottom-0 left-0 -z-10 size-48 rounded-full bg-accent/40 blur-3xl" style={{ animationDelay: "-7s" }} aria-hidden />
              <Tilt3D>
                <div className="anim-float">
                  <img src={heroReelDm} alt="A creator's reel asks to comment PRICE; the commenter instantly gets an Instagram DM with a Get instant access button" width={1100} height={880} fetchPriority="high" decoding="async" className="w-full drop-shadow-xl" />
                </div>
                <div className="anim-float-slow absolute bottom-6 right-2 rounded-xl border bg-card/90 px-3 py-2 text-xs shadow-lg backdrop-blur" style={{ transform: "translateZ(60px)" }}>
                  <p className="flex items-center gap-1.5 font-semibold text-foreground"><span className="relative flex size-2"><span className="absolute inline-flex size-full animate-ping rounded-full bg-primary opacity-75" /><span className="relative inline-flex size-2 rounded-full bg-primary" /></span>DM sent in 2 seconds</p>
                  <p className="text-muted-foreground">Quiet hours · per-person cap · opt-out</p>
                </div>
                <div className="anim-float absolute -left-8 top-1/2 hidden rounded-xl border bg-card/90 px-3 py-2 text-xs shadow-lg backdrop-blur sm:block" style={{ animationDelay: "-3s" }}>
                  <p className="font-semibold text-foreground">₹999 paid · content unlocked</p>
                  <p className="text-muted-foreground">Razorpay checkout</p>
                </div>
              </Tilt3D>
            </div>
          </div>
        </section>

        {/* Comment-to-cash funnel */}
        <section id="funnel" className="border-b bg-surface">
          <div className="mx-auto max-w-6xl px-6 py-16 lg:py-20">
            <h2 className="max-w-3xl text-3xl font-bold tracking-tight">
              From comment to cash in 4 steps — no link-in-bio hunting
            </h2>
            <p className="mt-3 max-w-2xl text-muted-foreground">
              Other tools stop at the DM. AutoDM carries the buyer all the way to payment and delivery, and shows you where every lead dropped.
            </p>
            <ol className="mt-10 grid gap-4 md:grid-cols-4">
              {funnel.map((f, i) => (
                <li key={f.title} className="panel lift-3d relative p-5">
                  <span className="num text-xs font-bold text-primary">STEP {i + 1}</span>
                  <f.icon className="mt-3 size-6 text-primary" />
                  <h3 className="mt-3 text-base font-semibold">{f.title}</h3>
                  <p className="mt-2 text-sm text-muted-foreground">{f.body}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* Product tour visuals */}
        <section id="tour" className="border-b">
          <div className="mx-auto max-w-6xl space-y-16 px-6 py-16 lg:py-20">
            <div className="mx-auto max-w-2xl text-center">
              <p className="text-xs font-bold tracking-widest text-primary uppercase">Feature breakdown</p>
              <h2 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">See exactly what your followers see</h2>
              <p className="mt-3 text-muted-foreground">Real screens from every step — comment, DM, inbox, checkout.</p>
            </div>
            {[
              { img: shotCommentDm, alt: "A reel comment saying LINK gets an automatic DM reply with a link button", title: "Comment “LINK”, get the link in DM", body: "Pick a reel or post, choose a keyword and the DM to send. Every matching comment gets a public reply and a private message with your link — in seconds, around the clock." },
              { img: shotInbox, alt: "Unified inbox with conversations, contact tags and a revenue chart", title: "Every chat and every rupee in one place", body: "Instagram, Facebook and YouTube conversations land in one inbox. Tag contacts, hand chats to your team and see what each automation earned." },
              { img: shotYtFb, alt: "A YouTube comment gets an AI channel reply and a Facebook comment gets a Messenger DM with a View offer button", title: "YouTube & Facebook on autopilot too", body: "Smart AI replies answer YouTube comments with your link, and Facebook Page comments trigger a Messenger DM — all from the same workspace, with the same safety limits." },
              { img: shotDelivery, alt: "A product sales page with coupon applied, a payment success card and an email receipt", title: "Sell, get paid and deliver automatically", body: "Create a delivery page, connect Razorpay once and every buyer gets their own checkout link. Coupons apply on the page, content unlocks after payment and a receipt email goes out." },
            ].map((x, i) => (
              <Reveal key={x.title} className="grid items-center gap-8 md:grid-cols-2 md:gap-12">
                <Tilt3D max={6} className={i % 2 ? "md:order-2" : ""}>
                  <div className={i % 2 ? "anim-float-slow" : "anim-float"} style={{ animationDelay: `-${i * 1.5}s` }}>
                    <img src={x.img} alt={x.alt} loading="lazy" decoding="async" width={1100} height={836} className="w-full drop-shadow-xl" />
                  </div>
                </Tilt3D>
                <div>
                  <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">{x.title}</h2>
                  <p className="mt-4 text-base leading-relaxed text-muted-foreground">{x.body}</p>
                </div>
              </Reveal>
            ))}
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
                <div key={b.title} className="panel lift-3d p-5">
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

        {/* Comparison */}
        <section id="compare" className="border-b bg-surface">
          <div className="mx-auto max-w-6xl px-6 py-16 lg:py-20">
            <h2 className="text-3xl font-bold tracking-tight">
              AutoDM vs DM-only bots vs link-in-bio stores
            </h2>
            <p className="mt-3 max-w-2xl text-muted-foreground">
              One subscription replaces a DM bot, a sales page builder and a social inbox.
            </p>
            <div className="mt-8 overflow-x-auto rounded-lg border bg-background">
              <table className="w-full min-w-[640px] text-sm">
                <thead className="bg-surface-secondary text-left">
                  <tr>
                    <th className="px-4 py-3 font-semibold">Feature</th>
                    <th className="px-4 py-3 font-semibold text-primary">AutoDM</th>
                    <th className="px-4 py-3 font-semibold">DM-only bots</th>
                    <th className="px-4 py-3 font-semibold">Link-in-bio stores</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {comparison.map((row) => (
                    <tr key={row[0]}>
                      <td className="px-4 py-3">{row[0]}</td>
                      {row.slice(1).map((v, i) => (
                        <td key={i} className={`px-4 py-3 ${i === 0 ? "font-medium text-foreground" : "text-muted-foreground"}`}>
                          {v}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="mt-3 text-xs text-subtle-foreground">
              Based on publicly listed features of popular tools, 2026. Features vary by plan.
            </p>
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
        <section className="mx-auto max-w-6xl px-6 pb-16">
          <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-border bg-card p-6">
            <div>
              <h2 className="text-xl font-semibold">Free tool: WebP &amp; WebM converter</h2>
              <p className="text-sm text-muted-foreground">Shrink any photo, video or audio for faster pages — right in your browser.</p>
            </div>
            <Button asChild variant="outline"><Link to="/tools/webp-converter">Open converter</Link></Button>
          </div>
        </section>
      </main>

      <PublicFooter />
    </div>
  );
}
