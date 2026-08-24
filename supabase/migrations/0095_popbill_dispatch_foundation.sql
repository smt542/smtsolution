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
