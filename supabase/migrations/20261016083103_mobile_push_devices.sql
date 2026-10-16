create table public.mobile_push_devices (
  installation_id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  token text not null unique check (length(token) between 20 and 4096),
  platform text not null check (platform in ('ios', 'android')),
  updated_at timestamptz not null default now()
);
create index mobile_push_devices_user_id_idx on public.mobile_push_devices(user_id);
alter table public.mobile_push_devices enable row level security;
revoke all on public.mobile_push_devices from anon, authenticated;
grant select, delete on public.mobile_push_devices to authenticated;
grant all on public.mobile_push_devices to service_role;
create policy "Read own registered devices" on public.mobile_push_devices
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "Disconnect own devices" on public.mobile_push_devices
  for delete to authenticated using ((select auth.uid()) = user_id);
-- Registration writes go through the authenticated Edge Function. It derives
-- user_id from getUser(), never from a submitted owner ID.

create table public.mobile_push_deliveries (
  user_id uuid not null references auth.users(id) on delete cascade,
  delivery_key text not null check (length(delivery_key) <= 200),
  status text not null default 'pending' check (status in ('pending','sent','failed')),
  lease_until timestamptz not null default now() + interval '5 minutes',
  updated_at timestamptz not null default now(),
  primary key (user_id, delivery_key)
);
alter table public.mobile_push_deliveries enable row level security;
revoke all on public.mobile_push_deliveries from anon, authenticated;
grant all on public.mobile_push_deliveries to service_role;

create function public.claim_mobile_push(p_user_id uuid, p_key text)
returns boolean language sql security invoker set search_path = '' as $$
  with claimed as (
    insert into public.mobile_push_deliveries(user_id, delivery_key)
    values (p_user_id, p_key)
    on conflict (user_id, delivery_key) do update
      set status = 'pending', lease_until = now() + interval '5 minutes', updated_at = now()
      where mobile_push_deliveries.status = 'failed'
        or (mobile_push_deliveries.status = 'pending' and mobile_push_deliveries.lease_until < now())
    returning 1
  ) select exists(select 1 from claimed);
$$;
revoke execute on function public.claim_mobile_push(uuid, text) from public, anon, authenticated;
grant execute on function public.claim_mobile_push(uuid, text) to service_role;
