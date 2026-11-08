import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
import { expect, it } from 'vitest';

it('repairs five missing tables through the SQL runner and preserves tenant isolation', async () => {
  const db = new PGlite();
  try {
    await db.exec(`CREATE ROLE authenticated; CREATE ROLE anon; CREATE ROLE service_role;
      CREATE SCHEMA auth; CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS $$SELECT '00000000-0000-0000-0000-000000000009'::uuid$$;
      GRANT USAGE ON SCHEMA auth TO authenticated;
      CREATE TYPE public.org_role AS ENUM ('owner','admin','manager','agent','viewer');
      CREATE TABLE public.organizations(id uuid PRIMARY KEY);
      CREATE TABLE public.conversations(id uuid PRIMARY KEY, organization_id uuid);
      GRANT SELECT ON public.conversations TO authenticated;
      CREATE FUNCTION public.current_user_has_org_role(org uuid, roles public.org_role[]) RETURNS boolean LANGUAGE sql AS $$
        SELECT org::text = current_setting('test.org',true) AND current_setting('test.role',true) = ANY(roles::text[])$$;
      CREATE FUNCTION public.current_user_is_org_member(org uuid) RETURNS boolean LANGUAGE sql AS $$SELECT org::text = current_setting('test.org',true)$$;
      CREATE FUNCTION public.admin_exec_sql(q text) RETURNS jsonb LANGUAGE plpgsql AS $$BEGIN EXECUTE q; RETURN '{}'::jsonb; END$$;
      INSERT INTO public.organizations VALUES ('00000000-0000-0000-0000-000000000001'),('00000000-0000-0000-0000-000000000002');
      INSERT INTO public.conversations VALUES ('00000000-0000-0000-0000-000000000003','00000000-0000-0000-0000-000000000001'),('00000000-0000-0000-0000-000000000004','00000000-0000-0000-0000-000000000002');`);
    await expect(db.query('SELECT * FROM team_settings')).rejects.toMatchObject({code:'42P01'});
    await expect(db.query('SELECT admin_exec_sql($1)', ['BEGIN; SELECT 1; COMMIT;'])).rejects.toMatchObject({code:'0A000'});
    const sql = await readFile(new URL('../docs/sql/railway-team-desk-repair.sql', import.meta.url),'utf8');
    await db.query('SELECT admin_exec_sql($1)', [sql]);
    await db.exec("INSERT INTO team_settings(organization_id,require_approval) VALUES ('00000000-0000-0000-0000-000000000001',true)");
    await db.query('SELECT admin_exec_sql($1)', [sql]);
    expect((await db.query('SELECT require_approval FROM team_settings')).rows).toEqual([{require_approval:true}]);
    for (const table of ['conversation_assignments','team_settings','reply_approvals','api_keys','outgoing_webhooks']) {
      expect((await db.query('SELECT to_regclass($1) AS t',[table])).rows[0]).toEqual({t:table});
    }
    await db.exec("SET ROLE authenticated; SET test.org='00000000-0000-0000-0000-000000000001'; SET test.role='agent'");
    await expect(db.exec("INSERT INTO conversation_assignments(conversation_id,organization_id) VALUES ('00000000-0000-0000-0000-000000000004','00000000-0000-0000-0000-000000000001')")).rejects.toMatchObject({code:'42501'});
    await db.exec("INSERT INTO conversation_assignments(conversation_id,organization_id) VALUES ('00000000-0000-0000-0000-000000000003','00000000-0000-0000-0000-000000000001')");
    expect((await db.query('SELECT * FROM conversation_assignments')).rows).toHaveLength(1);
    for (const table of ['api_keys','outgoing_webhooks']) await expect(db.query(`SELECT * FROM ${table}`)).rejects.toMatchObject({code:'42501'});
    await db.exec("SET test.org='00000000-0000-0000-0000-000000000002'");
    expect((await db.query('SELECT * FROM conversation_assignments')).rows).toHaveLength(0);
    await db.exec('RESET ROLE; SET ROLE anon');
    await expect(db.query('SELECT * FROM team_settings')).rejects.toMatchObject({code:'42501'});
  } finally {await db.close();}
},30000);