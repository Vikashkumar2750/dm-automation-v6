import { PRODUCT_FILES_BUCKET, PRODUCT_FILE_PREFIX, productFileName } from "./product-files";

/** Turns a saved content target into a URL the buyer can open: https links pass through, uploaded files get a 10-minute download link. */
export async function resolveContentUrl(admin: any, target: string | null | undefined, orgId: string): Promise<string | null> {
  if (!target) return null;
  if (/^https:\/\//i.test(target)) return target;
  if (!target.startsWith(PRODUCT_FILE_PREFIX)) return null;
  const path = target.slice(PRODUCT_FILE_PREFIX.length);
  if (!path.startsWith(`${orgId}/`)) return null;
  const { data } = await admin.storage.from(PRODUCT_FILES_BUCKET).createSignedUrl(path, 600, { download: productFileName(target) });
  return data?.signedUrl ?? null;
}
