CREATE OR REPLACE FUNCTION public.relink_conversation_accounts(_org uuid DEFAULT NULL)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  n1 integer := 0;
  n2 integer := 0;
BEGIN
  -- 1) Use stored Meta webhook evidence: which connected account received this person's events.
  WITH we AS (
    SELECT organization_id, external_account_id, created_at,
      COALESCE(payload->'sender'->>'id', payload->'value'->'from'->>'id', payload->'from'->>'id') AS sender
    FROM public.webhook_events
    WHERE provider = 'meta' AND organization_id IS NOT NULL AND external_account_id IS NOT NULL
      AND (_org IS NULL OR organization_id = _org)
  ), ev AS (
    SELECT DISTINCT ON (we.organization_id, s.platform, we.sender)
      we.organization_id, s.platform::text AS platform, we.sender, s.id AS account_id
    FROM we
    JOIN public.social_accounts s
      ON s.organization_id = we.organization_id
     AND (s.external_id = we.external_account_id OR s.metadata->>'page_id' = we.external_account_id)
    WHERE we.sender IS NOT NULL
    ORDER BY we.organization_id, s.platform, we.sender, we.created_at DESC
  )
  UPDATE public.conversations c
     SET social_account_id = ev.account_id
    FROM ev
   WHERE ev.organization_id = c.organization_id
     AND ev.platform = c.platform::text
     AND ev.sender = c.external_user_id
     AND (_org IS NULL OR c.organization_id = _org)
     AND (c.social_account_id IS NULL OR NOT EXISTS (
       SELECT 1 FROM public.social_accounts x
        WHERE x.id = c.social_account_id AND x.organization_id = c.organization_id));
  GET DIAGNOSTICS n1 = ROW_COUNT;

  -- 2) Only one connected account on that platform: the chat can only belong to it.
  UPDATE public.conversations c
     SET social_account_id = s.id
    FROM public.social_accounts s
   WHERE c.social_account_id IS NULL
     AND (_org IS NULL OR c.organization_id = _org)
     AND s.organization_id = c.organization_id
     AND s.platform::text = c.platform::text
     AND (SELECT count(*) FROM public.social_accounts s2
           WHERE s2.organization_id = c.organization_id AND s2.platform::text = c.platform::text) = 1;
  GET DIAGNOSTICS n2 = ROW_COUNT;

  RETURN n1 + n2;
END;
$$;

REVOKE ALL ON FUNCTION public.relink_conversation_accounts(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.relink_conversation_accounts(uuid) TO service_role;

DO $$
BEGIN
  PERFORM public.relink_conversation_accounts(NULL);
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'relink_conversation_accounts backfill skipped: %', SQLERRM;
END;
$$;