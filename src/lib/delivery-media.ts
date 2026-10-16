import { supabase } from "@/integrations/supabase/client";

export const DELIVERY_MEDIA_BUCKET = "delivery-page-images";

/** Delivery page cover images must be 16:9 (2% tolerance). */
export function isWidescreen(width: number, height: number) {
  return width > 0 && height > 0 && Math.abs(width / height - 16 / 9) <= (16 / 9) * 0.02;
}

function imageSize(file: File): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => { URL.revokeObjectURL(url); resolve({ width: img.naturalWidth, height: img.naturalHeight }); };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("Could not read this image")); };
    img.src = url;
  });
}

function extensionOf(name: string) {
  const dot = name.lastIndexOf(".");
  return dot > -1 ? name.slice(dot + 1).toLowerCase() : "jpg";
}

export async function uploadDeliveryImage(organizationId: string, file: File) {
  if (!file.type.startsWith("image/")) throw new Error("Choose an image file");
  if (file.size > 8 * 1024 * 1024) throw new Error("Image must be 8 MB or smaller");
  const { width, height } = await imageSize(file);
  if (!isWidescreen(width, height)) throw new Error(`Please upload a 16:9 image (e.g. 1920×1080 or 1280×720). This one is ${width}×${height}.`);
  const path = `${organizationId}/${crypto.randomUUID()}.${extensionOf(file.name)}`;
  const { error } = await supabase.storage.from(DELIVERY_MEDIA_BUCKET).upload(path, file, {
    cacheControl: "86400",
    contentType: file.type,
    upsert: false,
  });
  if (error) {
    if (/bucket not found/i.test(error.message)) {
      throw new Error("Image storage isn't set up yet on this site. Please redeploy, then try again.");
    }
    throw new Error(error.message);
  }
  return path;
}

export async function previewDeliveryImage(path: string) {
  if (!path) return "";
  const { data } = await supabase.storage.from(DELIVERY_MEDIA_BUCKET).createSignedUrl(path, 3600);
  return data?.signedUrl ?? "";
}