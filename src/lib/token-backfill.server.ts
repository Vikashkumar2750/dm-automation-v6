/** Seals legacy plaintext tokens/secrets in batches. No-op until TOKEN_ENCRYPTION_KEY is set. */
import { isSealed, sealSecret, tokenKey } from "@/lib/token-crypto.server";

type AdminClient = import("@supabase/supabase-js").SupabaseClient;

export async function backfillEncryptedTokens(admin: AdminClient, batch = 100) {
  const key = tokenKey();
  if (!key) return { enabled: false, sealed: 0 };
  let sealed = 0;
  const { data: toks, error: tokenReadError } = await admin.from("social_account_tokens")
    .select("social_account_id, access_token, refresh_token").or("access_token.not.like.enc:v1:%,refresh_token.not.like.enc:v1:%").limit(batch);
  if (tokenReadError) throw new Error("Encryption source unavailable");
  for (const t of toks ?? []) {
    const patch: Record<string, string> = {};
    if (t.access_token && !isSealed(t.access_token)) patch["access_token"] = await sealSecret(t.access_token, key);
    if (t.refresh_token && !isSealed(t.refresh_token)) patch["refresh_token"] = await sealSecret(t.refresh_token, key);
    if (!Object.keys(patch).length) continue;
    // Compare-and-set: only replace the exact plaintext we read (a reconnect in between wins).
    let update = admin.from("social_account_tokens").update(patch).eq("social_account_id", t.social_account_id);
    update = t.access_token === null ? update.is("access_token", null) : update.eq("access_token", t.access_token);
    update = t.refresh_token === null ? update.is("refresh_token", null) : update.eq("refresh_token", t.refresh_token);
    const { data: changed, error } = await update.select("social_account_id");
    if (error) throw new Error("Encryption update unavailable");
    sealed += changed?.length ?? 0;
  }
  const { data: creds, error: paymentReadError } = await admin.from("payment_credentials")
    .select("organization_id, razorpay_key_secret, webhook_secret").or("razorpay_key_secret.not.like.enc:v1:%,webhook_secret.not.like.enc:v1:%").limit(batch);
  if (paymentReadError) throw new Error("Encryption source unavailable");
  for (const c of creds ?? []) {
    const patch: Record<string, string> = {};
    if (c.razorpay_key_secret && !isSealed(c.razorpay_key_secret)) patch["razorpay_key_secret"] = await sealSecret(c.razorpay_key_secret, key);
    if (c.webhook_secret && !isSealed(c.webhook_secret)) patch["webhook_secret"] = await sealSecret(c.webhook_secret, key);
    if (!Object.keys(patch).length) continue;
    let update = admin.from("payment_credentials").update(patch).eq("organization_id", c.organization_id);
    update = c.razorpay_key_secret === null ? update.is("razorpay_key_secret", null) : update.eq("razorpay_key_secret", c.razorpay_key_secret);
    update = c.webhook_secret === null ? update.is("webhook_secret", null) : update.eq("webhook_secret", c.webhook_secret);
    const { data: changed, error } = await update.select("organization_id");
    if (error) throw new Error("Encryption update unavailable");
    sealed += changed?.length ?? 0;
  }
  return { enabled: true, sealed };
}
