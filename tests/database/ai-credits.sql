begin;
insert into auth.users(id) values ('60000000-0000-4000-8000-000000000001'),('60000000-0000-4000-8000-000000000002');
set local role authenticated;
select set_config('request.jwt.claim.sub','60000000-0000-4000-8000-000000000001',true);
select set_config('request.jwt.claim.role','authenticated',true);
do $$ begin
 if (public.fa_ai_credit_status()->>'balance')::bigint <> 0 then raise exception 'New user has credits'; end if;
 begin perform public.fa_ai_credits('grant',auth.uid(),null,100,'forged-payment'); raise exception 'Client can grant credits'; exception when insufficient_privilege then null; end;
 begin update private.fa_ai_wallets set credits=100; raise exception 'Client can edit wallet'; exception when insufficient_privilege then null; end;
end $$;
reset role;
set local role service_role;
select set_config('request.jwt.claim.role','service_role',true);
select public.fa_ai_credits('grant','60000000-0000-4000-8000-000000000001',null,10,'test-grant-1');
do $$ declare v jsonb; begin
 v:=public.fa_ai_credits('grant','60000000-0000-4000-8000-000000000001',null,10,'test-grant-1');
 if (v->>'balance')::bigint<>10 or v->>'duplicate'<>'true' then raise exception 'Payment replay minted credits';end if;
 begin perform public.fa_ai_credits('grant','60000000-0000-4000-8000-000000000002',null,10,'test-grant-1');raise exception 'Payment reference moved users';exception when raise_exception then if sqlerrm='Payment reference moved users' then raise;end if;end;
 v:=public.fa_ai_credits('reserve','60000000-0000-4000-8000-000000000001','61000000-0000-4000-8000-000000000001',3,'price-1');
 if (v->>'balance')::bigint<>7 or v->>'status'<>'reserved' then raise exception 'Reservation failed';end if;
 v:=public.fa_ai_credits('reserve','60000000-0000-4000-8000-000000000001','61000000-0000-4000-8000-000000000001',3,'price-1');
 if (v->>'balance')::bigint<>7 or v->>'duplicate'<>'true' then raise exception 'Request replay spent credits';end if;
 v:=public.fa_ai_credits('reserve','60000000-0000-4000-8000-000000000001','61000000-0000-4000-8000-000000000002',8,'price-1');
 if v->>'insufficient'<>'true' or (v->>'balance')::bigint<>7 then raise exception 'Wallet overdraft';end if;
 v:=public.fa_ai_credits('complete','60000000-0000-4000-8000-000000000001','61000000-0000-4000-8000-000000000001',null,null,'{"inputTokens":12,"outputTokens":7,"apiKey":"not-stored"}');
 if v->>'status'<>'completed' then raise exception 'Completion failed';end if;
 v:=public.fa_ai_credits('refund','60000000-0000-4000-8000-000000000001','61000000-0000-4000-8000-000000000001');
 if (v->>'balance')::bigint<>7 or v->>'status'<>'completed' then raise exception 'Completed request refunded';end if;
 perform public.fa_ai_credits('reserve','60000000-0000-4000-8000-000000000001','61000000-0000-4000-8000-000000000003',2,'price-1');
 v:=public.fa_ai_credits('refund','60000000-0000-4000-8000-000000000001','61000000-0000-4000-8000-000000000003');
 if (v->>'balance')::bigint<>7 then raise exception 'Refund failed';end if;
 v:=public.fa_ai_credits('refund','60000000-0000-4000-8000-000000000001','61000000-0000-4000-8000-000000000003');
 if (v->>'balance')::bigint<>7 then raise exception 'Double refund';end if;
end $$;
reset role;
do $$ begin
 if (select usage from private.fa_ai_requests where request_id='61000000-0000-4000-8000-000000000001')<>'{"inputTokens":12,"outputTokens":7}'::jsonb then raise exception 'Unexpected usage metadata persisted';end if;
end $$;
set local role authenticated;
select set_config('request.jwt.claim.role','authenticated',true);
select set_config('request.jwt.claim.sub','60000000-0000-4000-8000-000000000002',true);
do $$ begin
 if public.fa_ai_credit_status() <> '{"balance":0,"recentRequests":[]}'::jsonb then raise exception 'Cross-user credit read';end if;
end $$;
select set_config('request.jwt.claim.sub','60000000-0000-4000-8000-000000000001',true);
do $$ begin
 if (public.fa_ai_credit_status()->>'balance')::bigint<>7 or jsonb_array_length(public.fa_ai_credit_status()->'recentRequests')<>2 then raise exception 'Owner credit status incorrect';end if;
end $$;
reset role;
rollback;
