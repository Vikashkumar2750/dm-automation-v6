/**
 * Migration runner for self-hosted deploys (Railway, Fly, a VPS, anywhere).
 *
 * Applies every .sql file in drizzle/migrations in filename order exactly once,
 * tracked in the table public._app_migrations.
 *
 * Usage:  DATABASE_URL=postgres://... bun run scripts/migrate.mjs
 * Skips silently (exit 0) when DATABASE_URL is not set, so the app can still boot
 * against a database that is managed elsewhere.
 */
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import postgres from "postgres";

const MIGRATIONS_DIR = path.join(process.cwd(), "drizzle", "migrations");
const rawUrl = (process.env.DATABASE_URL ?? process.env.LOVABLE_DB_MIGRATION_URL ?? "").trim();
// Strip accidental surrounding quotes (common when pasting into a host UI).
const url = rawUrl.replace(/^["']|["']$/g, "");

if (!url) {
  console.log("[migrate] DATABASE_URL not set — skipping migrations.");
  process.exit(0);
}

if (!/^postgres(ql)?:\/\/.+/i.test(url)) {
  console.error(
    "[migrate] DATABASE_URL is not a valid Postgres connection string " +
      "(it must start with postgresql:// ). Skipping migrations so the app can still boot.",
  );
  process.exit(0);
}

let sql;
try {
  sql = postgres(url, { max: 1, onnotice: () => {}, ssl: "prefer" });
} catch (error) {
  console.error("[migrate] could not connect with DATABASE_URL:", error?.message ?? error);
  process.exit(0);
}


try {
  await sql`
    create table if not exists public._app_migrations (
      name text primary key,
      applied_at timestamptz not null default now()
    )
  `;

  // Private media bucket used by Create Post. Idempotent: safe on every boot.
  await sql`
    insert into storage.buckets (id, name, public)
    values ('post-media', 'post-media', false)
    on conflict (id) do nothing
  `.catch((e) => console.warn("[migrate] could not ensure post-media bucket:", e.message));

  // Private bucket for delivery-page images (max 8 MB, images only). Idempotent.
  await sql`
    insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
    values ('delivery-page-images', 'delivery-page-images', false, 8388608,
            array['image/png','image/jpeg','image/webp','image/gif'])
    on conflict (id) do nothing
  `.catch((e) => console.warn("[migrate] could not ensure delivery-page-images bucket:", e.message));

  // Inbox core (conversations + messages) was created outside the .sql files.
  // 0004 depends on it, so bootstrap it just before that migration runs.
  const INBOX_BOOTSTRAP = `
do $$ begin
  create type public.conversation_status as enum ('open','pending','resolved');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.message_direction as enum ('inbound','outbound');
exception when duplicate_object then null; end $$;

create table if not exists public.conversations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  social_account_id uuid references public.social_accounts(id) on delete set null,
  platform public.social_platform not null,
  external_user_id text not null,
  external_user_name text,
  channel text not null default 'dm',
  status public.conversation_status not null default 'open',
  last_message_at timestamptz not null default now(),
  last_message_preview text,
  unread_count integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists conversations_unique_thread_idx
  on public.conversations (organization_id, platform, external_user_id, channel);
create index if not exists conversations_org_recent_idx
  on public.conversations (organization_id, last_message_at desc);

grant select, insert, update on public.conversations to authenticated;
grant all on public.conversations to service_role;
alter table public.conversations enable row level security;

drop policy if exists "conversations select member" on public.conversations;
create policy "conversations select member" on public.conversations
  for select to authenticated
  using (public.is_org_member(organization_id, auth.uid())
         or public.has_platform_role(auth.uid(), 'super_admin'));

drop policy if exists "conversations insert member" on public.conversations;
create policy "conversations insert member" on public.conversations
  for insert to authenticated
  with check (public.is_org_member(organization_id, auth.uid()));

drop policy if exists "conversations update member" on public.conversations;
create policy "conversations update member" on public.conversations
  for update to authenticated
  using (public.is_org_member(organization_id, auth.uid()))
  with check (public.is_org_member(organization_id, auth.uid()));

drop trigger if exists conversations_updated_at on public.conversations;
create trigger conversations_updated_at before update on public.conversations
  for each row execute function public.set_updated_at();

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  direction public.message_direction not null,
  body text not null,
  external_id text,
  sender_name text,
  sent_by uuid references auth.users(id),
  sent_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists messages_conversation_idx
  on public.messages (conversation_id, sent_at desc);
create unique index if not exists messages_external_idx
  on public.messages (conversation_id, external_id) where external_id is not null;

grant select, insert on public.messages to authenticated;
grant all on public.messages to service_role;
alter table public.messages enable row level security;

drop policy if exists "messages select member" on public.messages;
create policy "messages select member" on public.messages
  for select to authenticated
  using (exists (
    select 1 from public.conversations c
    where c.id = messages.conversation_id
      and (public.is_org_member(c.organization_id, auth.uid())
           or public.has_platform_role(auth.uid(), 'super_admin'))
  ));

drop policy if exists "messages insert member" on public.messages;
create policy "messages insert member" on public.messages
  for insert to authenticated
  with check (exists (
    select 1 from public.conversations c
    where c.id = messages.conversation_id
      and public.is_org_member(c.organization_id, auth.uid())
  ));

create or replace function public.increment_unread(p_conversation_id uuid)
returns void
language sql
security definer
set search_path to 'public'
as $$
  update public.conversations
  set unread_count = unread_count + 1
  where id = p_conversation_id;
$$;

revoke all on function public.increment_unread(uuid) from public;
grant execute on function public.increment_unread(uuid) to service_role;
`;

  const applied = new Set(
    (await sql`select name from public._app_migrations`).map((r) => r.name),
  );

  const files = (await readdir(MIGRATIONS_DIR))
    .filter((f) => f.endsWith(".sql"))
    .sort();

  let count = 0;
  for (const file of files) {
    if (applied.has(file)) continue;
    if (file.startsWith("0004_")) {
      console.log("[migrate] ensuring inbox core (conversations, messages)");
      await sql.unsafe(INBOX_BOOTSTRAP);
    }
    if (file.startsWith("0001_")) {
      console.log("[migrate] ensuring trust_settings base table");
      await sql.unsafe(TRUST_SETTINGS_BOOTSTRAP);
    }
    const body = await readFile(path.join(MIGRATIONS_DIR, file), "utf8");
    if (!body.trim()) continue;
    console.log(`[migrate] applying ${file}`);
    await sql.begin(async (tx) => {
      await tx.unsafe(body);
      await tx`insert into public._app_migrations (name) values (${file})`;
    });
    count += 1;
  }

  console.log(
    count === 0
      ? `[migrate] up to date (${files.length} migrations already applied)`
      : `[migrate] applied ${count} migration(s)`,
  );
} catch (error) {
  console.error("[migrate] failed:", error);
  process.exitCode = 1;
} finally {
  await sql.end({ timeout: 5 });
}
