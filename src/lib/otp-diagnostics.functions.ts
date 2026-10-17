import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function assertSuperAdmin(ctx: { supabase: unknown }) {
  const sb = ctx.supabase as import("@supabase/supabase-js").SupabaseClient;
  const { data } = await sb.rpc("current_user_has_platform_role", { _role: "super_admin" });
  if (!data) throw new Error("Forbidden");
}

/** All workspaces at once: email provider + every WhatsApp OTP setup (live Meta check) + 24h counts. */
export const checkAllOtpDelivery = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertSuperAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { emailProviderReady } = await import("@/lib/support-email.server");
    const { checkWhatsappCredentials } = await import("@/lib/whatsapp-otp.server");
    const since = new Date(Date.now() - 86_400_000).toISOString();

    const [settings, orgs, waCodes, emailCodes] = await Promise.all([
      supabaseAdmin.from("whatsapp_otp_settings").select("organization_id, template_name"),
      supabaseAdmin.from("organizations").select("id, name"),
      supabaseAdmin.from("lead_otp_codes").select("organization_id, verified_at").gte("created_at", since).limit(5000),
      supabaseAdmin.from("buyer_login_codes").select("organization_id").gte("created_at", since).limit(5000),
    ]);
    const names = new Map((orgs.data ?? []).map((o) => [o.id as string, o.name as string]));
    const wa = (waCodes.data ?? []) as { organization_id: string; verified_at: string | null }[];
    const em = (emailCodes.data ?? []) as { organization_id: string }[];

    const workspaces = await Promise.all(
      ((settings.data ?? []) as { organization_id: string; template_name: string }[]).map(async (s) => {
        const check = await checkWhatsappCredentials(supabaseAdmin, s.organization_id);
        const mine = wa.filter((c) => c.organization_id === s.organization_id);
        return {
          organizationId: s.organization_id,
          name: names.get(s.organization_id) ?? "Unknown workspace",
          template: s.template_name,
          ok: check.ok,
          detail: check.detail,
          sent24h: mine.length,
          verified24h: mine.filter((c) => c.verified_at).length,
          emailCodes24h: em.filter((c) => c.organization_id === s.organization_id).length,
        };
      }),
    );
    return {
      email: { ready: emailProviderReady(), codes24h: em.length },
      whatsapp: { sent24h: wa.length, verified24h: wa.filter((c) => c.verified_at).length },
      workspaces,
    };
  });

/** Live test: sends a sample code by email and/or WhatsApp (via every connected workspace, or one). */
export const sendOtpDeliveryTest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      email: z.union([z.literal(""), z.string().trim().email().max(200)]),
      phone: z.string().trim().max(20),
      organizationId: z.string().uuid().nullable(),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertSuperAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const results: { channel: string; target: string; ok: boolean; detail: string; ms: number }[] = [];

    if (data.email) {
      const { sendPlainEmail, emailProviderReady } = await import("@/lib/support-email.server");
      const t = Date.now();
      if (!emailProviderReady()) results.push({ channel: "Email", target: data.email, ok: false, detail: "Resend not set up", ms: 0 });
      else {
        const r = await sendPlainEmail(data.email, "AutoDM OTP delivery test", "Test code: 123456\n\nThis is a delivery check from AutoDM Super Admin.");
        results.push({ channel: "Email", target: data.email, ok: r.status === "sent", detail: r.error ?? "Sent", ms: Date.now() - t });
      }
    }
    if (data.phone) {
      const { sendTestWhatsappOtp } = await import("@/lib/whatsapp-otp.server");
      let ids: string[] = data.organizationId ? [data.organizationId] : [];
      if (!ids.length) {
        const { data: rows } = await supabaseAdmin.from("whatsapp_otp_settings").select("organization_id");
        ids = (rows ?? []).map((r) => r.organization_id as string);
      }
      const { data: orgs } = await supabaseAdmin.from("organizations").select("id, name").in("id", ids.length ? ids : ["00000000-0000-0000-0000-000000000000"]);
      const names = new Map((orgs ?? []).map((o) => [o.id as string, o.name as string]));
      if (!ids.length) results.push({ channel: "WhatsApp", target: data.phone, ok: false, detail: "No workspace has WhatsApp OTP set up", ms: 0 });
      for (const id of ids) {
        const t = Date.now();
        const r = await sendTestWhatsappOtp(supabaseAdmin, id, data.phone);
        results.push({ channel: `WhatsApp · ${names.get(id) ?? id}`, target: data.phone, ok: r.ok, detail: r.detail, ms: Date.now() - t });
      }
    }
    await supabaseAdmin.from("platform_audit_log").insert({
      actor_user_id: context.userId, action: "platform.otp_delivery_test", target_type: "platform",
      detail: { channels: results.map((r) => r.channel), ok: results.filter((r) => r.ok).length },
    });
    return { results };
  });
