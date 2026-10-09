ALTER TABLE public.automation_runs ADD COLUMN IF NOT EXISTS run_key text;
CREATE INDEX IF NOT EXISTS automation_runs_org_run_key_idx ON public.automation_runs (organization_id, run_key);
COMMENT ON COLUMN public.automation_runs.run_key IS 'Groups every step of one automation run; plan usage counts distinct runs.';

CREATE OR REPLACE FUNCTION public.count_org_runs(_org_id uuid, _since timestamptz)
RETURNS integer
LANGUAGE sql
STABLE
SET search_path TO 'public'
AS $$
  select count(distinct coalesce(run_key, id::text))::int
  from public.automation_runs
  where organization_id = _org_id and status = 'sent' and created_at >= _since
$$;
REVOKE ALL ON FUNCTION public.count_org_runs(uuid, timestamptz) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.count_org_runs(uuid, timestamptz) TO authenticated, service_role;