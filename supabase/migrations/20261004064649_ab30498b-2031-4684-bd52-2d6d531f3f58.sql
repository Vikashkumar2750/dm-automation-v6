CREATE TABLE public.org_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  actor_user_id uuid,
  action text NOT NULL,
  entity text NOT NULL,
  entity_id text,
  changed_fields text[] NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.org_audit_log TO authenticated;
GRANT ALL ON public.org_audit_log TO service_role;
ALTER TABLE public.org_audit_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Managers read workspace audit" ON public.org_audit_log FOR SELECT TO authenticated
  USING (public.current_user_has_org_role(organization_id, ARRAY['owner','admin','manager']::public.org_role[]));
CREATE INDEX org_audit_log_org_idx ON public.org_audit_log(organization_id, created_at DESC);

CREATE OR REPLACE FUNCTION public.log_org_audit()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
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
  INSERT INTO public.org_audit_log(organization_id, actor_user_id, action, entity, entity_id, changed_fields)
  VALUES ((r ->> 'organization_id')::uuid, auth.uid(), lower(TG_OP), TG_TABLE_NAME, coalesce(r ->> 'id', r ->> 'organization_id'), changed);
  RETURN NULL;
END $$;
REVOKE EXECUTE ON FUNCTION public.log_org_audit() FROM PUBLIC, anon, authenticated;

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['automation_rules','automation_settings','team_settings','organization_members','organization_invitations','social_accounts','api_keys','outgoing_webhooks','reply_approvals','client_invoices','broadcasts','revenue_products','revenue_settings','payment_credentials','coupon_campaigns','delivery_pages','nudge_settings','crm_sync_settings','conversation_assignments']
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS org_audit_trg ON public.%I', t);
    EXECUTE format('CREATE TRIGGER org_audit_trg AFTER INSERT OR UPDATE OR DELETE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.log_org_audit()', t);
  END LOOP;
END $$;