import { createServerFn } from "@tanstack/react-start";
import { publishingMode } from "@/lib/publishing-availability";

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
      workflowsEnabled: flags["workflows_enabled"] === true,
      createPostMode: publishingMode(flags, "create_post"),
      calendarMode: publishingMode(flags, "calendar"),
    };
  } catch {
    return { registrationBlocked: false, maintenanceMode: false, workflowsEnabled: false, createPostMode: "hidden" as const, calendarMode: "hidden" as const };
  }
});
