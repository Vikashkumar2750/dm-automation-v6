import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
import { expect, it } from 'vitest';

it('repairs missing heartbeats through the SQL runner without exposing or inventing records', async () => {
  const db = new PGlite();
  try {
    await db.exec(`CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS;
      CREATE FUNCTION public.admin_exec_sql(q text) RETURNS jsonb LANGUAGE plpgsql AS $$BEGIN EXECUTE q; RETURN '{}'::jsonb; END$$;`);
    await expect(db.query('SELECT * FROM public.scheduler_heartbeats')).rejects.toMatchObject({ code: '42P01' });
    const sql = await readFile(new URL('../docs/sql/railway-scheduler-heartbeats-repair.sql', import.meta.url), 'utf8');
    await db.query('SELECT admin_exec_sql($1)', [sql]);
    expect((await db.query('SELECT * FROM scheduler_heartbeats')).rows).toHaveLength(0);
    await db.exec(`SET ROLE service_role;
      INSERT INTO scheduler_heartbeats(job,last_status,consecutive_failures) VALUES ('flows',503,2);
      RESET ROLE;`);
    await db.query('SELECT admin_exec_sql($1)', [sql]);
    expect((await db.query('SELECT job,last_status,consecutive_failures FROM scheduler_heartbeats')).rows)
      .toEqual([{ job: 'flows', last_status: 503, consecutive_failures: 2 }]);
    for (const role of ['anon', 'authenticated']) {
      await db.exec(`SET ROLE ${role}`);
      await expect(db.query('SELECT * FROM scheduler_heartbeats')).rejects.toMatchObject({ code: '42501' });
      await db.exec('RESET ROLE');
    }
    const diagnostic = await readFile(new URL('../docs/sql/railway-revenue-prerequisites.sql', import.meta.url), 'utf8');
    const result = await db.query<{ table_name: string; table_exists: boolean; missing_columns: string[] }>(diagnostic);
    expect(result.rows).toHaveLength(11);
    expect(result.rows.find(row => row.table_name === 'whatsapp_otp_settings')).toMatchObject({ table_exists: false, missing_columns: ['organization_id', 'phone_number_id', 'template_name'] });
  } finally { await db.close(); }
}, 30000);