begin;
insert into auth.users(id) values ('40000000-0000-4000-8000-000000000001'),('40000000-0000-4000-8000-000000000002');
set local role authenticated;
select set_config('request.jwt.claim.sub','40000000-0000-4000-8000-000000000001',true);
do $$ begin
 if public.fa_assistant_quota() is not true then raise exception 'First assistant request rejected'; end if;
 if public.fa_assistant_quota() is not false then raise exception 'Burst limit bypassed'; end if;
 begin delete from private.fa_assistant_usage; raise exception 'User can reset quota'; exception when insufficient_privilege then null; end;
end $$;
reset role;
update private.fa_assistant_usage set requests=19,last_request_at=now()-interval '10 seconds' where user_id='40000000-0000-4000-8000-000000000001';
set local role authenticated;
do $$ begin if public.fa_assistant_quota() is not true then raise exception 'Twentieth request rejected'; end if; end $$;
reset role;
update private.fa_assistant_usage set last_request_at=now()-interval '10 seconds' where user_id='40000000-0000-4000-8000-000000000001';
set local role authenticated;
do $$ begin if public.fa_assistant_quota() is not false then raise exception 'Daily limit bypassed'; end if; end $$;
select set_config('request.jwt.claim.sub','40000000-0000-4000-8000-000000000002',true);
do $$ begin if public.fa_assistant_quota() is not true then raise exception 'Second user inherited quota'; end if; end $$;
select set_config('request.jwt.claim.sub','',true);
do $$ begin
 begin perform public.fa_assistant_quota(); raise exception 'Missing identity accepted'; exception when insufficient_privilege then null; end;
end $$;
reset role;
rollback;
