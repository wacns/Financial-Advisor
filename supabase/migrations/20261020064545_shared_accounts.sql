-- Shared ledgers are separate from personal northline_workspaces data.
create schema if not exists private;
create table public.fa_shared_accounts (
 id uuid primary key default gen_random_uuid(), owner_id uuid not null references auth.users(id) on delete cascade,
 name text not null check(length(trim(name)) between 1 and 80), currency text not null check(currency in ('BHD','USD','EUR','GBP','SAR','AED','KWD','OMR','QAR','INR')),
 opening numeric(18,3) not null default 0 check(abs(opening)<=1000000000000), archived boolean not null default false,
 revision bigint not null default 0, created_at timestamptz not null default now()
);
create index fa_shared_accounts_owner on public.fa_shared_accounts(owner_id);
create table public.fa_shared_members (
 account_id uuid not null references public.fa_shared_accounts(id) on delete cascade,
 user_id uuid not null references auth.users(id) on delete cascade,
 role text not null check(role in ('owner','editor','viewer')), display_name text not null check(length(trim(display_name)) between 1 and 60),
 joined_at timestamptz not null default now(), primary key(account_id,user_id)
);
create index fa_shared_members_user on public.fa_shared_members(user_id,account_id);
create table public.fa_shared_transactions (
 id uuid primary key default gen_random_uuid(), account_id uuid not null references public.fa_shared_accounts(id) on delete cascade,
 actor_id uuid not null references auth.users(id), type text not null check(type in ('expense','income')),
 amount numeric(18,3) not null check(amount>0 and amount<=1000000000000), date date not null check(date between date '1900-01-01' and date '9999-12-31'),
 name text not null check(length(trim(name)) between 1 and 80), category text not null check(length(trim(category)) between 1 and 500),
 note text not null default '' check(length(note)<=500), payee text not null default '' check(length(payee)<=80),
 labels jsonb not null default '[]' check(jsonb_typeof(labels)='array' and jsonb_array_length(labels)<=5),
 revision bigint not null default 1, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create index fa_shared_transactions_account_date on public.fa_shared_transactions(account_id,date desc,created_at desc);
create index fa_shared_transactions_actor on public.fa_shared_transactions(actor_id);
create table public.fa_shared_activity (
 id uuid primary key default gen_random_uuid(), account_id uuid not null references public.fa_shared_accounts(id) on delete cascade,
 actor_id uuid not null references auth.users(id), action text not null, detail text not null default '', created_at timestamptz not null default now()
);
create index fa_shared_activity_account on public.fa_shared_activity(account_id,created_at desc);
create index fa_shared_activity_actor on public.fa_shared_activity(actor_id);
create table private.fa_shared_invites (
 id uuid primary key default gen_random_uuid(), account_id uuid not null references public.fa_shared_accounts(id) on delete cascade,
 token_hash text unique not null, role text not null check(role in ('editor','viewer')), created_by uuid not null references auth.users(id),
 expires_at timestamptz not null default(now()+interval '7 days'), redeemed_by uuid references auth.users(id), redeemed_at timestamptz
);
create index fa_shared_invites_account on private.fa_shared_invites(account_id);
create index fa_shared_invites_creator on private.fa_shared_invites(created_by);
create index fa_shared_invites_redeemer on private.fa_shared_invites(redeemed_by);
alter table public.fa_shared_accounts enable row level security;
alter table public.fa_shared_members enable row level security;
alter table public.fa_shared_transactions enable row level security;
alter table public.fa_shared_activity enable row level security;
alter table private.fa_shared_invites enable row level security;

create function private.fa_shared_role(p_account uuid) returns text language sql stable security definer set search_path='' as $$
 select m.role from public.fa_shared_members m where m.account_id=p_account and m.user_id=(select auth.uid());
$$;
revoke all on function private.fa_shared_role(uuid) from public,anon;
grant usage on schema private to authenticated;
grant execute on function private.fa_shared_role(uuid) to authenticated;
create policy fa_shared_accounts_read on public.fa_shared_accounts for select to authenticated using(private.fa_shared_role(id) is not null);
create policy fa_shared_members_read on public.fa_shared_members for select to authenticated using(private.fa_shared_role(account_id) is not null);
create policy fa_shared_transactions_read on public.fa_shared_transactions for select to authenticated using(private.fa_shared_role(account_id) is not null);
create policy fa_shared_activity_read on public.fa_shared_activity for select to authenticated using(private.fa_shared_role(account_id) is not null);
revoke all on public.fa_shared_accounts,public.fa_shared_members,public.fa_shared_transactions,public.fa_shared_activity from public,anon,authenticated;
grant select on public.fa_shared_accounts,public.fa_shared_members,public.fa_shared_transactions,public.fa_shared_activity to authenticated;
revoke all on private.fa_shared_invites from public,anon,authenticated;

create function private.fa_shared_rpc(p_action text,p_data jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare
 u uuid:=auth.uid(); a uuid; r text; acct public.fa_shared_accounts; tx public.fa_shared_transactions; inv private.fa_shared_invites;
 identifier uuid; target uuid; v_amount numeric; v_opening numeric; v_name text; v_category text; v_type text; v_note text; v_payee text;
 v_labels jsonb; v_date date; token text; result jsonb; event text; request_revision bigint;
begin
 if u is null then raise exception 'Sign in to use shared accounts' using errcode='42501'; end if;
 if p_data is null or jsonb_typeof(p_data)<>'object' then raise exception 'Invalid request'; end if;
 if p_action='list' then
  select coalesce(jsonb_agg(row_to_json(q) order by q.created_at desc),'[]'::jsonb) into result from (
   select ac.id,ac.name,ac.currency,ac.owner_id,ac.archived,ac.revision,ac.created_at,m.role,
    ac.opening+coalesce((select sum(case when t.type='income' then t.amount else -t.amount end) from public.fa_shared_transactions t where t.account_id=ac.id),0) as balance
   from public.fa_shared_accounts ac join public.fa_shared_members m on m.account_id=ac.id where m.user_id=u
  ) q;
  return result;
 end if;
 if p_action='create' then
  v_name:=trim(p_data->>'name'); v_opening:=coalesce((p_data->>'opening')::numeric,0); identifier:=coalesce((p_data->>'id')::uuid,gen_random_uuid());
  if v_opening*1000<>trunc(v_opening*1000) then raise exception 'Use at most three decimal places'; end if;
  if length(trim(coalesce(p_data->>'display_name',''))) not between 1 and 60 then raise exception 'Enter a display name'; end if;
  select * into acct from public.fa_shared_accounts where id=identifier;
  if found then
   if acct.owner_id=u and acct.name=v_name and acct.currency=p_data->>'currency' and acct.opening=v_opening then return jsonb_build_object('id',identifier); end if;
   raise exception 'Account request conflicts with an existing account';
  end if;
  if (select count(*) from public.fa_shared_accounts where owner_id=u)>=100 then raise exception 'Shared account limit reached'; end if;
  insert into public.fa_shared_accounts(id,owner_id,name,currency,opening) values(identifier,u,v_name,p_data->>'currency',v_opening);
  insert into public.fa_shared_members(account_id,user_id,role,display_name) values(identifier,u,'owner',trim(p_data->>'display_name'));
  insert into public.fa_shared_activity(account_id,actor_id,action,detail) values(identifier,u,'account_created',v_name);
  return jsonb_build_object('id',identifier);
 end if;
 if p_action='accept' then
  token:=p_data->>'token';
  if token is null or token !~ '^[a-f0-9]{48}$' then raise exception 'Invalid or expired invitation'; end if;
  select account_id into a from private.fa_shared_invites where token_hash=encode(extensions.digest(token,'sha256'),'hex');
  if not found then raise exception 'Invalid or expired invitation'; end if;
 else a:=(p_data->>'account_id')::uuid;
 end if;
 select * into acct from public.fa_shared_accounts where id=a for update;
 if not found then raise exception 'Shared account is unavailable' using errcode='42501'; end if;
 r:=private.fa_shared_role(a);
 if p_action='accept' then
  select * into inv from private.fa_shared_invites where token_hash=encode(extensions.digest(token,'sha256'),'hex') for update;
  if inv.redeemed_by=u and r is not null then return jsonb_build_object('id',a); end if;
  if inv.redeemed_by is not null or inv.expires_at<=now() or acct.archived then raise exception 'Invalid or expired invitation'; end if;
  if r='owner' then raise exception 'You already own this account'; end if;
  if length(trim(coalesce(p_data->>'display_name',''))) not between 1 and 60 then raise exception 'Enter a display name'; end if;
  insert into public.fa_shared_members(account_id,user_id,role,display_name) values(a,u,inv.role,trim(p_data->>'display_name')) on conflict(account_id,user_id) do update set role=excluded.role,display_name=excluded.display_name;
  update private.fa_shared_invites set redeemed_by=u,redeemed_at=now() where id=inv.id;
  event:='member_joined';
 elsif r is null then raise exception 'You do not have access to this shared account' using errcode='42501';
 elsif p_action='snapshot' then
  return jsonb_build_object('account',jsonb_build_object('id',acct.id,'name',acct.name,'currency',acct.currency,'opening',acct.opening,'owner_id',acct.owner_id,'archived',acct.archived,'revision',acct.revision,'role',r,'balance',acct.opening+coalesce((select sum(case when t.type='income' then t.amount else -t.amount end) from public.fa_shared_transactions t where t.account_id=a),0)),
   'members',coalesce((select jsonb_agg(row_to_json(m)) from public.fa_shared_members m where m.account_id=a),'[]'::jsonb),
   'transactions',coalesce((select jsonb_agg(row_to_json(t) order by t.date desc,t.created_at desc) from (select * from public.fa_shared_transactions where account_id=a order by date desc,created_at desc limit 5000)t),'[]'::jsonb),
   'activity',coalesce((select jsonb_agg(row_to_json(ev) order by ev.created_at desc) from (select * from public.fa_shared_activity where account_id=a order by created_at desc limit 50)ev),'[]'::jsonb),
   'invites',case when r='owner' then coalesce((select jsonb_agg(jsonb_build_object('id',i.id,'role',i.role,'expires_at',i.expires_at,'redeemed',i.redeemed_at is not null)) from private.fa_shared_invites i where i.account_id=a and i.expires_at>now()),'[]'::jsonb) else '[]'::jsonb end);
 elsif p_action='invite' then
  if r<>'owner' or acct.archived then raise exception 'Only the active account owner can invite members' using errcode='42501'; end if;
  if p_data->>'role' not in ('editor','viewer') then raise exception 'Choose editor or viewer'; end if;
  if (select count(*) from private.fa_shared_invites where account_id=a and expires_at>now() and redeemed_at is null)>=20 then raise exception 'Revoke an unused invitation first'; end if;
  token:=encode(extensions.gen_random_bytes(24),'hex');
  insert into private.fa_shared_invites(account_id,token_hash,role,created_by) values(a,encode(extensions.digest(token,'sha256'),'hex'),p_data->>'role',u) returning * into inv;
  return jsonb_build_object('token',token,'expires_at',inv.expires_at,'role',inv.role,'id',inv.id);
 elsif p_action='revoke_invite' then
  if r<>'owner' then raise exception 'Only the owner can revoke invitations' using errcode='42501'; end if;
  update private.fa_shared_invites set expires_at=now() where id=(p_data->>'id')::uuid and account_id=a;
  event:='invitation_revoked';
 elsif p_action in ('set_role','remove_member','leave') then
  target:=case when p_action='leave' then u else (p_data->>'user_id')::uuid end;
  if target=acct.owner_id then raise exception 'The owner must keep access; archive the account instead'; end if;
  if p_action<>'leave' and r<>'owner' then raise exception 'Only the owner can manage members' using errcode='42501'; end if;
  if p_action='set_role' then
   if p_data->>'role' not in ('editor','viewer') then raise exception 'Choose editor or viewer'; end if;
   update public.fa_shared_members set role=p_data->>'role' where account_id=a and user_id=target;
  else delete from public.fa_shared_members where account_id=a and user_id=target;
  end if;
  event:=p_action;
 elsif p_action='archive' then
  if r<>'owner' then raise exception 'Only the owner can archive an account' using errcode='42501'; end if;
  update public.fa_shared_accounts set archived=coalesce((p_data->>'archived')::boolean,true) where id=a;
  event:='archive_changed';
 elsif p_action='rename' then
  if r<>'owner' then raise exception 'Only the owner can rename an account' using errcode='42501'; end if;
  update public.fa_shared_accounts set name=trim(p_data->>'name') where id=a;
  event:='account_renamed';
 elsif p_action in ('save_transaction','delete_transaction') then
  if r not in ('owner','editor') or acct.archived then raise exception 'An active account editor role is required' using errcode='42501'; end if;
  identifier:=(p_data->>'id')::uuid;
  if identifier is null then raise exception 'Transaction ID is required'; end if;
  select * into tx from public.fa_shared_transactions where id=identifier for update;
  if found and tx.account_id<>a then raise exception 'Transaction belongs to another account' using errcode='42501'; end if;
  request_revision:=(p_data->>'expected_revision')::bigint;
  if p_action='delete_transaction' then
   if tx.id is null then return jsonb_build_object('id',identifier); end if;
   if request_revision is distinct from tx.revision then raise exception 'This transaction changed. Refresh before deleting' using errcode='40001'; end if;
   delete from public.fa_shared_transactions where id=identifier;
   event:='transaction_deleted';
  else
   v_amount:=(p_data->>'amount')::numeric; v_name:=trim(p_data->>'name'); v_type:=p_data->>'type'; v_date:=(p_data->>'date')::date;
   v_note:=coalesce(p_data->>'note',''); v_payee:=coalesce(p_data->>'payee',''); v_category:=coalesce(nullif(trim(p_data->>'category'),''),'Other'); v_labels:=coalesce(p_data->'labels','[]'::jsonb);
   if v_amount*1000<>trunc(v_amount*1000) then raise exception 'Use at most three decimal places'; end if;
   if jsonb_typeof(v_labels)<>'array' then raise exception 'Invalid labels'; end if;
   if exists(select 1 from jsonb_array_elements(v_labels) l where jsonb_typeof(l)<>'string' or length(trim(l#>>'{}')) not between 1 and 40) then raise exception 'Invalid labels'; end if;
   if tx.id is not null then
    if request_revision is null and tx.actor_id=u and tx.type=v_type and tx.name=v_name and tx.amount=v_amount and tx.date=v_date and tx.category=v_category and tx.note=v_note and tx.payee=v_payee and tx.labels=v_labels then return jsonb_build_object('id',identifier); end if;
    if request_revision is distinct from tx.revision then raise exception 'This transaction changed. Refresh before editing' using errcode='40001'; end if;
    update public.fa_shared_transactions set type=v_type,amount=v_amount,date=v_date,name=v_name,category=v_category,note=v_note,payee=v_payee,labels=v_labels,revision=revision+1,updated_at=now() where id=identifier;
    event:='transaction_edited';
   else
    if request_revision is not null then raise exception 'This transaction was removed. Refresh before editing' using errcode='40001'; end if;
    insert into public.fa_shared_transactions(id,account_id,actor_id,type,amount,date,name,category,note,payee,labels) values(identifier,a,u,v_type,v_amount,v_date,v_name,v_category,v_note,v_payee,v_labels);
    event:='transaction_created';
   end if;
  end if;
 else raise exception 'Unknown shared account action';
 end if;
 update public.fa_shared_accounts set revision=revision+1 where id=a;
 insert into public.fa_shared_activity(account_id,actor_id,action,detail) values(a,u,event,coalesce(v_name,''));
 return jsonb_build_object('id',a);
end;
$$;
revoke all on function private.fa_shared_rpc(text,jsonb) from public,anon;
grant execute on function private.fa_shared_rpc(text,jsonb) to authenticated;
create function public.fa_shared(p_action text,p_data jsonb default '{}'::jsonb) returns jsonb language sql security invoker set search_path='' as $$ select private.fa_shared_rpc(p_action,p_data); $$;
revoke all on function public.fa_shared(text,jsonb) from public,anon;
grant execute on function public.fa_shared(text,jsonb) to authenticated;

-- A small account revision event refreshes clients without sharing personal data.
do $$ begin
 if exists(select 1 from pg_publication where pubname='supabase_realtime') then
  alter publication supabase_realtime add table public.fa_shared_accounts;
 end if;
end $$;
