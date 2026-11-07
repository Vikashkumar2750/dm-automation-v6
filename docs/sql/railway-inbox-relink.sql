-- AutoDM live backend: re-link Inbox chats to their connected accounts.
-- Safe to run more than once. Only fills missing/broken account links inside the same workspace.
-- Take a backup first. Do not reset the database.

-- STEP 1: create/refresh the repair function.
CREATE OR REPLACE FUNCTION public.relink_conversation_accounts(_org uuid DEFAULT NULL::uuid)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  n1 integer := 0;
  n2 integer := 0;
BEGIN
  WITH we AS (
    SELECT organization_id, external_account_id, received_at,
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
    ORDER BY we.organization_id, s.platform, we.sender, we.received_at DESC
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
$function$;

-- Only the server may run it.
REVOKE ALL ON FUNCTION public.relink_conversation_accounts(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.relink_conversation_accounts(uuid) TO service_role;

-- STEP 2: run the repair (returns how many chats were fixed).
SELECT public.relink_conversation_accounts() AS chats_relinked;

-- STEP 3: check — chats still without a valid account (ideally 0).
SELECT count(*) AS chats_still_unlinked
FROM public.conversations c
WHERE c.social_account_id IS NULL
   OR NOT EXISTS (SELECT 1 FROM public.social_accounts s
                  WHERE s.id = c.social_account_id AND s.organization_id = c.organization_id);
