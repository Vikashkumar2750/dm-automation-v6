import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
import { expect, it } from 'vitest';
import { executeAuditedSql } from '../src/lib/db-admin-sql.server';

it('returns commented diagnostic rows through the deployed SQL function without executing twice', async () => {
  const db = new PGlite();
  try {
    await db.exec('CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;');
    await db.exec(await readFile(new URL('../drizzle/migrations/0001_db_backups_admin_tools.sql', import.meta.url), 'utf8'));
    const admin = {
      from: () => ({ insert: async () => ({ error: null }) }),
      rpc: async (_name: string, params: { q: string }) => {
        const result = await db.query<{ result: unknown }>('SELECT admin_exec_sql($1) AS result', [params.q]);
        return { data: result.rows[0]?.result, error: null };
      },
    };
    const sql = '-- Read-only metadata.\n/* outer /* nested */ comment */\nWITH diagnostic AS (SELECT 11 AS tables) SELECT * FROM diagnostic;';
    expect(await executeAuditedSql(admin, 'actor', sql, 'editor')).toEqual({ ok: true, result: { rows: [{ tables: 11 }] } });
    expect(await executeAuditedSql(admin, 'actor', '/* metadata */ SELECT 23 AS checks;', 'editor')).toEqual({ ok: true, result: { rows: [{ checks: 23 }] } });
    expect(await executeAuditedSql(admin, 'actor', "-- metadata\nSELECT '-- keep /* this */' AS value;", 'editor')).toEqual({ ok: true, result: { rows: [{ value: '-- keep /* this */' }] } });
    await db.exec('CREATE TABLE counter(value integer); INSERT INTO counter VALUES (0);');
    expect(await executeAuditedSql(admin, 'actor', '-- one change\nUPDATE counter SET value = value + 1;', 'editor')).toEqual({ ok: true, result: { affected: 1 } });
    expect((await db.query('SELECT value FROM counter')).rows).toEqual([{ value: 1 }]);
    expect((await executeAuditedSql(admin, 'actor', '-- bounded\nSELECT n FROM generate_series(1, 501) AS n;', 'editor')).result?.rows).toHaveLength(500);
    await db.exec('SET ROLE authenticated');
    await expect(db.query('SELECT admin_exec_sql($1)', ['SELECT 1'])).rejects.toMatchObject({ code: '42501' });
  } finally { await db.close(); }
}, 30000);