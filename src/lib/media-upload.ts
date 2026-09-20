// Browser-side helpers for uploading post media to the private "post-media" bucket.
// Stored references look like `storage:<path>`; the server swaps them for a
// short-lived signed link when it hands the file to Instagram/Facebook.

import { supabase } from "@/integrations/supabase/client";

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
  return `${STORAGE_PREFIX}${path}`;
}

/** Turn a stored reference into something an <img>/<video> tag can show. */
export async function previewUrl(ref: string) {
  if (!isStorageRef(ref)) return ref;
  const path = ref.slice(STORAGE_PREFIX.length);
  const { data } = await supabase.storage.from(MEDIA_BUCKET).createSignedUrl(path, 3600);
  return data?.signedUrl ?? "";
}
