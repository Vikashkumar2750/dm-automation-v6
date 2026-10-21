import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

type Ctx = { supabase: any; userId: string };

async function assertSuperAdmin(context: Ctx) {
  const { data } = await context.supabase.rpc("current_user_has_platform_role", { _role: "super_admin" });
  if (!data) throw new Error("forbidden");
}

const BUCKETS = ["delivery-page-images", "blog-media", "post-media"] as const;

/** Records an upload with its before/after size (RLS: own user + own workspace). */
export const recordMediaAsset = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      organizationId: z.string().uuid().nullable(),
      bucket: z.enum(BUCKETS),
      path: z.string().min(1).max(300),
      kind: z.enum(["image", "video", "audio", "file"]),
      originalName: z.string().max(200).optional(),
      originalType: z.string().max(100).optional(),
      originalBytes: z.number().int().min(0),
      optimizedType: z.string().max(100).optional(),
      optimizedBytes: z.number().int().min(0),
      source: z.string().max(40).default("upload"),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("media_assets").insert({
      organization_id: data.organizationId, user_id: context.userId, bucket: data.bucket, path: data.path,
      kind: data.kind, original_name: data.originalName, original_type: data.originalType,
      original_bytes: data.originalBytes, optimized_type: data.optimizedType, optimized_bytes: data.optimizedBytes, source: data.source,
    });
    if (error) console.error("recordMediaAsset", error.message);
    return { ok: !error };
  });

export const adminListMedia = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ userId: z.string().uuid().nullable() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertSuperAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    let q = supabaseAdmin.from("media_assets").select("*").order("created_at", { ascending: false }).limit(300);
    if (data.userId) q = q.eq("user_id", data.userId);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    const { data: all } = await supabaseAdmin.from("media_assets").select("user_id, original_bytes, optimized_bytes").limit(5000);
    const ids = [...new Set((all ?? []).map((r) => r.user_id).filter(Boolean))] as string[];
    const { data: profiles } = ids.length
      ? await supabaseAdmin.from("profiles").select("id, email, full_name").in("id", ids)
      : { data: [] as any[] };
    const items = await Promise.all((rows ?? []).map(async (r) => {
      const signed = await supabaseAdmin.storage.from(r.bucket).createSignedUrl(r.path, 3600);
      return { ...r, url: signed.data?.signedUrl ?? "" };
    }));
    const totals = (all ?? []).reduce((a, r) => ({ before: a.before + Number(r.original_bytes), after: a.after + Number(r.optimized_bytes) }), { before: 0, after: 0 });
    return { items, users: profiles ?? [], totals };
  });

export const adminDeleteMedia = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertSuperAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row } = await supabaseAdmin.from("media_assets").select("bucket, path").eq("id", data.id).maybeSingle();
    if (!row) throw new Error("Not found");
    await supabaseAdmin.storage.from(row.bucket).remove([row.path]);
    await supabaseAdmin.from("media_assets").delete().eq("id", data.id);
    await supabaseAdmin.from("platform_audit_log").insert({ actor_user_id: context.userId, action: "platform.media_delete", target_type: "media", target_id: data.id, detail: { bucket: row.bucket } });
    return { ok: true };
  });

/** Overwrites the stored file in place (same path, so every page using it updates). The browser sends an already-optimized file. */
export const adminReplaceMedia = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ id: z.string().uuid(), type: z.string().max(100), base64: z.string().max(28_000_000), originalBytes: z.number().int().min(0) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertSuperAdmin(context);
    if (!/^(image|video|audio)\//.test(data.type)) throw new Error("Only images, videos or audio");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row } = await supabaseAdmin.from("media_assets").select("bucket, path").eq("id", data.id).maybeSingle();
    if (!row) throw new Error("Not found");
    const bytes = Buffer.from(data.base64, "base64");
    const { error } = await supabaseAdmin.storage.from(row.bucket).upload(row.path, bytes, { contentType: data.type, upsert: true });
    if (error) throw new Error(error.message);
    await supabaseAdmin.from("media_assets").update({
      original_bytes: data.originalBytes, optimized_bytes: bytes.byteLength, optimized_type: data.type, updated_at: new Date().toISOString(),
    }).eq("id", data.id);
    await supabaseAdmin.from("platform_audit_log").insert({ actor_user_id: context.userId, action: "platform.media_replace", target_type: "media", target_id: data.id, detail: { bucket: row.bucket } });
    return { ok: true };
  });
