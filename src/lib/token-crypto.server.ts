/**
 * AES-256-GCM helper for secrets at rest. Values are stored as
 * `enc:v1:<iv-b64>:<cipher-b64>`. Plain (legacy) values pass through openSecret
 * unchanged, so rows can be migrated gradually without breaking delivery.
 */
const PREFIX = "enc:v1:";

function b64(bytes: Uint8Array) {
  return Buffer.from(bytes).toString("base64");
}

async function importKey(rawB64: string) {
  const raw = new Uint8Array(Buffer.from(rawB64, "base64"));
  if (raw.length !== 32) throw new Error("encryption_key_must_be_32_bytes");
  return crypto.subtle.importKey("raw", raw, "AES-GCM", false, ["encrypt", "decrypt"]);
}

export function isSealed(value: string | null | undefined) {
  return typeof value === "string" && value.startsWith(PREFIX);
}

export async function sealSecret(plain: string, keyB64: string) {
  const key = await importKey(keyB64);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, new TextEncoder().encode(plain));
  return `${PREFIX}${b64(iv)}:${b64(new Uint8Array(ct))}`;
}

export async function openSecret(value: string | null | undefined, keyB64: string | undefined) {
  if (!value || !isSealed(value)) return value ?? null;
  if (!keyB64) throw new Error("encryption_key_missing");
  const [ivB64, ctB64] = value.slice(PREFIX.length).split(":");
  const key = await importKey(keyB64);
  const pt = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: new Uint8Array(Buffer.from(ivB64 ?? "", "base64")) },
    key,
    new Uint8Array(Buffer.from(ctB64 ?? "", "base64")),
  );
  return new TextDecoder().decode(pt);
}
