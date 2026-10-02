-- 0224 동작 프로브(롤백). 마지막 raise는 의도된 롤백이다(아무것도 남지 않는다).
-- 통과 = 오류 메시지가 'OK 0224'로 시작. 'FAIL 0224'면 실패.
-- 1) 옛 인자 호출 호환: PostgREST처럼 이름 붙인 인자로, 새 인자를 생략해 부른다.
-- 2) replay 보호: 작업이 이미 있는 예약에 다른 구성으로 다시 부르면 새 작업·수신자가 생기지 않는다.
-- 실행: node --env-file=C:/Users/leebj/orca/projects/home_erp/.env.local C:/Users/leebj/orca/projects/home_erp/scripts/db-query.mjs <이 파일>
do $$
declare
  v_claimed int;
  v_fax jsonb;
  v_res bigint;
  v_before int;
  v_after int;
  v_ret jsonb;
begin
  perform set_config('request.jwt.claim.role', 'service_role', true);

  select count(*) into v_claimed from public.claim_provider_dispatch_jobs(p_limit => 1);
  v_fax := public.create_fax_dispatch_job(p_bill_issue_id => -1);
  if coalesce(v_fax->>'code', '') <> 'BILL_ISSUE_NOT_FOUND' then
    raise exception 'FAIL 0224 old-call: fax returned % — rolled back', v_fax;
  end if;

  select reservation_id into v_res
    from public.provider_dispatch_jobs
   where kind = 'message' and reservation_id is not null
   order by id limit 1;
  if v_res is null then
    raise exception 'OK 0224 old-call (claim rows %), replay SKIPPED: no message reservation with jobs — rolled back', v_claimed;
  end if;
  select count(*) into v_before from public.provider_dispatch_jobs where reservation_id = v_res;
  v_ret := public.create_provider_dispatch_jobs(v_res, jsonb_build_array(jsonb_build_object(
    'product', 'sms', 'request_num', 'probe' || v_res || 'x9', 'schedule_id', null, 'provider_env', 'live',
    'recipients', jsonb_build_array(jsonb_build_object('recipient_key', 'probe-key', 'provider_ref_key', 'probe-ref'))
  )));
  select count(*) into v_after from public.provider_dispatch_jobs where reservation_id = v_res;

  if v_after = v_before and jsonb_array_length(v_ret->'jobs') = v_before then
    raise exception 'OK 0224 (old-call claim rows %, replay jobs % → %) — rolled back', v_claimed, v_before, v_after;
  end if;
  raise exception 'FAIL 0224 replay (jobs % → %, returned %) — rolled back',
    v_before, v_after, jsonb_array_length(coalesce(v_ret->'jobs', '[]'::jsonb));
end $$;
