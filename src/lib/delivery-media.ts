import { supabase } from "@/integrations/supabase/client";

export const DELIVERY_MEDIA_BUCKET = "delivery-page-images";

function extensionOf(name: string) {
  const dot = name.lastIndexOf(".");
  return dot > -1 ? name.slice(dot + 1).toLowerCase() : "jpg";
}

export async function uploadDeliveryImage(organizationId: string, file: File) {
  if (!file.type.startsWith("image/")) throw new Error("Choose an image file");
  if (file.size > 8 * 1024 * 1024) throw new Error("Image must be 8 MB or smaller");
  const path = `${organizationId}/${crypto.randomUUID()}.${extensionOf(file.name)}`;
  const { error } = await supabase.storage.from(DELIVERY_MEDIA_BUCKET).upload(path, file, {
    cacheControl: "86400",
    contentType: file.type,
    upsert: false,
  });
  if (error) throw new Error(error.message);
  return path;
}

export async function previewDeliveryImage(path: string) {
  if (!path) return "";
  const { data } = await supabase.storage.from(DELIVERY_MEDIA_BUCKET).createSignedUrl(path, 3600);
  return data?.signedUrl ?? "";
}