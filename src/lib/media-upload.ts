// Browser-side helpers for uploading post media to the private "post-media" bucket.
// Stored references look like `storage:<path>`; the server swaps them for a
// short-lived signed link when it hands the file to Instagram/Facebook.

import { supabase } from "@/integrations/supabase/client";
import { recordMediaAsset } from "@/lib/media.functions";

export const MEDIA_BUCKET = "post-media";

export const STORAGE_PREFIX = "storage:";

export function isStorageRef(ref: string) {
  return ref.startsWith(STORAGE_PREFIX);
}

function extensionOf(name: string) {
  const dot = name.lastIndexOf(".");
  return dot > -1 ? name.slice(dot + 1).toLowerCase() : "bin";
}

export async function uploadPostMedia(organizationId: string, file: File) {
  const path = `${organizationId}/${crypto.randomUUID()}.${extensionOf(file.name)}`;
  const { error } = await supabase.storage.from(MEDIA_BUCKET).upload(path, file, {
    cacheControl: "3600",
    upsert: false,
    contentType: file.type || "application/octet-stream",
  });
  if (error) throw new Error(error.message);
  // Kept in the original format: Instagram/Facebook publishing only accepts JPEG/PNG and MP4.
  const kind = file.type.startsWith("video/") ? "video" : file.type.startsWith("audio/") ? "audio" : file.type.startsWith("image/") ? "image" : "file";
  void recordMediaAsset({ data: {
    organizationId, bucket: MEDIA_BUCKET, path, kind, originalName: file.name.slice(0, 200), originalType: file.type,
    originalBytes: file.size, optimizedType: file.type, optimizedBytes: file.size, source: "post",
  } }).catch(() => undefined);
  return `${STORAGE_PREFIX}${path}`;
}

/** Turn a stored reference into something an <img>/<video> tag can show. */
export async function previewUrl(ref: string) {
  if (!isStorageRef(ref)) return ref;
  const path = ref.slice(STORAGE_PREFIX.length);
  const { data } = await supabase.storage.from(MEDIA_BUCKET).createSignedUrl(path, 3600);
  return data?.signedUrl ?? "";
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Could not read the photo"));
    img.src = url;
  });
}

/** Natural width/height of a stored or linked photo. */
export async function imageSize(ref: string) {
  const img = await loadImage(await previewUrl(ref));
  return { width: img.naturalWidth, height: img.naturalHeight };
}

/**
 * Place the whole photo, unstretched, on a canvas of the target ratio. The
 * empty space is filled with a blurred, enlarged copy of the same photo.
 * Uploads the result and returns its new reference.
 */
export async function fitImageToRatio(organizationId: string, ref: string, target: number) {
  const { paddedCanvas } = await import("@/lib/aspect-ratio");
  const img = await loadImage(await previewUrl(ref));
  const w = img.naturalWidth;
  const h = img.naturalHeight;
  const size = paddedCanvas(w, h, target);
  const canvas = document.createElement("canvas");
  canvas.width = size.width;
  canvas.height = size.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Could not prepare the photo");
  // Background: cover-scaled blurred copy.
  const cover = Math.max(size.width / w, size.height / h);
  ctx.filter = "blur(40px) brightness(0.85)";
  ctx.drawImage(img, (size.width - w * cover) / 2, (size.height - h * cover) / 2, w * cover, h * cover);
  ctx.filter = "none";
  // Foreground: original at 1:1 scale, centred.
  ctx.drawImage(img, (size.width - w) / 2, (size.height - h) / 2, w, h);
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.92));
  if (!blob) throw new Error("Could not prepare the photo");
  const file = new File([blob], "fitted.jpg", { type: "image/jpeg" });
  return uploadPostMedia(organizationId, file);
}
