import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
import { expect, it } from "vitest";

it("repairs missing invoices twice without data loss and enforces workspace reviewer access", async () => {
  const db = new PGlite();
  try {
    await db.exec(`
      CREATE ROLE authenticated; CREATE ROLE service_role; CREATE ROLE anon;
      CREATE TYPE public.org_role AS ENUM ('owner','admin','manager','agent','viewer');
      CREATE TABLE public.organizations (id uuid PRIMARY KEY);
      CREATE FUNCTION public.current_user_has_org_role(org uuid, roles public.org_role[]) RETURNS boolean
        LANGUAGE sql AS $$ SELECT org::text = current_setting('test.org', true)
          AND current_setting('test.role', true) = ANY(roles::text[]) $$;
      CREATE FUNCTION public.current_user_is_org_member(org uuid) RETURNS boolean
        LANGUAGE sql AS $$ SELECT org::text = current_setting('test.client', true) $$;
      INSERT INTO public.organizations VALUES
        ('00000000-0000-0000-0000-000000000001'), ('00000000-0000-0000-0000-000000000002'),
        ('00000000-0000-0000-0000-000000000003');
    `);
    await expect(db.query('SELECT * FROM public.client_invoices')).rejects.toMatchObject({ code: '42P01' });
    const repair = await readFile(new URL('../docs/sql/railway-client-invoices-repair.sql', import.meta.url), 'utf8');
    await db.exec(repair);
    await db.exec(`INSERT INTO public.client_invoices (organization_id, client_organization_id, period_label, amount_inr)
      VALUES ('00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000002','November 2026',500)`);
    await db.exec(repair);
    expect((await db.query('SELECT amount_inr, status FROM public.client_invoices')).rows).toEqual([{ amount_inr: '500.00', status: 'unpaid' }]);
    await db.exec(`SET ROLE authenticated; SET test.org = '00000000-0000-0000-0000-000000000001';
      SET test.client = '00000000-0000-0000-0000-000000000002'; SET test.role = 'manager'`);
    expect((await db.query('SELECT * FROM public.client_invoices')).rows).toHaveLength(1);
    await expect(db.exec(`INSERT INTO public.client_invoices (organization_id, client_organization_id, period_label, amount_inr)
      VALUES ('00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000003','November',500)`)).rejects.toMatchObject({ code: '42501' });
    await db.exec("SET test.role = 'agent'");
    expect((await db.query('SELECT * FROM public.client_invoices')).rows).toHaveLength(0);
    await db.exec("SET test.role = 'owner'; SET test.org = '00000000-0000-0000-0000-000000000003'");
    expect((await db.query('SELECT * FROM public.client_invoices')).rows).toHaveLength(0);
    await db.exec('RESET ROLE; SET ROLE anon');
    await expect(db.query('SELECT * FROM public.client_invoices')).rejects.toMatchObject({ code: '42501' });
  } finally { await db.close(); }
}, 30_000);