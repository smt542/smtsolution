-- 문자·알림톡 발송 결과 확인을 10초 단위로(2026-10-18 요청).
--
-- 이전: 결과 확인 cron 1분 + 팝빌 접수 후 첫 확인 1분 + 대기 중이면 1분 뒤 재확인
--       → 보낸 뒤 성공 확정(포인트 차감·청구 집계)까지 1~2분.
-- 변경:
--   1) delivery-reconcile cron: 매분 → 10초마다(pg_cron 1.6 초 단위 스케줄).
--   2) 접수 후 첫 결과 확인: 1분 → 10초(mark_message_reservation_provider_pending).
--   3) 접수 후 2분 안에 아직 대기 중이면 10초 뒤 다시 확인(apply_provider_dispatch_results).
--      2분이 지나면 기존 간격(lib/popbill/results.ts computeNextPollAt: 1분 → 5분 → 30분)을 그대로 따른다.
-- 팩스는 결과가 수 분 걸려 기존 1분 간격을 유지한다.
-- 함수 본문의 해당 줄만 현재 정의에서 치환한다(치환 대상이 없으면 중단).

do $migration$
declare
  v_def text;
  v_new text;
begin
  select pg_get_functiondef('public.mark_message_reservation_provider_pending'::regproc) into v_def;
  v_new := replace(v_def,
    'next_poll_at = now() + interval ''1 minute'',',
    'next_poll_at = now() + interval ''10 seconds'',  -- 0327: 첫 결과 확인 10초');
  if v_new = v_def then raise exception '0327: mark_message_reservation_provider_pending 치환 대상 없음'; end if;
  execute v_new;

  select pg_get_functiondef('public.apply_provider_dispatch_results'::regproc) into v_def;
  v_new := regexp_replace(v_def,
    '(v_new_status := ''pending'';\s*update public\.provider_dispatch_jobs\s*set next_poll_at = )p_next_poll_at,',
    '\1case  -- 0327: 접수 2분 안에는 10초 뒤 재확인
        when v_job.submitted_at > now() - interval ''2 minutes''
          then least(p_next_poll_at, now() + interval ''10 seconds'')
        else p_next_poll_at
      end,');
  if v_new = v_def then raise exception '0327: apply_provider_dispatch_results 치환 대상 없음'; end if;
  execute v_new;
end
$migration$;

do $$
begin
  if exists (select 1 from cron.job where jobname = 'delivery-reconcile') then
    perform cron.unschedule('delivery-reconcile');
  end if;
  perform cron.schedule('delivery-reconcile', '10 seconds', 'select public.invoke_delivery_worker(''delivery-reconcile'')');
end $$;
