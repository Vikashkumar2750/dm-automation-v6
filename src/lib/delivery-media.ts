import { supabase } from "@/integrations/supabase/client";
import { recordMediaAsset } from "@/lib/media.functions";

export const DELIVERY_MEDIA_BUCKET = "delivery-page-images";

/** Delivery page cover images must be 16:9 (2% tolerance). */
export function isWidescreen(width: number, height: number) {
  return width > 0 && height > 0 && Math.abs(width / height - 16 / 9) <= (16 / 9) * 0.02;
}

/** Center-crops any photo to 16:9 (max 1920px wide) and returns a JPEG — no upload ever fails on size/ratio. */
async function toWidescreen(file: File): Promise<Blob> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const i = new Image(); i.onload = () => resolve(i); i.onerror = () => reject(new Error("Could not read this image")); i.src = url;
    });
    const w = img.naturalWidth, h = img.naturalHeight;
    let sw = w, sh = Math.round((w * 9) / 16);
    if (sh > h) { sh = h; sw = Math.round((h * 16) / 9); }
    const outW = Math.min(1920, sw), outH = Math.round((outW * 9) / 16);
    const canvas = document.createElement("canvas");
    canvas.width = outW; canvas.height = outH;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Could not process this image");
    ctx.drawImage(img, (w - sw) / 2, (h - sh) / 2, sw, sh, 0, 0, outW, outH);
    return await new Promise<Blob>((resolve, reject) => canvas.toBlob((b) => b ? resolve(b) : reject(new Error("Could not process this image")), "image/webp", 0.82));
  } finally { URL.revokeObjectURL(url); }
}

export async function uploadDeliveryImage(organizationId: string, file: File) {
  if (!file.type.startsWith("image/")) throw new Error("Choose an image file");
  if (file.size > 20 * 1024 * 1024) throw new Error("Image must be 20 MB or smaller");
  const blob = await toWidescreen(file);
  const path = `${organizationId}/${crypto.randomUUID()}.webp`;
  const { error } = await supabase.storage.from(DELIVERY_MEDIA_BUCKET).upload(path, blob, {
    cacheControl: "31536000",
    contentType: blob.type || "image/webp",
    upsert: false,
  });
  if (error) {
    if (/bucket not found/i.test(error.message)) {
      throw new Error("Image storage isn't set up yet on this site. Please redeploy, then try again.");
    }
    if (/row-level security|unauthorized|403/i.test(error.message)) throw new Error("Only workspace owners, admins and managers can upload page images.");
    throw new Error(error.message);
  }
  void recordMediaAsset({ data: {
    organizationId, bucket: DELIVERY_MEDIA_BUCKET, path, kind: "image", originalName: file.name.slice(0, 200),
    originalType: file.type, originalBytes: file.size, optimizedType: blob.type, optimizedBytes: blob.size, source: "delivery_page",
  } }).catch(() => undefined);
  return path;
}

export async function previewDeliveryImage(path: string) {
  if (!path) return "";
  const { data } = await supabase.storage.from(DELIVERY_MEDIA_BUCKET).createSignedUrl(path, 3600);
  return data?.signedUrl ?? "";
}