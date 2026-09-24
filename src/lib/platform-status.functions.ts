import { createServerFn } from "@tanstack/react-start";

/** Public, read-only: only exposes the registration + maintenance switches. */
export const getPlatformStatus = createServerFn({ method: "GET" }).handler(async () => {
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data } = await supabaseAdmin
      .from("platform_settings")
      .select("feature_flags")
      .eq("id", true)
      .maybeSingle();
    const flags = (data?.feature_flags as Record<string, boolean> | null) ?? {};
    return {
      registrationBlocked: flags["registration_blocked"] === true,
      maintenanceMode: flags["maintenance_mode"] === true,
    };
  } catch {
    return { registrationBlocked: false, maintenanceMode: false };
  }
});
