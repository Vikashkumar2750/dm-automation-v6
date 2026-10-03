import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { normalizeTag } from "@/lib/crm";

type Ctx = { supabase: any; userId: string };
const org = z.string().uuid();
const platform = z.enum(["instagram", "facebook", "youtube"]);

/** Tags, profiles and saved segments for a workspace (RLS: members only). */
export const getCrm = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ organizationId: org }).parse(d))
  .handler(async ({ data, context }) => {
    const sb = (context as Ctx).supabase;
    const [tags, profiles, segments] = await Promise.all([
      sb.from("contact_tags").select("id, platform, external_user_id, tag").eq("organization_id", data.organizationId).limit(5000),
      sb.from("contact_profiles").select("platform, external_user_id, email, phone, notes, custom_fields").eq("organization_id", data.organizationId).limit(5000),
      sb.from("contact_segments").select("id, name, filter").eq("organization_id", data.organizationId).order("created_at"),
    ]);
    return {
      tags: (tags.data ?? []) as Array<{ id: string; platform: string; external_user_id: string; tag: string }>,
      profiles: (profiles.data ?? []) as Array<{ platform: string; external_user_id: string; email: string | null; phone: string | null; notes: string | null; custom_fields: Record<string, string> }>,
      segments: (segments.data ?? []) as Array<{ id: string; name: string; filter: Record<string, unknown> }>,
    };
  });

const contactRef = { organizationId: org, platform, externalUserId: z.string().min(1).max(100) };

export const saveContactProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      ...contactRef,
      email: z.string().trim().email().max(200).nullable(),
      phone: z.string().trim().regex(/^\+?[\d\s-]{6,20}$/).nullable(),
      notes: z.string().max(2000).nullable(),
      customFields: z.record(z.string().max(40), z.string().max(300)).refine((o) => Object.keys(o).length <= 20),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { error } = await (context as Ctx).supabase.from("contact_profiles").upsert(
      {
        organization_id: data.organizationId, platform: data.platform, external_user_id: data.externalUserId,
        email: data.email, phone: data.phone, notes: data.notes, custom_fields: data.customFields, updated_at: new Date().toISOString(),
      },
      { onConflict: "organization_id,platform,external_user_id" },
    );
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const addContactTag = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ ...contactRef, tag: z.string().min(1).max(60) }).parse(d))
  .handler(async ({ data, context }) => {
    const tag = normalizeTag(data.tag);
    if (!tag) throw new Error("invalid_tag");
    const sb = (context as Ctx).supabase;
    const { data: existing } = await sb.from("contact_tags").select("id").eq("organization_id", data.organizationId)
      .eq("platform", data.platform).eq("external_user_id", data.externalUserId).eq("tag", tag).maybeSingle();
    if (existing) return { ok: true };
    const { error } = await sb.from("contact_tags").insert({
      organization_id: data.organizationId, platform: data.platform, external_user_id: data.externalUserId, tag, source: "manual",
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const removeContactTag = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ organizationId: org, id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await (context as Ctx).supabase.from("contact_tags").delete().eq("id", data.id).eq("organization_id", data.organizationId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const saveSegment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      organizationId: org, name: z.string().trim().min(1).max(60),
      filter: z.object({ tag: z.string().max(40).optional(), platform: platform.optional(), hasEmail: z.boolean().optional(), hasPhone: z.boolean().optional(), search: z.string().max(80).optional() }),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { error } = await (context as Ctx).supabase.from("contact_segments").insert({ organization_id: data.organizationId, name: data.name, filter: data.filter });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteSegment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ organizationId: org, id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await (context as Ctx).supabase.from("contact_segments").delete().eq("id", data.id).eq("organization_id", data.organizationId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
