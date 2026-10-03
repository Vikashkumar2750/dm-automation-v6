REVOKE EXECUTE ON FUNCTION public.consume_ai_request(uuid, integer) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.increment_unread(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.consume_ai_request(uuid, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.increment_unread(uuid) TO service_role;