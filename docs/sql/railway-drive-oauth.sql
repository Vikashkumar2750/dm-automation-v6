-- Optional manual repair (deploy runs this automatically). Server-only table.
create table if not exists public.platform_drive_oauth (
  id boolean primary key default true check (id),
  refresh_token text, account_email text, connected_by uuid, connected_at timestamptz,
  pending_state_hash text, pending_by uuid, pending_expires_at timestamptz,
  updated_at timestamptz not null default now());
alter table public.platform_drive_oauth enable row level security;
revoke all on public.platform_drive_oauth from public, anon, authenticated;
grant select, insert, update, delete on public.platform_drive_oauth to service_role;
