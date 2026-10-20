-- AI credits are a separate service balance, never a personal financial account.
create schema if not exists private;
create table private.fa_ai_wallets (
  user_id uuid primary key references auth.users(id) on delete cascade,
  credits bigint not null default 0 check (credits >= 0),
  updated_at timestamptz not null default now()
);
create table private.fa_ai_requests (
  user_id uuid not null references auth.users(id) on delete cascade,
  request_id uuid not null,
  credits integer not null check (credits > 0 and credits <= 1000000),
  status text not null check (status in ('reserved','completed','refunded')),
  pricing_version text not null,
  usage jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, request_id)
);
create table private.fa_ai_credit_grants (
  reference text primary key check (length(reference) between 1 and 160),
  user_id uuid not null references auth.users(id) on delete cascade,
  credits integer not null check (credits > 0 and credits <= 1000000),
  created_at timestamptz not null default now()
);
alter table private.fa_ai_wallets enable row level security;
alter table private.fa_ai_requests enable row level security;
alter table private.fa_ai_credit_grants enable row level security;
create index fa_ai_requests_recent on private.fa_ai_requests(user_id, created_at desc);
revoke all on private.fa_ai_wallets, private.fa_ai_requests, private.fa_ai_credit_grants from public, anon, authenticated;

create or replace function public.fa_ai_credit_status()
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'balance', coalesce((select credits from private.fa_ai_wallets where user_id = auth.uid()), 0),
    'recentRequests', coalesce((select jsonb_agg(jsonb_build_object(
      'requestId',r.request_id,'credits',r.credits,'status',r.status,'createdAt',r.created_at
    ) order by r.created_at desc) from (
      select request_id,credits,status,created_at from private.fa_ai_requests where user_id=auth.uid() order by created_at desc limit 20
    ) r), '[]'::jsonb)
  );
$$;
revoke all on function public.fa_ai_credit_status() from public, anon;
grant execute on function public.fa_ai_credit_status() to authenticated;

-- Only the Edge Function/service role can grant, reserve or settle credits.
-- All external payment verification belongs in a future trusted webhook.
create or replace function public.fa_ai_credits(
  p_action text, p_user uuid, p_request uuid default null,
  p_amount integer default null, p_reference text default null, p_usage jsonb default '{}'::jsonb
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_balance bigint;
  v_request private.fa_ai_requests%rowtype;
  v_grant private.fa_ai_credit_grants%rowtype;
begin
  if auth.role() is distinct from 'service_role' then raise exception 'Service access required' using errcode = '42501'; end if;
  if p_user is null or p_action not in ('grant','reserve','complete','refund') then raise exception 'Invalid credit request'; end if;
  insert into private.fa_ai_wallets(user_id) values(p_user) on conflict do nothing;
  select credits into v_balance from private.fa_ai_wallets where user_id = p_user for update;
  if p_action = 'grant' then
    if p_amount is null or p_amount < 1 or p_amount > 1000000 or p_reference is null or length(p_reference) not between 1 and 160 then raise exception 'Invalid credit grant'; end if;
    -- Serialize grants sharing a payment reference even across different users.
    perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_reference, 0));
    select * into v_grant from private.fa_ai_credit_grants where reference = p_reference;
    if found then
      if v_grant.user_id <> p_user or v_grant.credits <> p_amount then raise exception 'Credit reference already used'; end if;
      return jsonb_build_object('balance',v_balance,'duplicate',true);
    end if;
    insert into private.fa_ai_credit_grants(reference,user_id,credits) values(p_reference,p_user,p_amount);
    update private.fa_ai_wallets set credits=credits+p_amount,updated_at=now() where user_id=p_user returning credits into v_balance;
    return jsonb_build_object('balance',v_balance,'duplicate',false);
  end if;
  if p_request is null then raise exception 'Request ID required'; end if;
  select * into v_request from private.fa_ai_requests where user_id=p_user and request_id=p_request;
  if p_action = 'reserve' then
    if found then return jsonb_build_object('balance',v_balance,'duplicate',true,'status',v_request.status); end if;
    if p_amount is null or p_amount < 1 or p_amount > 1000000 or p_reference is null or length(p_reference) not between 1 and 80 then raise exception 'Invalid price'; end if;
    if v_balance < p_amount then return jsonb_build_object('balance',v_balance,'insufficient',true); end if;
    update private.fa_ai_wallets set credits=credits-p_amount,updated_at=now() where user_id=p_user returning credits into v_balance;
    insert into private.fa_ai_requests(user_id,request_id,credits,status,pricing_version) values(p_user,p_request,p_amount,'reserved',p_reference);
    return jsonb_build_object('balance',v_balance,'duplicate',false,'status','reserved');
  end if;
  if not found then raise exception 'Reservation not found'; end if;
  if p_action = 'complete' and v_request.status = 'reserved' then
    -- No prompts/responses, provider keys or arbitrary metadata enter this log.
    if jsonb_typeof(p_usage) <> 'object' or pg_catalog.octet_length(p_usage::text) > 1000 then raise exception 'Invalid usage'; end if;
    update private.fa_ai_requests set status='completed',usage=jsonb_build_object(
      'inputTokens',case when p_usage->>'inputTokens' ~ '^\d{1,12}$' then (p_usage->>'inputTokens')::bigint else 0 end,
      'outputTokens',case when p_usage->>'outputTokens' ~ '^\d{1,12}$' then (p_usage->>'outputTokens')::bigint else 0 end
    ),updated_at=now() where user_id=p_user and request_id=p_request;
    return jsonb_build_object('balance',v_balance,'status','completed');
  elsif p_action = 'refund' and v_request.status = 'reserved' then
    update private.fa_ai_wallets set credits=credits+v_request.credits,updated_at=now() where user_id=p_user returning credits into v_balance;
    update private.fa_ai_requests set status='refunded',updated_at=now() where user_id=p_user and request_id=p_request;
    return jsonb_build_object('balance',v_balance,'status','refunded');
  end if;
  -- Retrying settlement never charges/refunds again; completed work cannot be refunded here.
  return jsonb_build_object('balance',v_balance,'status',v_request.status,'duplicate',true);
end;
$$;
revoke all on function public.fa_ai_credits(text,uuid,uuid,integer,text,jsonb) from public, anon, authenticated;
grant execute on function public.fa_ai_credits(text,uuid,uuid,integer,text,jsonb) to service_role;
