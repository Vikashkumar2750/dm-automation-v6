import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Check, CreditCard } from "lucide-react";

import { AppShell } from "@/components/app/AppShell";
import { PageHeader, Panel, StatCard, StatusBadge } from "@/components/app/primitives";
import { Button } from "@/components/ui/button";
import { useTenant } from "@/hooks/useTenant";
import { getAutomationUsage } from "@/lib/automations.functions";
import { listSocialAccounts } from "@/lib/social-accounts.functions";

export const Route = createFileRoute("/_authenticated/billing")({
  head: () => ({
    meta: [
      { title: "Billing — DM FB-IG-YT by Techaasvik" },
      {
        name: "description",
        content: "Your current plan, what it includes and how much of it you are using.",
      },
      { property: "og:title", content: "Billing & plan" },
      {
        property: "og:description",
        content: "Plan limits for accounts, automated replies and team seats.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: BillingPage,
});

const PLANS = [
  {
    key: "starter",
    name: "Starter",
    price: "₹0",
    perks: ["2 connected accounts", "1,000 automated replies / month", "3 team seats"],
  },
  {
    key: "pro",
    name: "Pro",
    price: "₹2,499 / month",
    perks: ["10 connected accounts", "25,000 automated replies / month", "10 team seats", "AI assistant"],
  },
  {
    key: "agency",
    name: "Agency",
    price: "₹7,999 / month",
    perks: ["Unlimited accounts", "Unlimited client workspaces", "White-label branding", "Priority support"],
  },
];

function BillingPage() {
  const { activeOrg } = useTenant();
  const orgId = activeOrg?.id ?? null;
  const currentPlan = (activeOrg?.plan ?? "Starter Plan").split(" ")[0]?.toLowerCase() ?? "starter";

  const fetchUsage = useServerFn(getAutomationUsage);
  const fetchAccounts = useServerFn(listSocialAccounts);

  const usage = useQuery({
    queryKey: ["automation-usage", orgId],
    enabled: !!orgId,
    queryFn: () => fetchUsage({ data: { organizationId: orgId! } }),
  });
  const accounts = useQuery({
    queryKey: ["social-accounts", orgId],
    enabled: !!orgId,
    queryFn: () => fetchAccounts({ data: { organizationId: orgId! } }),
  });

  return (
    <AppShell>
      <PageHeader
        title="Billing"
        description="Your plan, what it includes and how much of it you are using."
        actions={
          <Button asChild variant="outline">
            <Link to="/usage">See usage</Link>
          </Button>
        }
      />

      <div className="space-y-6">
        <div className="grid gap-4 sm:grid-cols-3">
          <StatCard
            icon={CreditCard}
            label="Current plan"
            value={activeOrg?.plan ?? "—"}
            sub={activeOrg?.name ?? ""}
          />
          <StatCard
            icon={Check}
            label="Connected accounts"
            value={String(accounts.data?.length ?? 0)}
            sub="Instagram and Facebook"
          />
          <StatCard
            icon={Check}
            label="Automated replies today"
            value={String(usage.data?.sentLastDay ?? 0)}
            sub={`Daily limit ${usage.data?.dailyLimit ?? 0}`}
          />
        </div>

        <div className="grid gap-4 lg:grid-cols-3">
          {PLANS.map((p) => (
            <Panel
              key={p.key}
              title={
                <span className="flex items-center gap-2">
                  {p.name}
                  {p.key === currentPlan && <StatusBadge tone="success">Current</StatusBadge>}
                </span>
              }
            >
              <p className="text-2xl font-semibold">{p.price}</p>
              <ul className="mt-4 space-y-2 text-sm text-muted-foreground">
                {p.perks.map((perk) => (
                  <li key={perk} className="flex items-start gap-2">
                    <Check className="mt-0.5 size-4 text-success" />
                    {perk}
                  </li>
                ))}
              </ul>
              <Button className="mt-5 w-full" variant={p.key === currentPlan ? "outline" : "default"} asChild>
                <a href="mailto:contact@techaavik.com?subject=Plan%20upgrade">
                  {p.key === currentPlan ? "Your plan" : "Talk to us"}
                </a>
              </Button>
            </Panel>
          ))}
        </div>

        <Panel title="How billing works">
          <p className="text-sm text-muted-foreground">
            Plans are set by the Techaasvik team — write to contact@techaavik.com to change yours.
            Online card payments are not switched on yet, so nothing is charged from this screen.
          </p>
        </Panel>
      </div>
    </AppShell>
  );
}
