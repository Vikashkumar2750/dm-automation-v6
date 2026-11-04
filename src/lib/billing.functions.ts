import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { findPlanOption, type BillingCycle, type PlanKey } from "@/lib/plans";

const DEMO_KEY_IDS = ["rzp_test_1DP5mmOlF5G5ag"];

type Ctx = { supabase: ReturnType<typeof Object> } & Record<string, never>;

async function assertBillingRole(
  supabase: { from: (t: string) => any },
  organizationId: string,
  userId: string,
) {
  const { data } = await supabase
    .from("organization_members")
    .select("role")
    .eq("organization_id", organizationId)
    .eq("user_id", userId)
    .maybeSingle();
  const role = data?.role as string | undefined;
  if (!role || !["owner", "admin"].includes(role)) throw new Error("forbidden");
  return role;
}

export const getBillingState = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ organizationId: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const { data: org } = await context.supabase
      .from("organizations")
      .select("id, name, plan, plan_expires_at, plan_source, parent_organization_id")
      .eq("id", data.organizationId)
      .maybeSingle();
    const { data: orders } = await context.supabase
      .from("plan_orders")
      .select("id, plan, billing_cycle, amount_paise, status, mode, created_at, paid_at")
      .eq("organization_id", data.organizationId)
      .order("created_at", { ascending: false })
      .limit(10);
    const { data: me } = await context.supabase
      .from("organization_members")
      .select("role")
      .eq("organization_id", data.organizationId)
      .eq("user_id", context.userId)
      .maybeSingle();

    if (!org || !me) throw new Error("not_a_member");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { resolveWorkspaceEntitlements } = await import("./workspace-entitlements.server");
    const entitlement = await resolveWorkspaceEntitlements(supabaseAdmin, org);
    const keyId = process.env["RAZORPAY_KEY_ID"] ?? "";
    return {
      plan: entitlement.plan,
      planExpiresAt: entitlement.plan_expires_at,
      planSource: entitlement.inherited ? "agency_parent" : org.plan_source,
      orders: orders ?? [],
      canPay: !entitlement.inherited && ["owner", "admin"].includes(me.role),
      razorpayKeyId: keyId,
      demoMode: !keyId || DEMO_KEY_IDS.includes(keyId),
    };
  });

export const createPlanOrder = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        organizationId: z.string().uuid(),
        plan: z.enum(["starter", "pro"]),
        cycle: z.enum(["lifetime", "monthly", "half_yearly", "yearly"]),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    await assertBillingRole(context.supabase as never, data.organizationId, context.userId);

    const { supabaseAdmin: adminForPlans } = await import("@/integrations/supabase/client.server");
    const { findConfiguredOption } = await import("@/lib/platform-config.server");
    const option =
      (await findConfiguredOption(adminForPlans, data.plan, data.cycle)) ??
      findPlanOption(data.plan as PlanKey, data.cycle as BillingCycle);
    if (!option) throw new Error("invalid_plan_option");

    const keyId = process.env["RAZORPAY_KEY_ID"] ?? "";
    const keySecret = process.env["RAZORPAY_KEY_SECRET"] ?? "";
    const demoKeys = !keyId || !keySecret || DEMO_KEY_IDS.includes(keyId);

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    let providerOrderId: string | null = null;
    let mode: "live" | "demo" = demoKeys ? "demo" : "live";

    if (!demoKeys) {
      const receipt = `org_${data.organizationId.slice(0, 8)}_${Date.now()}`;
      const res = await fetch("https://api.razorpay.com/v1/orders", {
        method: "POST",
        headers: {
          Authorization: `Basic ${btoa(`${keyId}:${keySecret}`)}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          amount: option.amountPaise,
          currency: "INR",
          receipt,
          notes: { organization_id: data.organizationId, plan: data.plan, cycle: data.cycle },
        }),
      });
      if (res.ok) {
        const json = (await res.json()) as { id: string };
        providerOrderId = json.id;
      } else {
        // Credentials are not usable yet — fall back to a clearly marked demo order.
        mode = "demo";
      }
    }

    const { data: row, error } = await supabaseAdmin
      .from("plan_orders")
      .insert({
        organization_id: data.organizationId,
        created_by: context.userId,
        plan: data.plan,
        billing_cycle: data.cycle,
        amount_paise: option.amountPaise,
        mode,
        provider_order_id: providerOrderId,
        status: "created",
      })
      .select("id")
      .maybeSingle();
    if (error) throw new Error(error.message);

    return {
      orderId: row!.id as string,
      providerOrderId,
      amountPaise: option.amountPaise,
      currency: "INR",
      mode,
      razorpayKeyId: keyId,
    };
  });

async function hmacSha256Hex(secret: string, message: string) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(message));
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function nextExpiry(current: string | null, months: number | null): string | null {
  if (months === null) return new Date(Date.now() + 3 * 864e5).toISOString(); // 3-day trial
  const base = current && new Date(current) > new Date() ? new Date(current) : new Date();
  base.setMonth(base.getMonth() + months);
  return base.toISOString();
}

export const confirmPlanPayment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        orderId: z.string().uuid(),
        razorpayPaymentId: z.string().optional(),
        razorpaySignature: z.string().optional(),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: order } = await supabaseAdmin
      .from("plan_orders")
      .select("*")
      .eq("id", data.orderId)
      .maybeSingle();
    if (!order) throw new Error("order_not_found");
    await assertBillingRole(context.supabase as never, order.organization_id, context.userId);
    if (order.status === "paid") return { ok: true, alreadyPaid: true };

    if (order.mode !== "live" && process.env["ALLOW_DEMO_PAYMENTS"] !== "true") {
      throw new Error("Online payment is not available right now. Please contact support.");
    }
    if (order.mode === "live") {
      const secret = process.env["RAZORPAY_KEY_SECRET"] ?? "";
      if (!data.razorpayPaymentId || !data.razorpaySignature || !order.provider_order_id) {
        throw new Error("missing_payment_proof");
      }
      const expected = await hmacSha256Hex(
        secret,
        `${order.provider_order_id}|${data.razorpayPaymentId}`,
      );
      if (!secret || expected !== data.razorpaySignature) {
        await supabaseAdmin
          .from("plan_orders")
          .update({ status: "failed", error: "signature_mismatch" })
          .eq("id", order.id);
        throw new Error("signature_mismatch");
      }
      // Confirm with Razorpay itself that this exact payment was captured for this order and amount.
      const keyId = process.env["RAZORPAY_KEY_ID"] ?? "";
      if (!keyId) throw new Error("payment_verification_unavailable");
      const res = await fetch(
        `https://api.razorpay.com/v1/payments/${encodeURIComponent(data.razorpayPaymentId)}`,
        { headers: { Authorization: `Basic ${btoa(`${keyId}:${secret}`)}` } },
      );
      const payment = res.ok
        ? ((await res.json()) as { status?: string; order_id?: string; amount?: number; currency?: string })
        : null;
      if (
        !payment ||
        payment.status !== "captured" ||
        payment.order_id !== order.provider_order_id ||
        payment.amount !== order.amount_paise ||
        (payment.currency ?? "").toUpperCase() !== String(order.currency).toUpperCase()
      ) {
        throw new Error("payment_not_verified");
      }
    }

    // Claim the order atomically so one payment can only ever grant one upgrade.
    const { data: claimed } = await supabaseAdmin
      .from("plan_orders")
      .update({
        status: "paid",
        provider_payment_id: data.razorpayPaymentId ?? null,
        paid_at: new Date().toISOString(),
      })
      .eq("id", order.id)
      .neq("status", "paid")
      .select("id");
    if (!claimed || claimed.length === 0) return { ok: true, alreadyPaid: true };

    const { findConfiguredOption } = await import("@/lib/platform-config.server");
    const option =
      (await findConfiguredOption(supabaseAdmin, order.plan as string, order.billing_cycle as string)) ??
      findPlanOption(order.plan as PlanKey, order.billing_cycle as BillingCycle);
    const { data: org } = await supabaseAdmin
      .from("organizations")
      .select("plan_expires_at")
      .eq("id", order.organization_id)
      .maybeSingle();

    const expires = nextExpiry(
      (org?.plan_expires_at as string | null) ?? null,
      option?.months ?? null,
    );

    await supabaseAdmin
      .from("organizations")
      .update({
        plan: order.plan,
        plan_expires_at: expires,
        plan_source: order.mode === "demo" ? "demo_payment" : "razorpay",
      })
      .eq("id", order.organization_id);

    return { ok: true, plan: order.plan as string, planExpiresAt: expires, mode: order.mode };
  });
