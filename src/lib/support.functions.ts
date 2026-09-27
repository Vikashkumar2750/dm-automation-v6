import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const supportInquirySchema = z.object({
  name: z.string().trim().min(2, "Enter your name").max(100),
  email: z.string().trim().toLowerCase().email("Enter a valid email").max(200),
  subject: z.string().trim().min(3, "Enter a subject").max(160),
  category: z.enum(["general", "technical", "billing", "privacy", "partnership"]),
  message: z.string().trim().min(10, "Please add a little more detail").max(4000),
});

export type SupportInquiry = {
  id: string;
  name: string;
  email: string;
  subject: string;
  category: string;
  message: string;
  status: "open" | "resolved";
  email_notification_status: "pending" | "sent" | "failed";
  email_notification_error: string | null;
  resolved_at: string | null;
  created_at: string;
};

async function assertSuperAdmin(context: { supabase: any }) {
  const { data } = await context.supabase.rpc("current_user_has_platform_role", { _role: "super_admin" });
  if (!data) throw new Error("Forbidden");
}

export const submitSupportInquiry = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => supportInquirySchema.parse(data))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const hourAgo = new Date(Date.now() - 3_600_000).toISOString();
    const { count } = await supabaseAdmin
      .from("support_inquiries")
      .select("id", { count: "exact", head: true })
      .eq("email", data.email)
      .gte("created_at", hourAgo);
    if ((count ?? 0) >= 3) return { ok: false as const, reason: "rate_limited" as const };

    const { data: row, error } = await supabaseAdmin
      .from("support_inquiries")
      .insert(data)
      .select("id")
      .single();
    if (error) throw new Error("Your inquiry could not be saved. Please try again.");

    const { readPlatformConfig } = await import("@/lib/platform-config.server");
    const config = await readPlatformConfig(supabaseAdmin);
    const { sendInquiryAlert } = await import("@/lib/support-email.server");
    let delivery: { status: "pending" | "sent" | "failed"; error: string | null } = {
      status: "pending",
      error: null,
    };
    if (config.email.events.support_inquiry !== false) {
      try {
        delivery = await sendInquiryAlert(data, config.email.adminAlertEmail, config.email.senderName);
      } catch {
        delivery = { status: "failed", error: "Email provider could not be reached" };
      }
    }
    await supabaseAdmin
      .from("support_inquiries")
      .update({ email_notification_status: delivery.status, email_notification_error: delivery.error })
      .eq("id", row.id);
    return { ok: true as const };
  });

export const listSupportInquiries = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<SupportInquiry[]> => {
    await assertSuperAdmin(context);
    const { data, error } = await context.supabase
      .from("support_inquiries")
      .select("id, name, email, subject, category, message, status, email_notification_status, email_notification_error, resolved_at, created_at")
      .order("created_at", { ascending: false })
      .limit(500);
    if (error) throw new Error(error.message);
    return (data ?? []) as SupportInquiry[];
  });

export const setSupportInquiryStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z.object({ id: z.string().uuid(), status: z.enum(["open", "resolved"]) }).parse(data),
  )
  .handler(async ({ data, context }) => {
    await assertSuperAdmin(context);
    const { error } = await context.supabase
      .from("support_inquiries")
      .update({
        status: data.status,
        resolved_at: data.status === "resolved" ? new Date().toISOString() : null,
        resolved_by: data.status === "resolved" ? context.userId : null,
      })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("platform_audit_log").insert({
      actor_user_id: context.userId,
      action: `support_inquiry.${data.status}`,
      target_type: "support_inquiry",
      target_id: data.id,
      detail: {},
    });
    return { ok: true };
  });