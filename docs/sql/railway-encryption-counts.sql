-- Read-only: run on the existing live application's database.
-- Returns counts only, never credentials. A 200 heartbeat alone does not prove
-- encryption enabled. Preserve the existing key whenever sealed values exist.
SELECT 'social_account_tokens.access_token' AS column_name,
       count(*) FILTER (WHERE access_token LIKE 'enc:v1:%') AS sealed,
       count(*) FILTER (WHERE access_token IS NOT NULL AND access_token NOT LIKE 'enc:v1:%') AS plaintext,
       count(*) FILTER (WHERE access_token IS NULL) AS nulls
FROM public.social_account_tokens
UNION ALL
SELECT 'social_account_tokens.refresh_token',
       count(*) FILTER (WHERE refresh_token LIKE 'enc:v1:%'),
       count(*) FILTER (WHERE refresh_token IS NOT NULL AND refresh_token NOT LIKE 'enc:v1:%'),
       count(*) FILTER (WHERE refresh_token IS NULL)
FROM public.social_account_tokens
UNION ALL
SELECT 'payment_credentials.razorpay_key_secret',
       count(*) FILTER (WHERE razorpay_key_secret LIKE 'enc:v1:%'),
       count(*) FILTER (WHERE razorpay_key_secret IS NOT NULL AND razorpay_key_secret NOT LIKE 'enc:v1:%'),
       count(*) FILTER (WHERE razorpay_key_secret IS NULL)
FROM public.payment_credentials
UNION ALL
SELECT 'payment_credentials.webhook_secret',
       count(*) FILTER (WHERE webhook_secret LIKE 'enc:v1:%'),
       count(*) FILTER (WHERE webhook_secret IS NOT NULL AND webhook_secret NOT LIKE 'enc:v1:%'),
       count(*) FILTER (WHERE webhook_secret IS NULL)
FROM public.payment_credentials;