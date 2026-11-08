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
  } finally { await db.close(); }
}, 30000);