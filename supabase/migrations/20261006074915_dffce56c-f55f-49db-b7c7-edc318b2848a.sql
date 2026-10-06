CREATE OR REPLACE FUNCTION public.log_org_audit()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  r jsonb; o jsonb; changed text[] := '{}';
  ignored text[] := ARRAY['updated_at','last_synced_at','last_used_at','cursor_at','last_status','last_error','last_sent_at','metadata','capabilities'];
BEGIN
  IF TG_OP = 'DELETE' THEN r := to_jsonb(OLD); ELSE r := to_jsonb(NEW); END IF;
  IF TG_OP = 'UPDATE' THEN
    o := to_jsonb(OLD);
    SELECT coalesce(array_agg(k ORDER BY k), '{}') INTO changed
      FROM jsonb_object_keys(r) k
      WHERE NOT (k = ANY(ignored)) AND (r -> k) IS DISTINCT FROM (o -> k);
    IF array_length(changed, 1) IS NULL THEN RETURN NULL; END IF;
  END IF;
  IF (r ->> 'organization_id') IS NULL THEN RETURN NULL; END IF;
  -- Workspace itself is being deleted: nothing to audit into.
  IF NOT EXISTS (SELECT 1 FROM public.organizations WHERE id = (r ->> 'organization_id')::uuid) THEN
    RETURN NULL;
  END IF;
  INSERT INTO public.org_audit_log(organization_id, actor_user_id, action, entity, entity_id, changed_fields)
  VALUES ((r ->> 'organization_id')::uuid, auth.uid(), lower(TG_OP), TG_TABLE_NAME, coalesce(r ->> 'id', r ->> 'organization_id'), changed);
  RETURN NULL;
END $function$;