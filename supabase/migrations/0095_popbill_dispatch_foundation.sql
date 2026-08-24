-- Popbill 전환 1/3: 공급자 발송 작업·수신자 매핑 기반
-- 의존: 0000(organizations), 0010(message_logs), 0032(message_schedules, bill_issues),
--       0037(message_point_reservations)
--
-- Popbill 접수번호(receipt)는 성공 결과가 아니라 "접수됨"을 뜻한다. 이 테이블은 접수 이후
-- 최종 결과(state=3/result=100)를 재조회해 확정하기 위한 원장이다. 개인정보(전화번호·문서)는
-- 저장하지 않고, 정산·지원에 필요한 접수번호·수신자 키·상태·오류 코드·페이지 수만 남긴다.

-- ===== 발송 작업 =====
create table public.provider_dispatch_jobs (
  id bigint generated always as identity primary key,
  org_id bigint not null references public.organizations(id) on delete restrict,
  provider text not null default 'popbill' check (provider in ('popbill')),
  kind text not null check (kind in ('message', 'fax')),
  product text not null check (product in ('sms', 'lms', 'alimtalk', 'fax')),
  -- 메시지 작업은 포인트 예약/로그와, 팩스 작업은 고지서 발행 건과 연결된다.
  reservation_id bigint references public.message_point_reservations(id) on delete restrict,
  message_log_id bigint references public.message_logs(id) on delete restrict,
  schedule_id bigint references public.message_schedules(id) on delete set null,
  bill_issue_id bigint references public.bill_issues(id) on delete restrict,
  -- ERP 고유 요청번호(36자 이하, 재시도 중복 접수 방지 기준)와 Popbill 접수번호.
  request_num text not null check (length(request_num) between 1 and 36),
  receipt_num text,
  status text not null default 'submitting'
    check (status in ('submitting', 'pending', 'sent', 'partial', 'failed', 'reconcile_required')),
  next_poll_at timestamptz,
  lease_until timestamptz,
  poll_attempts integer not null default 0 check (poll_attempts >= 0),
  last_error_code text,
  last_error_message text,
  -- 팩스 전용 페이지 집계(문자는 null). success_page_count가 월 청구의 원장이다.
  send_page_count integer check (send_page_count is null or send_page_count >= 0),
  success_page_count integer check (success_page_count is null or success_page_count >= 0),
  fail_page_count integer check (fail_page_count is null or fail_page_count >= 0),
  charge_page_count integer check (charge_page_count is null or charge_page_count >= 0),
  refund_page_count integer check (refund_page_count is null or refund_page_count >= 0),
  created_at timestamptz not null default now(),
  submitted_at timestamptz,
  completed_at timestamptz,
  updated_at timestamptz not null default now(),
  -- kind/product 정합성
  constraint provider_dispatch_jobs_kind_product_check check (
    (kind = 'fax' and product = 'fax')
    or (kind = 'message' and product in ('sms', 'lms', 'alimtalk'))
  ),
  -- 참조 정합성: 메시지 작업은 예약, 팩스 작업은 고지서 건을 반드시 가진다.
  constraint provider_dispatch_jobs_ref_check check (
    (kind = 'message' and reservation_id is not null)
    or (kind = 'fax' and bill_issue_id is not null)
  ),
  -- 요청번호 유일. 접수번호는 접수 후 provider 범위에서 유일.
  constraint provider_dispatch_jobs_request_num_key unique (request_num),
  constraint provider_dispatch_jobs_receipt_num_key unique (provider, receipt_num)
);

create index provider_dispatch_jobs_poll_idx
  on public.provider_dispatch_jobs(status, next_poll_at)
  where status = 'pending';
create index provider_dispatch_jobs_reservation_idx
  on public.provider_dispatch_jobs(reservation_id)
  where reservation_id is not null;
create index provider_dispatch_jobs_message_log_idx
  on public.provider_dispatch_jobs(message_log_id)
  where message_log_id is not null;
create index provider_dispatch_jobs_schedule_idx
  on public.provider_dispatch_jobs(schedule_id)
  where schedule_id is not null;
create index provider_dispatch_jobs_bill_issue_idx
  on public.provider_dispatch_jobs(bill_issue_id)
  where bill_issue_id is not null;
create index provider_dispatch_jobs_org_created_idx
  on public.provider_dispatch_jobs(org_id, created_at desc);

create trigger trg_provider_dispatch_jobs_updated
  before update on public.provider_dispatch_jobs
  for each row execute function public.set_updated_at();

-- ===== 수신자 매핑 =====
create table public.provider_dispatch_recipients (
  id bigint generated always as identity primary key,
  job_id bigint not null references public.provider_dispatch_jobs(id) on delete cascade,
  -- 원본 수신자 키(전화번호 해시 등, 64자)와 Popbill interOPRefKey(결정적, 20자 이하).
  recipient_key text not null check (length(recipient_key) between 1 and 64),
  provider_ref_key text not null check (length(provider_ref_key) between 1 and 20),
  product text not null check (product in ('sms', 'lms', 'alimtalk', 'fax')),
  status text not null default 'pending' check (status in ('pending', 'success', 'failed')),
  result_code text,
  result_message text,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  constraint provider_dispatch_recipients_key_unique unique (job_id, recipient_key),
  constraint provider_dispatch_recipients_ref_unique unique (job_id, provider_ref_key)
);

create index provider_dispatch_recipients_job_idx
  on public.provider_dispatch_recipients(job_id);

-- ===== 상태 전이 가드 =====
-- submitting -> pending -> sent | partial | failed
--                     \-> reconcile_required (-> sent | partial | failed)
create or replace function public.provider_dispatch_job_status_guard()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status = old.status then
    return new;
  end if;
  if old.status = 'submitting'
     and new.status in ('pending', 'failed', 'reconcile_required') then
    return new;
  end if;
  if old.status = 'pending'
     and new.status in ('sent', 'partial', 'failed', 'reconcile_required') then
    return new;
  end if;
  if old.status = 'reconcile_required'
     and new.status in ('sent', 'partial', 'failed') then
    return new;
  end if;
  raise exception 'invalid provider dispatch status transition: % -> %', old.status, new.status
    using errcode = '22023';
end
$$;
revoke all on function public.provider_dispatch_job_status_guard() from public;

create trigger trg_provider_dispatch_jobs_status_guard
  before update of status on public.provider_dispatch_jobs
  for each row execute function public.provider_dispatch_job_status_guard();

create or replace function public.provider_dispatch_recipient_status_guard()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status = old.status then
    return new;
  end if;
  if old.status = 'pending' and new.status in ('success', 'failed') then
    return new;
  end if;
  raise exception 'invalid provider dispatch recipient transition: % -> %', old.status, new.status
    using errcode = '22023';
end
$$;
revoke all on function public.provider_dispatch_recipient_status_guard() from public;

create trigger trg_provider_dispatch_recipients_status_guard
  before update of status on public.provider_dispatch_recipients
  for each row execute function public.provider_dispatch_recipient_status_guard();

-- ===== RLS: 직접 쓰기 차단, 플랫폼 관리자 읽기만 =====
alter table public.provider_dispatch_jobs enable row level security;
alter table public.provider_dispatch_recipients enable row level security;

revoke insert, update, delete, truncate on public.provider_dispatch_jobs
  from anon, authenticated;
revoke insert, update, delete, truncate on public.provider_dispatch_recipients
  from anon, authenticated;

create policy provider_dispatch_jobs_platform_select
  on public.provider_dispatch_jobs
  for select to authenticated
  using (public.current_user_is_platform_admin());
create policy provider_dispatch_recipients_platform_select
  on public.provider_dispatch_recipients
  for select to authenticated
  using (public.current_user_is_platform_admin());

grant select, insert, update on public.provider_dispatch_jobs to service_role;
grant select, insert, update on public.provider_dispatch_recipients to service_role;

-- ===== 결과 조회 대상 claim (service_role) =====
-- next_poll_at 도래 + 만료 lease를 FOR UPDATE SKIP LOCKED로 임대하고 5분 lease를 건다.
create or replace function public.claim_provider_dispatch_jobs(p_limit integer default 50)
returns setof public.provider_dispatch_jobs
language plpgsql
security definer
set search_path = ''
as $$
begin
  if coalesce((select auth.role()), '') <> 'service_role' then
    raise exception 'forbidden: service role required' using errcode = '42501';
  end if;

  return query
  with due as (
    select job.id
    from public.provider_dispatch_jobs job
    where job.status = 'pending'
      and job.next_poll_at is not null
      and job.next_poll_at <= now()
      and (job.lease_until is null or job.lease_until <= now())
    order by job.next_poll_at
    for update skip locked
    limit greatest(1, coalesce(p_limit, 50))
  )
  update public.provider_dispatch_jobs job
    set lease_until = now() + interval '5 minutes',
        poll_attempts = job.poll_attempts + 1
    from due
    where job.id = due.id
    returning job.*;
end
$$;
revoke all on function public.claim_provider_dispatch_jobs(integer)
  from public, anon, authenticated;
grant execute on function public.claim_provider_dispatch_jobs(integer) to service_role;

-- ===== 고지서 팩스 상태 확장 + 서버 문서 로드(Task 8) =====
-- 팩스/카톡 발송 상태에 queued|partial 추가. 과거 none/scheduled/sent/failed 행과 호환.
alter table public.bill_issues drop constraint if exists bill_issues_send_status_check;
alter table public.bill_issues add constraint bill_issues_send_status_check
  check (send_status in ('none', 'scheduled', 'queued', 'sent', 'partial', 'failed'));

-- 팩스 PDF 생성을 위한 서버 권위 데이터. 클라이언트가 보낸 금액/계좌/이름을 신뢰하지 않고
-- 확정 관리비·조직 설정에서 다시 조회한다. 조직 소유·bill_publish 권한을 검증한다.
create or replace function public.load_fax_document(p_bill_issue_id bigint)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_org bigint;
  v_result jsonb;
begin
  v_org := public.current_user_org();
  if v_org is null then
    raise exception 'no org for caller' using errcode = '42501';
  end if;
  if not public.current_user_has_module('bill_publish') then
    raise exception 'forbidden: bill_publish required' using errcode = '42501';
  end if;

  select jsonb_build_object(
    'bill_issue_id', bi.id,
    'org_id', b.org_id,
    'company_name', org.name,
    'building', jsonb_build_object('id', b.id, 'name', b.name, 'address', b.address),
    'unit_id', u.id,
    'unit_no', u.unit_no,
    'dong', u.dong,
    'period', to_char(bi.period, 'YYYY-MM'),
    'tenant_name', o.tenant_name,
    'payer_name', o.payer_name,
    'payer_no', ua.payer_no,
    'bill_name_display', coalesce(o.bill_name_display, bi.unit_label_mode, 'name'),
    'phone', o.phone,
    'fax_number', o.fax_number,
    'auto_debit', bi.auto_debit,
    'amount', bc.total_amount,
    'items', coalesce(bh.items, '[]'::jsonb),
    'unit_notice', bc.unit_notice,
    'customer_notice', sc.customer_notice,
    'due_date', to_char(bi.due_date, 'YYYY-MM-DD'),
    'mgmt_bank1', sc.mgmt_bank1, 'mgmt_acct1', sc.mgmt_acct1, 'mgmt_holder1', sc.mgmt_holder1,
    'mgmt_print1', coalesce(sc.mgmt_print1, false),
    'mgmt_bank2', sc.mgmt_bank2, 'mgmt_acct2', sc.mgmt_acct2, 'mgmt_holder2', sc.mgmt_holder2,
    'mgmt_print2', coalesce(sc.mgmt_print2, false)
  )
  into v_result
  from public.bill_issues bi
  join public.units u on u.id = bi.unit_id and u.deleted_at is null
  join public.buildings b on b.id = u.building_id and b.org_id = v_org
  join public.billing_confirmations bc
    on bc.unit_id = u.id and bc.period = bi.period and bc.confirmed_at is not null
  left join public.occupancies o on o.id = bi.occupancy_id
  left join public.unit_accounts ua on ua.unit_id = u.id and ua.kind = 'mgmt'
  left join lateral (
    select h.items from public.billing_history h
    where h.unit_id = u.id and h.period = bi.period
    order by h.confirmed_at desc, h.id desc limit 1
  ) bh on true
  left join public.setup_config sc on sc.org_id = v_org
  join public.organizations org on org.id = v_org
  where bi.id = p_bill_issue_id and bi.issue_type = 'fax';

  if v_result is null then
    return jsonb_build_object('ok', false, 'code', 'BILL_ISSUE_NOT_FOUND');
  end if;
  return jsonb_build_object('ok', true) || v_result;
end
$$;
revoke all on function public.load_fax_document(bigint) from public, anon;
grant execute on function public.load_fax_document(bigint) to authenticated;

-- ===== 팩스 작업 생성/접수 반영(service_role) =====
-- 세대별(고지서별) 독립 작업. 재시도는 새 attempt(append-only)로 만든다(기존 작업 덮어쓰기 없음).
create or replace function public.create_fax_dispatch_job(p_bill_issue_id bigint)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_org bigint;
  v_attempt integer;
  v_request text;
  v_job_id bigint;
begin
  if coalesce((select auth.role()), '') <> 'service_role' then
    raise exception 'forbidden: service role required' using errcode = '42501';
  end if;

  select b.org_id into v_org
  from public.bill_issues bi
  join public.units u on u.id = bi.unit_id
  join public.buildings b on b.id = u.building_id
  where bi.id = p_bill_issue_id and bi.issue_type = 'fax';
  if v_org is null then
    return jsonb_build_object('ok', false, 'code', 'BILL_ISSUE_NOT_FOUND');
  end if;

  select count(*) into v_attempt from public.provider_dispatch_jobs where bill_issue_id = p_bill_issue_id;
  v_request := 'f' || p_bill_issue_id || 'a' || v_attempt;

  insert into public.provider_dispatch_jobs(
    org_id, provider, kind, product, bill_issue_id, request_num, status
  ) values (
    v_org, 'popbill', 'fax', 'fax', p_bill_issue_id, v_request, 'submitting'
  ) returning id into v_job_id;

  insert into public.provider_dispatch_recipients(job_id, recipient_key, provider_ref_key, product)
    values (v_job_id, v_request, v_request, 'fax');

  return jsonb_build_object('ok', true, 'job_id', v_job_id, 'request_num', v_request, 'provider_ref_key', v_request);
end
$$;
revoke all on function public.create_fax_dispatch_job(bigint) from public, anon, authenticated;
grant execute on function public.create_fax_dispatch_job(bigint) to service_role;

-- 접수 결과 반영: accepted→pending(고지서 queued), unknown→reconcile_required(queued), failed→실패.
create or replace function public.mark_fax_dispatch_result(
  p_job_id bigint,
  p_outcome text,
  p_receipt_num text default null,
  p_error_code text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
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
    update public.provider_dispatch_jobs
      set status = 'reconcile_required', last_error_code = p_error_code where id = p_job_id;
    update public.bill_issues set send_status = 'queued' where id = v_job.bill_issue_id;
  else
    update public.provider_dispatch_jobs
      set status = 'failed', completed_at = now(), last_error_code = p_error_code where id = p_job_id;
    update public.provider_dispatch_recipients
      set status = 'failed', completed_at = now() where job_id = p_job_id and status = 'pending';
    update public.bill_issues set send_status = 'failed' where id = v_job.bill_issue_id;
  end if;

  return jsonb_build_object('ok', true, 'outcome', p_outcome);
end
$$;
revoke all on function public.mark_fax_dispatch_result(bigint, text, text, text)
  from public, anon, authenticated;
grant execute on function public.mark_fax_dispatch_result(bigint, text, text, text) to service_role;
