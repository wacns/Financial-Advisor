begin;
insert into auth.users(id) values ('10000000-0000-4000-8000-000000000001'),('10000000-0000-4000-8000-000000000002'),('10000000-0000-4000-8000-000000000003');
create temporary table shared_test_state(key text primary key,value jsonb);
grant all on shared_test_state to authenticated;
set local role authenticated;
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000001',true);
insert into shared_test_state values ('account',public.fa_shared('create','{"id":"20000000-0000-4000-8000-000000000001","name":"Test household","currency":"BHD","opening":10,"display_name":"Test owner"}'));
insert into shared_test_state values ('viewer',public.fa_shared('invite','{"account_id":"20000000-0000-4000-8000-000000000001","role":"viewer"}'));
insert into shared_test_state values ('editor',public.fa_shared('invite','{"account_id":"20000000-0000-4000-8000-000000000001","role":"editor"}'));
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000003',true);
do $$ begin
 if (select count(*) from public.fa_shared_accounts)<>0 then raise exception 'Unrelated user can read shared accounts'; end if;
 begin perform public.fa_shared('snapshot','{"account_id":"20000000-0000-4000-8000-000000000001"}');raise exception 'Unrelated user can read account snapshot';exception when insufficient_privilege then null;end;
end $$;
select public.fa_shared('accept',jsonb_build_object('token',(select value->>'token' from shared_test_state where key='viewer'),'display_name','Test viewer'));
do $$ begin
 if (select count(*) from public.fa_shared_accounts)<>1 then raise exception 'Accepted viewer cannot read account';end if;
 begin perform public.fa_shared('save_transaction','{"account_id":"20000000-0000-4000-8000-000000000001","id":"30000000-0000-4000-8000-000000000001","name":"Viewer change","amount":1,"type":"expense","date":"2026-10-18"}');raise exception 'Viewer can write';exception when insufficient_privilege then null;end;
 begin perform public.fa_shared('invite','{"account_id":"20000000-0000-4000-8000-000000000001","role":"editor"}');raise exception 'Viewer can invite';exception when insufficient_privilege then null;end;
 begin insert into public.fa_shared_members(account_id,user_id,role,display_name)values('20000000-0000-4000-8000-000000000001',auth.uid(),'owner','Escalation');raise exception 'Direct membership mutation allowed';exception when insufficient_privilege then null;end;
end $$;
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000002',true);
select public.fa_shared('accept',jsonb_build_object('token',(select value->>'token' from shared_test_state where key='editor'),'display_name','Test editor'));
select public.fa_shared('save_transaction','{"account_id":"20000000-0000-4000-8000-000000000001","id":"30000000-0000-4000-8000-000000000001","name":"Shared coffee","amount":0.001,"type":"expense","date":"2026-10-18","labels":["Test"]}');
select public.fa_shared('save_transaction','{"account_id":"20000000-0000-4000-8000-000000000001","id":"30000000-0000-4000-8000-000000000001","name":"Shared coffee","amount":0.001,"type":"expense","date":"2026-10-18","labels":["Test"]}');
do $$ begin
 if (public.fa_shared('snapshot','{"account_id":"20000000-0000-4000-8000-000000000001"}')#>>'{account,balance}')::numeric<>9.999 then raise exception 'Duplicate request changed balance';end if;
 begin perform public.fa_shared('save_transaction','{"account_id":"20000000-0000-4000-8000-000000000001","id":"30000000-0000-4000-8000-000000000001","expected_revision":0,"name":"Stale edit","amount":2,"type":"expense","date":"2026-10-18"}');raise exception 'Stale edit accepted';exception when serialization_failure then null;end;
end $$;
select public.fa_shared('save_transaction','{"account_id":"20000000-0000-4000-8000-000000000001","id":"30000000-0000-4000-8000-000000000001","expected_revision":1,"name":"Updated coffee","amount":0.002,"type":"expense","date":"2026-10-18"}');
select public.fa_shared('delete_transaction','{"account_id":"20000000-0000-4000-8000-000000000001","id":"30000000-0000-4000-8000-000000000001","expected_revision":2}');
do $$ begin if (public.fa_shared('snapshot','{"account_id":"20000000-0000-4000-8000-000000000001"}')#>>'{account,balance}')::numeric<>10 then raise exception 'Deletion did not restore balance';end if;end $$;
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000001',true);
select public.fa_shared('remove_member','{"account_id":"20000000-0000-4000-8000-000000000001","user_id":"10000000-0000-4000-8000-000000000002"}');
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000002',true);
do $$ begin
 if (select count(*) from public.fa_shared_accounts)<>0 then raise exception 'Revoked editor can still read';end if;
 begin perform public.fa_shared('snapshot','{"account_id":"20000000-0000-4000-8000-000000000001"}');raise exception 'Revoked editor can query';exception when insufficient_privilege then null;end;
 begin perform public.fa_shared('accept',jsonb_build_object('token',(select value->>'token' from shared_test_state where key='viewer'),'display_name','Reuse'));raise exception 'Redeemed invite reused';exception when raise_exception then if sqlerrm='Redeemed invite reused' then raise;end if;end;
end $$;
reset role;
rollback;
