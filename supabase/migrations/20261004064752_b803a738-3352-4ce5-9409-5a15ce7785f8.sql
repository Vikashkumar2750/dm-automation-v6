CREATE TABLE public.trust_settings (
  organization_id uuid PRIMARY KEY REFERENCES public.organizations(id) ON DELETE CASCADE,
  predictive_guard boolean NOT NULL DEFAULT true,
  last_guard_action_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.trust_settings TO authenticated;
GRANT ALL ON public.trust_settings TO service_role;
ALTER TABLE public.trust_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Members read trust settings" ON public.trust_settings FOR SELECT TO authenticated
  USING (public.current_user_has_org_role(organization_id, ARRAY['owner','admin','manager','agent','viewer']::public.org_role[]));
CREATE POLICY "Managers write trust settings" ON public.trust_settings FOR INSERT TO authenticated
  WITH CHECK (public.current_user_has_org_role(organization_id, ARRAY['owner','admin','manager']::public.org_role[]));
CREATE POLICY "Managers update trust settings" ON public.trust_settings FOR UPDATE TO authenticated
  USING (public.current_user_has_org_role(organization_id, ARRAY['owner','admin','manager']::public.org_role[]));
CREATE TRIGGER org_audit_trg AFTER INSERT OR UPDATE OR DELETE ON public.trust_settings FOR EACH ROW EXECUTE FUNCTION public.log_org_audit();