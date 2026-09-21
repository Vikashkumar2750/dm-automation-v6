import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Check, CreditCard, ShieldCheck } from "lucide-react";
import { toast } from "sonner";

import { AppShell } from "@/components/app/AppShell";
import { PageHeader, Panel, StatCard, StatusBadge } from "@/components/app/primitives";
import { Button } from "@/components/ui/button";
import { useTenant } from "@/hooks/useTenant";
import { getAutomationUsage } from "@/lib/automations.functions";
import { listSocialAccounts } from "@/lib/social-accounts.functions";
import { confirmPlanPayment, createPlanOrder, getBillingState } from "@/lib/billing.functions";
import { PLANS, formatPaise, type BillingCycle, type PlanKey } from "@/lib/plans";

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

declare global {
  interface Window {
    Razorpay?: new (options: Record<string, unknown>) => { open: () => void };
  }
}

function loadRazorpay(): Promise<boolean> {
  if (typeof window === "undefined") return Promise.resolve(false);
  if (window.Razorpay) return Promise.resolve(true);
  return new Promise((resolve) => {
    const s = document.createElement("script");
    s.src = "https://checkout.razorpay.com/v1/checkout.js";
    s.onload = () => resolve(true);
    s.onerror = () => resolve(false);
    document.body.appendChild(s);
  });
}

function BillingPage() {
  const { activeOrg } = useTenant();
  const orgId = activeOrg?.id ?? null;
  const queryClient = useQueryClient();
  const [busy, setBusy] = useState<string | null>(null);
  const [cycles, setCycles] = useState<Record<string, BillingCycle>>({ pro: "monthly" });

  const fetchUsage = useServerFn(getAutomationUsage);
  const fetchAccounts = useServerFn(listSocialAccounts);
  const fetchBilling = useServerFn(getBillingState);
  const startOrder = useServerFn(createPlanOrder);
  const confirmPayment = useServerFn(confirmPlanPayment);

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
  const billing = useQuery({
    queryKey: ["billing-state", orgId],
    enabled: !!orgId,
    queryFn: () => fetchBilling({ data: { organizationId: orgId! } }),
  });

  const currentPlan = billing.data?.plan ?? "starter";
  const canPay = billing.data?.canPay ?? false;

  async function finish(orderId: string, paymentId?: string, signature?: string) {
    const res = await confirmPayment({
      data: { orderId, razorpayPaymentId: paymentId, razorpaySignature: signature },
    });
    toast.success(`Plan updated to ${res.plan ?? "new plan"}`);
    await queryClient.invalidateQueries({ queryKey: ["billing-state", orgId] });
    await queryClient.invalidateQueries({ queryKey: ["tenant"] });
  }

  async function buy(plan: PlanKey, cycle: BillingCycle) {
    if (!orgId) return;
    setBusy(`${plan}-${cycle}`);
    try {
      const order = await startOrder({ data: { organizationId: orgId, plan: plan as "starter" | "pro", cycle } });

      if (order.mode === "demo" || !order.providerOrderId) {
        await finish(order.orderId);
        toast.message("Demo payment — no money was charged.");
        return;
      }

      const ok = await loadRazorpay();
      if (!ok || !window.Razorpay) {
        toast.error("Could not open the payment window. Please try again.");
        return;
      }
      const rzp = new window.Razorpay({
        key: order.razorpayKeyId,
        amount: order.amountPaise,
        currency: order.currency,
        name: "Techaasvik",
        description: `${plan} plan`,
        order_id: order.providerOrderId,
        handler: (response: {
          razorpay_payment_id: string;
          razorpay_signature: string;
        }) => {
          void finish(order.orderId, response.razorpay_payment_id, response.razorpay_signature).catch(
            () => toast.error("Payment could not be verified. Please contact support."),
          );
        },
        theme: { color: "#4f46e5" },
      });
      rzp.open();
    } catch {
      toast.error("Could not start the payment. Please try again.");
    } finally {
      setBusy(null);
    }
  }

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
            value={currentPlan}
            sub={
              billing.data?.planExpiresAt
                ? `Renews ${new Date(billing.data.planExpiresAt).toLocaleDateString("en-IN")}`
                : billing.data?.planSource === "granted"
                  ? "Given by Techaasvik"
                  : "Lifetime / no end date"
            }
          />
          <StatCard
            icon={Check}
            label="Connected accounts"
            value={String(accounts.data?.length ?? 0)}
            sub="Instagram, Facebook and YouTube"
          />
          <StatCard
            icon={Check}
            label="Automated replies today"
            value={String(usage.data?.sentLastDay ?? 0)}
            sub={`Daily limit ${usage.data?.dailyLimit ?? 0}`}
          />
        </div>

        {billing.data?.demoMode && (
          <Panel title="Test mode">
            <p className="text-sm text-muted-foreground">
              Payments are running with demo keys, so nothing is charged and plans activate instantly
              for testing. Add live payment keys to take real payments.
            </p>
          </Panel>
        )}

        <div className="grid gap-4 lg:grid-cols-3">
          {PLANS.map((p) => {
            const selected = cycles[p.key] ?? p.options[0]?.cycle;
            const option = p.options.find((o) => o.cycle === selected) ?? p.options[0];
            const isCurrent = p.key === currentPlan;
            return (
              <Panel
                key={p.key}
                title={
                  <span className="flex items-center gap-2">
                    {p.name}
                    {isCurrent && <StatusBadge tone="success">Current</StatusBadge>}
                  </span>
                }
              >
                <p className="num text-2xl font-semibold">{p.headline}</p>
                <ul className="mt-4 space-y-2 text-sm text-muted-foreground">
                  {p.perks.map((perk) => (
                    <li key={perk} className="flex items-start gap-2">
                      <Check className="mt-0.5 size-4 shrink-0 text-success" />
                      {perk}
                    </li>
                  ))}
                </ul>

                {p.options.length > 1 && (
                  <div className="mt-4 flex flex-wrap gap-2">
                    {p.options.map((o) => (
                      <button
                        key={o.cycle}
                        type="button"
                        onClick={() => setCycles((c) => ({ ...c, [p.key]: o.cycle }))}
                        className={`rounded-md border px-2.5 py-1 text-xs ${
                          o.cycle === selected ? "border-primary text-primary" : "text-muted-foreground"
                        }`}
                      >
                        {o.label}
                      </button>
                    ))}
                  </div>
                )}

                {p.contactOnly ? (
                  <Button className="mt-5 w-full" variant="outline" asChild>
                    <a href="mailto:contact@techaavik.com?subject=Agency%20plan">Talk to us</a>
                  </Button>
                ) : (
                  <Button
                    className="mt-5 w-full"
                    variant={isCurrent ? "outline" : "default"}
                    disabled={!canPay || !option || busy === `${p.key}-${selected}`}
                    onClick={() => option && buy(p.key, option.cycle)}
                  >
                    {busy === `${p.key}-${selected}`
                      ? "Opening payment…"
                      : isCurrent
                        ? `Renew for ${formatPaise(option?.amountPaise ?? 0)}`
                        : `Pay ${formatPaise(option?.amountPaise ?? 0)}`}
                  </Button>
                )}
                {!canPay && !p.contactOnly && (
                  <p className="mt-2 text-xs text-muted-foreground">
                    Only the workspace owner or an admin can pay.
                  </p>
                )}
              </Panel>
            );
          })}
        </div>

        <Panel title="Payment history">
          {(billing.data?.orders ?? []).length === 0 ? (
            <p className="text-sm text-muted-foreground">No payments yet.</p>
          ) : (
            <ul className="space-y-2 text-sm">
              {billing.data!.orders.map((o) => (
                <li key={o.id} className="flex items-center justify-between rounded-lg border px-3 py-2">
                  <span className="capitalize">
                    {o.plan} · {String(o.billing_cycle).replace(/_/g, " ")}
                  </span>
                  <span className="flex items-center gap-3">
                    <span className="num">{formatPaise(o.amount_paise)}</span>
                    <StatusBadge tone={o.status === "paid" ? "success" : "warning"}>
                      {o.mode === "grant" ? "given by Techaasvik" : o.status}
                    </StatusBadge>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel title="How billing works">
          <p className="flex items-start gap-2 text-sm text-muted-foreground">
            <ShieldCheck className="mt-0.5 size-4 shrink-0 text-success" />
            Payments are handled by Razorpay — card details never reach us. The Techaasvik team can
            also assign a plan to your workspace without a payment.
          </p>
        </Panel>
      </div>
    </AppShell>
  );
}
