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

  // Delivery-page image upload policies (owners/admins/managers of the folder's workspace). Idempotent.
  for (const [name, cmd, clause] of [
    ["delivery page image members read", "select", "using"],
    ["delivery page image writers upload", "insert", "with check"],
    ["delivery page image writers update", "update", "using"],
    ["delivery page image writers delete", "delete", "using"],
  ]) {
    const roles = cmd === "select" ? "" : " and m.role::text in ('owner','admin','manager')";
    const cond = `bucket_id = 'delivery-page-images' and exists (select 1 from public.organization_members m where m.organization_id::text = (storage.foldername(name))[1] and m.user_id = auth.uid()${roles})`;
    await sql.unsafe(`drop policy if exists "${name}" on storage.objects`).catch(() => {});
    await sql.unsafe(`create policy "${name}" on storage.objects for ${cmd} to authenticated ${clause} (${cond})${cmd === "update" ? ` with check (${cond})` : ""}`)
      .catch((e) => console.warn(`[migrate] could not ensure policy ${name}:`, e.message));
  }

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
  using (public.current_user_is_org_member(organization_id)
         or public.current_user_has_platform_role('super_admin'));

drop policy if exists "conversations insert member" on public.conversations;
create policy "conversations insert member" on public.conversations
  for insert to authenticated
  with check (public.current_user_is_org_member(organization_id));

drop policy if exists "conversations update member" on public.conversations;
create policy "conversations update member" on public.conversations
  for update to authenticated
  using (public.current_user_is_org_member(organization_id))
  with check (public.current_user_is_org_member(organization_id));

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
      and (public.current_user_is_org_member(c.organization_id)
           or public.current_user_has_platform_role('super_admin'))
  ));

drop policy if exists "messages insert member" on public.messages;
create policy "messages insert member" on public.messages
  for insert to authenticated
  with check (exists (
    select 1 from public.conversations c
    where c.id = messages.conversation_id
      and public.current_user_is_org_member(c.organization_id)
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

  // trust_settings was created outside the .sql files; 0001 alters it, so
  // bootstrap the base table just before that migration runs. Idempotent.
  const TRUST_SETTINGS_BOOTSTRAP = `
create table if not exists public.trust_settings (
  organization_id uuid primary key references public.organizations(id) on delete cascade,
  predictive_guard boolean not null default false,
  last_guard_action_at timestamptz,
  updated_at timestamptz not null default now()
);

grant select, insert, update on public.trust_settings to authenticated;
grant all on public.trust_settings to service_role;
alter table public.trust_settings enable row level security;

drop policy if exists "trust_settings select member" on public.trust_settings;
create policy "trust_settings select member" on public.trust_settings
  for select to authenticated
  using (public.current_user_is_org_member(organization_id));

drop policy if exists "trust_settings update member" on public.trust_settings;
create policy "trust_settings update member" on public.trust_settings
  for update to authenticated
  using (public.current_user_is_org_member(organization_id))
  with check (public.current_user_is_org_member(organization_id));
`;

  // Revenue core (products, coupons, delivery pages, payment links, events)
  // was created outside the .sql files; 0006 alters it, so bootstrap the base
  // tables just before that migration runs. Idempotent.
  const REVENUE_BOOTSTRAP = `
create table if not exists public.revenue_products (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  description text,
  price_paise integer not null default 0,
  currency text not null default 'INR',
  manual_url text,
  active boolean not null default true,
  created_at timestamptz not null default now()
);
grant select, insert, update, delete on public.revenue_products to authenticated;
grant all on public.revenue_products to service_role;
alter table public.revenue_products enable row level security;
drop policy if exists "revenue_products member" on public.revenue_products;
create policy "revenue_products member" on public.revenue_products
  for all to authenticated
  using (public.current_user_is_org_member(organization_id))
  with check (public.current_user_is_org_member(organization_id));

create table if not exists public.coupon_campaigns (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  prefix text not null,
  discount_label text not null,
  max_codes integer not null default 500,
  expires_at timestamptz,
  active boolean not null default true,
  created_at timestamptz not null default now()
);
grant select, insert, update, delete on public.coupon_campaigns to authenticated;
grant all on public.coupon_campaigns to service_role;
alter table public.coupon_campaigns enable row level security;
drop policy if exists "coupon_campaigns member" on public.coupon_campaigns;
create policy "coupon_campaigns member" on public.coupon_campaigns
  for all to authenticated
  using (public.current_user_is_org_member(organization_id))
  with check (public.current_user_is_org_member(organization_id));

create table if not exists public.coupon_codes (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.coupon_campaigns(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  code text not null,
  platform text not null,
  external_user_id text not null,
  issued_at timestamptz not null default now()
);
create unique index if not exists coupon_codes_code_idx on public.coupon_codes (code);
grant all on public.coupon_codes to service_role;
alter table public.coupon_codes enable row level security;

create table if not exists public.revenue_settings (
  organization_id uuid primary key references public.organizations(id) on delete cascade,
  nudge_enabled boolean not null default false,
  nudge_delay_minutes integer not null default 60,
  nudge_text text not null default '',
  updated_at timestamptz not null default now()
);
grant select, insert, update on public.revenue_settings to authenticated;
grant all on public.revenue_settings to service_role;
alter table public.revenue_settings enable row level security;
drop policy if exists "revenue_settings member" on public.revenue_settings;
create policy "revenue_settings member" on public.revenue_settings
  for all to authenticated
  using (public.current_user_is_org_member(organization_id))
  with check (public.current_user_is_org_member(organization_id));

create table if not exists public.delivery_pages (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  slug text not null,
  title text not null,
  body text,
  button_label text,
  button_url text,
  product_id uuid references public.revenue_products(id) on delete set null,
  active boolean not null default true,
  views integer not null default 0,
  created_at timestamptz not null default now(),
  image_path text,
  show_image boolean not null default true,
  image_alt text,
  countdown_at timestamptz,
  expiry_action text not null default 'none',
  expiry_message text,
  form_config jsonb not null default '{}'::jsonb,
  price_original_paise integer,
  price_offer_paise integer,
  discount_label text,
  coupon_code text,
  coupon_note text,
  show_price boolean not null default false
);
create unique index if not exists delivery_pages_slug_idx on public.delivery_pages (slug);
grant select, insert, update, delete on public.delivery_pages to authenticated;
grant all on public.delivery_pages to service_role;
alter table public.delivery_pages enable row level security;
drop policy if exists "delivery_pages member" on public.delivery_pages;
create policy "delivery_pages member" on public.delivery_pages
  for all to authenticated
  using (public.current_user_is_org_member(organization_id))
  with check (public.current_user_is_org_member(organization_id));

create table if not exists public.delivery_page_leads (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  delivery_page_id uuid not null references public.delivery_pages(id) on delete cascade,
  answers jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
grant all on public.delivery_page_leads to service_role;
alter table public.delivery_page_leads enable row level security;

create table if not exists public.payment_links (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  product_id uuid references public.revenue_products(id) on delete set null,
  conversation_id uuid,
  social_account_id uuid,
  platform text not null,
  external_user_id text not null,
  provider text not null default 'manual',
  provider_link_id text,
  url text not null,
  amount_paise integer not null default 0,
  status text not null default 'created',
  nudged_at timestamptz,
  paid_at timestamptz,
  created_at timestamptz not null default now()
);
grant all on public.payment_links to service_role;
alter table public.payment_links enable row level security;

create table if not exists public.revenue_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  kind text not null,
  platform text,
  external_user_id text,
  ref_id uuid,
  amount_paise integer,
  created_at timestamptz not null default now()
);
grant all on public.revenue_events to service_role;
alter table public.revenue_events enable row level security;
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
    if (file.startsWith("0006_")) {
      console.log("[migrate] ensuring revenue core (products, coupons, delivery pages)");
      await sql.unsafe(REVENUE_BOOTSTRAP);
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

  // Repair old Starter clients without granting an independent Agency subscription.
  // Runtime always rechecks the parent, so downgrade/expiry cannot leave unlimited clients.
  await sql`
    update public.organizations child
    set plan = 'agency', plan_source = 'agency_parent', plan_expires_at = parent.plan_expires_at
    from public.organizations parent
    where child.parent_organization_id = parent.id
      and parent.parent_organization_id is null
      and parent.plan = 'agency'
      and (parent.plan_expires_at is null or parent.plan_expires_at > now())
      and (child.plan = 'starter' or child.plan_source = 'agency_parent')
      and (child.plan is distinct from 'agency'
        or child.plan_source is distinct from 'agency_parent'
        or child.plan_expires_at is distinct from parent.plan_expires_at)
  `;

  // Client workspaces belong to the main Agency owner; other former owners become admins.
  await sql`
    update public.organizations child set owner_id = parent.owner_id
    from public.organizations parent
    where child.parent_organization_id = parent.id and child.owner_id is distinct from parent.owner_id
  `;
  await sql`
    update public.organization_members m set role = 'admin'
    from public.organizations o
    where m.organization_id = o.id and o.parent_organization_id is not null
      and m.role = 'owner' and m.user_id <> o.owner_id
  `;
  await sql`
    insert into public.organization_members (organization_id, user_id, role)
    select o.id, o.owner_id, 'owner' from public.organizations o
    where o.parent_organization_id is not null
      and not exists (select 1 from public.organization_members m where m.organization_id = o.id and m.user_id = o.owner_id)
  `;
  await sql`
    update public.organization_members m set role = 'owner'
    from public.organizations o
    where m.organization_id = o.id and o.parent_organization_id is not null
      and m.user_id = o.owner_id and m.role <> 'owner'
  `;

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
