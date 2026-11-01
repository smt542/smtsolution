-- 0340: 팩스 발송 결과 추적 보강 (2026-11-01 QA #25)
--
-- 1) mark_fax_dispatch_result(unknown): 접수 응답 없이 타임아웃된 작업에 next_poll_at을 지정해
--    delivery-reconcile이 요청번호(GetFaxResultRN)로 접수 여부를 확인하게 한다.
--    (이전에는 reconcile_required + next_poll_at null로 영구히 남아 같은 고지서 재발송을 ALREADY_IN_FLIGHT로 막았다.)
-- 2) apply_fax_dispatch_result: p_error_code(통신사 결과코드·NOT_ACCEPTED 등)를 last_error_code에 저장하고,
--    p_receipt_num(요청번호 조회로 회수한 접수번호)을 저장한다. reconcile_required 작업도 결과를 반영한다.
--    기존 8인자 호출(배포 전 Edge)은 새 인자의 기본값(null)으로 그대로 동작한다.
-- 3) 이미 고착된 작업(receipt 없음·next_poll_at null·reconcile_required)을 즉시 재조회 대상으로 돌린다.
--    재조회에서 요청번호가 팝빌에 없으면 failed(NOT_ACCEPTED)로 마감돼 재발송이 허용된다.

begin;

create or replace function public.mark_fax_dispatch_result(p_job_id bigint, p_outcome text, p_receipt_num text default null::text, p_error_code text default null::text)
 returns jsonb
 language plpgsql
 security definer
 set search_path to ''
as $function$
declare
  v_job public.provider_dispatch_jobs%rowtype;
begin
  if coalesce((select auth.role()), '') <> 'service_role' then
    raise exception 'forbidden: service role required' using errcode = '42501';
  end if;
  select * into v_job from public.provider_dispatch_jobs where id = p_job_id for update;
  if not found then return jsonb_build_object('ok', false, 'code', 'JOB_NOT_FOUND'); end if;

  if p_outcome = 'accepted' then
    update public.provider_dispatch_jobs
      set receipt_num = p_receipt_num, status = 'pending', submitted_at = now(),
          next_poll_at = now() + interval '1 minute', last_error_code = null, last_error_message = null
      where id = p_job_id;
    update public.bill_issues set send_status = 'queued' where id = v_job.bill_issue_id;
  elsif p_outcome = 'unknown' then
    -- 접수 receipt가 없어 결과가 불명확하다. queued(성공 접수)로 표기하지 않는다 — queued는 accepted receipt를
    -- 받은 경우에만 쓴다. job.reconcile_required가 재조회/수동 확인의 원장이며 bill_issues 상태는 건드리지 않는다.
    -- 0340: 1분 뒤 요청번호로 재조회하도록 next_poll_at을 지정한다(영구 고착 방지).
    update public.provider_dispatch_jobs
      set status = 'reconcile_required', last_error_code = p_error_code,
          next_poll_at = now() + interval '1 minute', lease_until = null
      where id = p_job_id;
  else
    update public.provider_dispatch_jobs
      set status = 'failed', completed_at = now(), last_error_code = p_error_code where id = p_job_id;
    update public.provider_dispatch_recipients
      set status = 'failed', completed_at = now() where job_id = p_job_id and status = 'pending';
    update public.bill_issues set send_status = 'failed' where id = v_job.bill_issue_id;
  end if;

  return jsonb_build_object('ok', true, 'outcome', p_outcome);
end
$function$;

drop function if exists public.apply_fax_dispatch_result(bigint, text, integer, integer, integer, integer, integer, timestamp with time zone);

create or replace function public.apply_fax_dispatch_result(
  p_job_id bigint,
  p_status text,
  p_send_pages integer,
  p_success_pages integer,
  p_fail_pages integer,
  p_charge_pages integer,
  p_refund_pages integer,
  p_next_poll_at timestamp with time zone,
  p_error_code text default null,
  p_receipt_num text default null
)
 returns jsonb
 language plpgsql
 security definer
 set search_path to ''
as $function$
declare
  v_job public.provider_dispatch_jobs%rowtype;
  v_receipt text;
begin
  if coalesce((select auth.role()), '') <> 'service_role' then
    raise exception 'forbidden: service role required' using errcode = '42501';
  end if;
  select * into v_job from public.provider_dispatch_jobs where id = p_job_id for update;
  if not found then return jsonb_build_object('ok', false, 'code', 'JOB_NOT_FOUND'); end if;
  -- 0340: 접수 응답 없이 타임아웃된 작업(reconcile_required)도 재조회 결과를 반영한다.
  if v_job.status not in ('pending', 'reconcile_required') then
    return jsonb_build_object('ok', true, 'replayed', true, 'job_status', v_job.status);
  end if;

  -- 요청번호 조회로 회수한 접수번호(기존 접수번호는 덮어쓰지 않는다).
  v_receipt := coalesce(v_job.receipt_num, nullif(p_receipt_num, ''));
  if v_job.receipt_num is null and v_receipt is not null then
    update public.provider_dispatch_jobs
      set receipt_num = v_receipt, submitted_at = coalesce(submitted_at, now())
      where id = p_job_id;
  end if;

  if p_status in ('sent', 'partial', 'failed') then
    update public.provider_dispatch_jobs
      set status = p_status, completed_at = now(), next_poll_at = null, lease_until = null,
          send_page_count = p_send_pages, success_page_count = p_success_pages,
          fail_page_count = p_fail_pages, charge_page_count = p_charge_pages, refund_page_count = p_refund_pages,
          last_error_code = case when p_status = 'sent' then null
                                 else coalesce(nullif(p_error_code, ''), last_error_code) end,
          last_error_message = case when p_status = 'sent' then null else last_error_message end
      where id = p_job_id;
    update public.provider_dispatch_recipients
      set status = case when p_status = 'failed' then 'failed' else 'success' end, completed_at = now()
      where job_id = p_job_id and status = 'pending';
    update public.bill_issues set send_status = p_status where id = v_job.bill_issue_id;
    if coalesce(p_success_pages, 0) > 0 then
      insert into public.point_transactions(org_id, type, points, memo)
      select v_job.org_id, 'usage', -(p_success_pages * rate.points),
             '팩스 발송 · ' || p_success_pages || '장 · job ' || v_job.id
      from public.message_point_rates rate
      where rate.channel = 'fax' and rate.effective_to is null;
    end if;
  elsif p_next_poll_at is null then
    update public.provider_dispatch_jobs
      set status = 'reconcile_required', next_poll_at = null, lease_until = null,
          send_page_count = p_send_pages, success_page_count = p_success_pages,
          fail_page_count = p_fail_pages, charge_page_count = p_charge_pages, refund_page_count = p_refund_pages
      where id = p_job_id;
  else
    -- 타임아웃 작업이 팝빌 접수로 확인되면(접수번호 회수) 일반 결과 대기(pending)로 돌린다.
    update public.provider_dispatch_jobs
      set status = case when v_job.status = 'reconcile_required' and v_receipt is not null then 'pending' else status end,
          next_poll_at = p_next_poll_at, lease_until = null,
          send_page_count = p_send_pages, success_page_count = p_success_pages,
          fail_page_count = p_fail_pages, charge_page_count = p_charge_pages, refund_page_count = p_refund_pages
      where id = p_job_id;
    if v_job.status = 'reconcile_required' and v_job.receipt_num is null and v_receipt is not null then
      update public.bill_issues set send_status = 'queued' where id = v_job.bill_issue_id;
    end if;
  end if;

  return jsonb_build_object('ok', true, 'job_status',
    case when p_status in ('sent', 'partial', 'failed') then p_status
         when p_next_poll_at is null then 'reconcile_required'
         when v_job.status = 'reconcile_required' and v_receipt is null then 'reconcile_required'
         else 'pending' end);
end
$function$;

revoke all on function public.apply_fax_dispatch_result(bigint, text, integer, integer, integer, integer, integer, timestamp with time zone, text, text) from public, anon, authenticated;
grant execute on function public.apply_fax_dispatch_result(bigint, text, integer, integer, integer, integer, integer, timestamp with time zone, text, text) to service_role;

-- 3) 고착 작업 재조회 예약(receipt 없음·next_poll_at 없음). 2026-11-01 기준 job 2012(bill_issue 147, test) 1건.
update public.provider_dispatch_jobs
  set next_poll_at = now(), lease_until = null
  where kind = 'fax' and status = 'reconcile_required' and receipt_num is null and next_poll_at is null;

commit;
