create table if not exists public.ai_usage_daily (
  user_id uuid not null references auth.users(id) on delete cascade,
  day date not null default current_date,
  requests integer not null default 0,
  primary key (user_id, day)
);
grant all on public.ai_usage_daily to service_role;
alter table public.ai_usage_daily enable row level security;

create or replace function public.consume_ai_request(_user_id uuid, _limit integer)
returns integer language plpgsql security definer set search_path = public as $$
declare used integer;
begin
  insert into public.ai_usage_daily (user_id, day, requests) values (_user_id, current_date, 1)
  on conflict (user_id, day) do update set requests = ai_usage_daily.requests + 1
  where ai_usage_daily.requests < _limit
  returning requests into used;
  return coalesce(used, -1);
end $$;
revoke all on function public.consume_ai_request(uuid, integer) from public, anon, authenticated;
grant execute on function public.consume_ai_request(uuid, integer) to service_role;