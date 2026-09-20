import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type WebhookEventRow = {
  id: string;
  provider: string;
  platform: "instagram" | "facebook" | "youtube" | null;
  event_type: string;
  status: "received" | "processed" | "failed" | "ignored";
  error: string | null;
  signature_valid: boolean;
  received_at: string;
};

export const listWebhookEvents = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z.object({ organizationId: z.string().uuid() }).parse(data),
  )
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
      .from("webhook_events")
      .select("id, provider, platform, event_type, status, error, signature_valid, received_at")
      .eq("organization_id", data.organizationId)
      .order("received_at", { ascending: false })
      .limit(20);
    if (error) throw new Error(error.message);
    return (rows ?? []) as WebhookEventRow[];
  });

export const getWebhookConfig = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async () => ({
    verifyTokenSet: Boolean(process.env["META_WEBHOOK_VERIFY_TOKEN"]),
    appSecretSet: Boolean(process.env["META_APP_SECRET"]),
  }));
