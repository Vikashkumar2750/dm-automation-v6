CREATE TABLE public.db_backups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  kind text NOT NULL DEFAULT 'manual',
  status text NOT NULL DEFAULT 'ok',
  created_by uuid,
  table_count int NOT NULL DEFAULT 0,
  row_count int NOT NULL DEFAULT 0,
  bytes int NOT NULL DEFAULT 0,
  drive_file_id text,
  error text,
  backup_sql text
);
GRANT ALL ON public.db_backups TO service_role;
ALTER TABLE public.db_backups ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.admin_table_dependencies()
RETURNS TABLE(table_name text, depends_on text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT t.relname::text, r.relname::text
  FROM pg_class t
  JOIN pg_namespace n ON n.oid = t.relnamespace AND n.nspname = 'public'
  LEFT JOIN pg_constraint c ON c.conrelid = t.oid AND c.contype = 'f'
  LEFT JOIN pg_class r ON r.oid = c.confrelid AND r.relnamespace = n.oid
  WHERE t.relkind = 'r'
$$;
REVOKE ALL ON FUNCTION public.admin_table_dependencies() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_table_dependencies() TO service_role;

CREATE OR REPLACE FUNCTION public.admin_exec_sql(q text)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE res jsonb; n bigint;
BEGIN
  IF q ~* '^\s*(select|with|table|values|explain)\s' THEN
    EXECUTE format('SELECT coalesce(jsonb_agg(x), ''[]''::jsonb) FROM (SELECT * FROM (%s) s LIMIT 500) x', regexp_replace(q, ';\s*$', '')) INTO res;
    RETURN jsonb_build_object('rows', res);
  END IF;
  EXECUTE q;
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN jsonb_build_object('affected', n);
END $$;
REVOKE ALL ON FUNCTION public.admin_exec_sql(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_exec_sql(text) TO service_role;