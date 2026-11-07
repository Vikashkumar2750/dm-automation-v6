-- AutoDM: diagnose remaining Inbox account links. READ ONLY.
-- Run on the same live database where you ran the relink repair.
-- No chat content, customer identity, tokens or payment keys are returned.
WITH unlinked AS (
  SELECT c.id, c.organization_id, c.platform::text AS platform
  FROM public.conversations c
  WHERE c.social_account_id IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.social_accounts s
    WHERE s.id = c.social_account_id
      AND s.organization_id = c.organization_id
      AND s.platform::text = c.platform::text
  )
), candidates AS (
  SELECT u.id AS conversation_id, u.organization_id, u.platform,
    count(s.id)::int AS matching_accounts,
    count(s.id) FILTER (WHERE s.status::text = 'connected')::int AS connected_accounts
  FROM unlinked u
  LEFT JOIN public.social_accounts s
    ON s.organization_id = u.organization_id AND s.platform::text = u.platform
  GROUP BY u.id, u.organization_id, u.platform
)
SELECT conversation_id, organization_id, platform, matching_accounts, connected_accounts,
  CASE WHEN matching_accounts = 0 THEN 'No matching account remains; reconnect the original account.'
    WHEN matching_accounts = 1 THEN 'One candidate; confirm original account before a scoped repair.'
    ELSE 'Multiple candidates; original account evidence required. Do not guess.'
  END AS next_action
FROM candidates
ORDER BY platform, conversation_id;
