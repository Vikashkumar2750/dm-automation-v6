/** Seals legacy plaintext tokens/secrets in batches. No-op until TOKEN_ENCRYPTION_KEY is set. */
import { isSealed, sealSecret, tokenKey } from "@/lib/token-crypto.server";

type AdminClient = import("@supabase/supabase-js").SupabaseClient;

export async function backfillEncryptedTokens(admin: AdminClient, batch = 100) {
  const key = tokenKey();
  if (!key) return { enabled: false, sealed: 0 };
  let sealed = 0;
  const { data: toks } = await admin.from("social_account_tokens")
    .select("social_account_id, access_token, refresh_token").not("access_token", "like", "enc:v1:%").limit(batch);
  for (const t of toks ?? []) {
    const patch: Record<string, string> = {};
    if (t.access_token && !isSealed(t.access_token)) patch.access_token = await sealSecret(t.access_token, key);
    if (t.refresh_token && !isSealed(t.refresh_token)) patch.refresh_token = await sealSecret(t.refresh_token, key);
    if (!Object.keys(patch).length) continue;
    // Compare-and-set: only replace the exact plaintext we read (a reconnect in between wins).
    const { error } = await admin.from("social_account_tokens").update(patch)
      .eq("social_account_id", t.social_account_id).eq("access_token", t.access_token);
    if (!error) sealed++;
  }
  const { data: creds } = await admin.from("payment_credentials")
    .select("organization_id, razorpay_key_secret, webhook_secret").not("razorpay_key_secret", "like", "enc:v1:%").limit(batch);
  for (const c of creds ?? []) {
    const patch: Record<string, string> = {};
    if (c.razorpay_key_secret && !isSealed(c.razorpay_key_secret)) patch.razorpay_key_secret = await sealSecret(c.razorpay_key_secret, key);
    if (c.webhook_secret && !isSealed(c.webhook_secret)) patch.webhook_secret = await sealSecret(c.webhook_secret, key);
    if (!Object.keys(patch).length) continue;
    const { error } = await admin.from("payment_credentials").update(patch)
      .eq("organization_id", c.organization_id).eq("razorpay_key_secret", c.razorpay_key_secret);
    if (!error) sealed++;
  }
  return { enabled: true, sealed };
}
