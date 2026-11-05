import { supabase } from "@/integrations/supabase/client";

export const PRODUCT_FILES_BUCKET = "product-files";
export const PRODUCT_FILE_PREFIX = "file:";
export const PRODUCT_FILE_MAX_MB = 50;
export const PRODUCT_FILE_ACCEPT = ".pdf,.zip,.epub,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.csv,.txt,.mp3,.m4a,.wav,.png,.jpg,.jpeg,.webp";

/** A stored file reference looks like "file:<orgId>/<uuid>/<name>". */
export function isProductFile(v: string | null | undefined): v is string {
  return !!v && v.startsWith(PRODUCT_FILE_PREFIX);
}
export function productFileName(v: string) {
  return decodeURIComponent(v.split("/").pop() ?? "file");
}
/** Server-side check: the reference must sit inside the saving workspace's folder. */
export function validProductFileRef(v: string, orgId: string) {
  return new RegExp(`^file:${orgId}/[0-9a-f-]{36}/[^/]{1,150}$`, "i").test(v);
}

export async function uploadProductFile(organizationId: string, file: File) {
  if (file.size > PRODUCT_FILE_MAX_MB * 1024 * 1024) throw new Error(`File must be ${PRODUCT_FILE_MAX_MB} MB or smaller`);
  const ext = "." + (file.name.split(".").pop() ?? "").toLowerCase();
  if (!PRODUCT_FILE_ACCEPT.split(",").includes(ext)) throw new Error("This file type isn't supported");
  const safe = encodeURIComponent(file.name.replace(/[^\w.\- ]+/g, "_").slice(-120));
  const path = `${organizationId}/${crypto.randomUUID()}/${safe}`;
  const { error } = await supabase.storage.from(PRODUCT_FILES_BUCKET).upload(path, file, { contentType: file.type || "application/octet-stream", upsert: false });
  if (error) {
    if (/row-level security|unauthorized|403/i.test(error.message)) throw new Error("Only workspace owners, admins and managers can upload files.");
    throw new Error(error.message);
  }
  return PRODUCT_FILE_PREFIX + path;
}
