DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['ai_usage_daily','api_keys','oauth_states','outgoing_webhooks','payment_credentials','scheduler_heartbeats','social_account_tokens'] LOOP
    EXECUTE format('DROP POLICY IF EXISTS "Server only - no app access" ON public.%I', t);
    EXECUTE format('CREATE POLICY "Server only - no app access" ON public.%I AS RESTRICTIVE FOR ALL TO anon, authenticated USING (false) WITH CHECK (false)', t);
  END LOOP;
END $$;