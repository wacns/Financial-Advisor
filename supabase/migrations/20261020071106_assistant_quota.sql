-- Keep provider usage bounded even when the client is bypassed. No prompts,
-- model answers, account balances or provider credentials are stored here.
create table private.fa_assistant_usage (
  user_id uuid not null references auth.users(id) on delete cascade,
  usage_day date not null,
  requests integer not null check (requests between 1 and 20),
  last_request_at timestamptz not null default now(),
  primary key (user_id, usage_day)
);
alter table private.fa_assistant_usage enable row level security;
revoke all on private.fa_assistant_usage from public, anon, authenticated;

create function public.fa_assistant_quota() returns boolean
language plpgsql security definer set search_path = '' as $$
declare allowed boolean;
begin
  if auth.uid() is null then raise exception 'Sign in to use the assistant.' using errcode = '42501'; end if;
  insert into private.fa_assistant_usage(user_id, usage_day, requests)
    values(auth.uid(), (now() at time zone 'UTC')::date, 1)
    on conflict(user_id, usage_day) do update
    set requests = private.fa_assistant_usage.requests + 1, last_request_at = now()
    where private.fa_assistant_usage.requests < 20
      and private.fa_assistant_usage.last_request_at < now() - interval '5 seconds'
    returning true into allowed;
  -- Bound retained metadata; this never contains a question or financial data.
  delete from private.fa_assistant_usage
    where user_id = auth.uid() and usage_day < (now() at time zone 'UTC')::date - 30;
  return coalesce(allowed, false);
end;
$$;
revoke all on function public.fa_assistant_quota() from public, anon;
grant execute on function public.fa_assistant_quota() to authenticated;
