alter table public.organizations
  add column if not exists plan_expires_at timestamptz,
  add column if not exists plan_source text not null default 'manual';

create table if not exists public.plan_orders (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  created_by uuid references auth.users(id),
  plan text not null,
  billing_cycle text not null,
  amount_paise integer not null,
  currency text not null default 'INR',
  provider text not null default 'razorpay',
  mode text not null default 'live',
  provider_order_id text,
  provider_payment_id text,
  status text not null default 'created',
  error text,
  created_at timestamptz not null default now(),
  paid_at timestamptz
);

create index if not exists plan_orders_org_idx on public.plan_orders(organization_id, created_at desc);

grant select on public.plan_orders to authenticated;
grant all on public.plan_orders to service_role;

alter table public.plan_orders enable row level security;

create policy "members read own org orders"
on public.plan_orders for select to authenticated
using (public.is_org_member(organization_id, auth.uid()) or public.has_platform_role(auth.uid(), 'super_admin'));