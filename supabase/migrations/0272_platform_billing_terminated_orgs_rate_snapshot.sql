-- 개선3차 37·41·43: 본사 청구·대시보드
-- 37) 해지(organizations.deleted_at) 조직도 「그 달 발송량 또는 청구서가 있으면」 사용량·청구 집계에 포함한다.
--     platform_org_usage 마지막 필터를 바꾸면 platform_get_overview_metrics·platform_get_monthly_send_cost는
--     정의 변경 없이 따라온다(둘 다 platform_org_usage 결과에 invoice를 left join).
--     platform_list_org_billing은 deleted_at 필터 제거 + 전월 사용량 left join + 해지 여부(org_terminated) 반환.
-- 41) platform_billing_invoices에 단가 스냅샷(rate_krw_alimtalk/sms/lms/fax, vat_rate) 추가.
--     입금 확인(platform_mark_org_billing_paid) 때 저장하고, 목록은 「청구서 스냅샷 → 없으면 현재 설정」 단가를 반환한다.
--     기존 청구서는 저장 금액÷건수가 나누어떨어지는 채널만 단가를 역산해 백필(나머지는 null → 현재 설정 단가 표시).
-- 43) 진행 중인 달(서울 기준 이번 달 이후)은 입금 확인을 거절한다(22023, hint BILLING_MONTH_IN_PROGRESS). 입금 취소는 허용.

begin;

-- 41: 단가 스냅샷 컬럼
alter table public.platform_billing_invoices
  add column if not exists rate_krw_alimtalk integer,
  add column if not exists rate_krw_sms integer,
  add column if not exists rate_krw_lms integer,
  add column if not exists rate_krw_fax integer,
  add column if not exists vat_rate numeric;

comment on column public.platform_billing_invoices.rate_krw_alimtalk is '입금 확인 시점 알림톡 청구 단가 스냅샷(null=기록 없음 → 현재 설정 단가 표시)';
comment on column public.platform_billing_invoices.rate_krw_sms is '입금 확인 시점 SMS 청구 단가 스냅샷';
comment on column public.platform_billing_invoices.rate_krw_lms is '입금 확인 시점 LMS 청구 단가 스냅샷';
comment on column public.platform_billing_invoices.rate_krw_fax is '입금 확인 시점 팩스(페이지) 청구 단가 스냅샷';
comment on column public.platform_billing_invoices.vat_rate is '입금 확인 시점 부가세율(%) 스냅샷';

-- 41: 기존 청구서 백필 — 저장 금액에서 정확히 역산되는 단가만
update public.platform_billing_invoices invoice
set
  rate_krw_alimtalk = case
    when invoice.alimtalk_count > 0 and invoice.alimtalk_amount_krw % invoice.alimtalk_count = 0
      then (invoice.alimtalk_amount_krw / invoice.alimtalk_count)::int end,
  rate_krw_sms = case
    when invoice.sms_count > 0 and invoice.lms_count = 0 and invoice.sms_amount_krw % invoice.sms_count = 0
      then (invoice.sms_amount_krw / invoice.sms_count)::int end,
  rate_krw_lms = case
    when invoice.lms_count > 0 and invoice.sms_count = 0 and invoice.sms_amount_krw % invoice.lms_count = 0
      then (invoice.sms_amount_krw / invoice.lms_count)::int end,
  rate_krw_fax = case
    when invoice.fax_page_count > 0 and invoice.fax_amount_krw % invoice.fax_page_count = 0
      then (invoice.fax_amount_krw / invoice.fax_page_count)::int end,
  vat_rate = case
    when invoice.subtotal_krw > 0
      and round(invoice.subtotal_krw * setting.vat_rate / 100)::bigint = invoice.vat_krw
      then setting.vat_rate end
from public.platform_settings setting
where setting.id = 1
  and invoice.rate_krw_alimtalk is null
  and invoice.rate_krw_sms is null
  and invoice.rate_krw_lms is null
  and invoice.rate_krw_fax is null
  and invoice.vat_rate is null;

-- 37: platform_org_usage — 해지 조직은 그 달 발송량 또는 청구서가 있을 때만 포함
CREATE OR REPLACE FUNCTION public.platform_org_usage(p_month date)
 RETURNS TABLE(org_id bigint, sms_count integer, lms_count integer, alimtalk_count integer, fax_pages integer, fax_sends integer)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  with bounds as (
    select
      (date_trunc('month', p_month)::date)::timestamp at time zone 'Asia/Seoul' as from_ts,
      ((date_trunc('month', p_month)::date + interval '1 month'))::timestamp at time zone 'Asia/Seoul' as to_ts
  ),
  new_msg as (
    select ml.org_id,
      count(*) filter (where rec.product = 'sms' and rec.status = 'success')::int as sms_count,
      count(*) filter (where rec.product = 'lms' and rec.status = 'success')::int as lms_count,
      count(*) filter (where rec.product = 'alimtalk' and rec.status = 'success')::int as alimtalk_count
    from public.message_logs ml
    cross join bounds
    join public.provider_dispatch_jobs job on job.message_log_id = ml.id and job.kind = 'message'
    join public.provider_dispatch_recipients rec on rec.job_id = job.id
    where ml.sent_at >= bounds.from_ts and ml.sent_at < bounds.to_ts
    group by ml.org_id
  ),
  legacy_msg as (
    select ml.org_id,
      sum(
        case when ml.channel = 'sms' then ml.recipient_count else 0 end
        + case when ml.channel = 'auto' then (
            select count(*)::int from jsonb_array_elements(ml.recipients) r(v) where r.v->>'channel' = 'sms'
          ) else 0 end
      )::int as sms_count,
      0::int as lms_count,
      sum(
        case when ml.channel = 'alimtalk' then ml.recipient_count else 0 end
        + case when ml.channel = 'auto' then (
            select count(*)::int from jsonb_array_elements(ml.recipients) r(v) where r.v->>'channel' = 'alimtalk'
          ) else 0 end
      )::int as alimtalk_count
    from public.message_logs ml
    cross join bounds
    where ml.sent_at >= bounds.from_ts and ml.sent_at < bounds.to_ts
      and ml.result in ('sent', 'partial')
      and not exists (select 1 from public.provider_dispatch_jobs job where job.message_log_id = ml.id)
    group by ml.org_id
  ),
  new_fax as (
    select building.org_id,
      coalesce(sum(coalesce(job.success_page_count, 0)), 0)::int as fax_pages,
      count(*)::int as fax_sends
    from public.provider_dispatch_jobs job
    cross join bounds
    join public.bill_issues bi on bi.id = job.bill_issue_id
    join public.units unit on unit.id = bi.unit_id
    join public.buildings building on building.id = unit.building_id
    where job.kind = 'fax' and job.status in ('sent', 'partial')
      -- 각 팩스 job은 자기 자신의 접수 시각으로 귀속한다(bill_issues.issued_at 아님).
      -- issued_at 기준이면 재발행이 issued_at을 갱신할 때 과거 성공 job이 늦은 달로 이동하거나
      -- 이미 확정된 이전 청구서를 이중 계상할 수 있다. 재시도는 새 job(자체 submitted_at)이라 각자 달에 남는다.
      and coalesce(job.submitted_at, job.completed_at, job.created_at) >= bounds.from_ts
      and coalesce(job.submitted_at, job.completed_at, job.created_at) < bounds.to_ts
    group by building.org_id
  ),
  legacy_fax as (
    select building.org_id, count(*)::int as fax_pages, count(*)::int as fax_sends
    from public.bill_issues bi
    cross join bounds
    join public.units unit on unit.id = bi.unit_id
    join public.buildings building on building.id = unit.building_id
    where bi.issue_type = 'fax' and bi.send_status = 'sent'
      and bi.issued_at >= bounds.from_ts and bi.issued_at < bounds.to_ts
      and not exists (select 1 from public.provider_dispatch_jobs job where job.bill_issue_id = bi.id)
    group by building.org_id
  )
  select
    organization.id,
    (coalesce(nm.sms_count, 0) + coalesce(lm.sms_count, 0))::int,
    (coalesce(nm.lms_count, 0) + coalesce(lm.lms_count, 0))::int,
    (coalesce(nm.alimtalk_count, 0) + coalesce(lm.alimtalk_count, 0))::int,
    (coalesce(nf.fax_pages, 0) + coalesce(lf.fax_pages, 0))::int,
    (coalesce(nf.fax_sends, 0) + coalesce(lf.fax_sends, 0))::int
  from public.organizations organization
  left join new_msg nm on nm.org_id = organization.id
  left join legacy_msg lm on lm.org_id = organization.id
  left join new_fax nf on nf.org_id = organization.id
  left join legacy_fax lf on lf.org_id = organization.id
  -- 운영·정지 조직은 항상, 해지 조직은 그 달 발송량 또는 청구서가 있을 때만(개선3차 37)
  where organization.deleted_at is null
    or (
      coalesce(nm.sms_count, 0) + coalesce(lm.sms_count, 0)
      + coalesce(nm.lms_count, 0) + coalesce(lm.lms_count, 0)
      + coalesce(nm.alimtalk_count, 0) + coalesce(lm.alimtalk_count, 0)
      + coalesce(nf.fax_pages, 0) + coalesce(lf.fax_pages, 0)
      + coalesce(nf.fax_sends, 0) + coalesce(lf.fax_sends, 0)
    ) > 0
    or exists (
      select 1 from public.platform_billing_invoices invoice
      where invoice.org_id = organization.id
        and invoice.billing_month = date_trunc('month', p_month)::date
    );
$function$;

-- 37·41: platform_list_org_billing — 반환 컬럼 추가(org_terminated, 적용 단가)라 drop 후 재생성
drop function if exists public.platform_list_org_billing(date);

CREATE OR REPLACE FUNCTION public.platform_list_org_billing(p_month date)
 RETURNS TABLE(org_id bigint, org_name text, org_email text, status text, alimtalk_count integer, sms_count integer, lms_count integer, fax_count integer, fax_page_count integer, alimtalk_amount_krw bigint, sms_amount_krw bigint, fax_amount_krw bigint, subtotal_krw bigint, vat_krw bigint, total_krw bigint, prev_total_krw bigint, org_terminated boolean, rate_krw_alimtalk integer, rate_krw_sms integer, rate_krw_lms integer, rate_krw_fax integer, vat_rate numeric)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_month date;
  v_prev_month date;
begin
  if not public.current_user_is_platform_admin() then
    raise exception 'forbidden: platform_admin required' using errcode = '42501';
  end if;
  if p_month is null then
    raise exception 'billing month is required' using errcode = '22023';
  end if;
  if not exists (select 1 from public.platform_settings setting where setting.id = 1) then
    raise exception 'platform settings singleton is missing' using errcode = '55000';
  end if;

  v_month := date_trunc('month', p_month)::date;
  v_prev_month := (v_month - interval '1 month')::date;

  return query
  with setting as (
    select * from public.platform_settings where id = 1
  ), live as (
    select
      usage.org_id,
      usage.billing_month,
      usage.alimtalk_count,
      usage.sms_count,
      usage.lms_count,
      usage.fax_sends as fax_count,
      usage.fax_pages as fax_page_count,
      (usage.alimtalk_count::bigint * setting.rate_krw_alimtalk)::bigint
        as alimtalk_amount_krw,
      (
        usage.sms_count::bigint * setting.rate_krw_sms
        + usage.lms_count::bigint * setting.rate_krw_lms
      )::bigint as sms_amount_krw,
      (usage.fax_pages::bigint * setting.rate_krw_fax)::bigint
        as fax_amount_krw,
      setting.vat_rate
    from (
      select v_month as billing_month, usage.*
      from public.platform_org_usage(v_month) usage
      union all
      select v_prev_month as billing_month, usage.*
      from public.platform_org_usage(v_prev_month) usage
    ) usage
    cross join setting
  ), live_amounts as (
    select
      live.*,
      (live.alimtalk_amount_krw + live.sms_amount_krw + live.fax_amount_krw)::bigint
        as subtotal_krw,
      round(
        (live.alimtalk_amount_krw + live.sms_amount_krw + live.fax_amount_krw)
        * live.vat_rate / 100
      )::bigint as vat_krw
    from live
  ), live_totals as (
    select
      live_amounts.*,
      (live_amounts.subtotal_krw + live_amounts.vat_krw)::bigint as total_krw
    from live_amounts
  )
  select
    organization.id,
    organization.name,
    owner.email,
    case
      when current_invoice.id is not null then current_invoice.status
      when current_live.total_krw > 0 then 'unpaid'
      else 'none'
    end,
    case when current_invoice.id is not null then current_invoice.alimtalk_count else current_live.alimtalk_count end,
    case when current_invoice.id is not null then current_invoice.sms_count else current_live.sms_count end,
    case when current_invoice.id is not null then current_invoice.lms_count else current_live.lms_count end,
    case when current_invoice.id is not null then current_invoice.fax_count else current_live.fax_count end,
    case when current_invoice.id is not null then current_invoice.fax_page_count else current_live.fax_page_count end,
    case when current_invoice.id is not null then current_invoice.alimtalk_amount_krw else current_live.alimtalk_amount_krw end,
    case when current_invoice.id is not null then current_invoice.sms_amount_krw else current_live.sms_amount_krw end,
    case when current_invoice.id is not null then current_invoice.fax_amount_krw else current_live.fax_amount_krw end,
    case when current_invoice.id is not null then current_invoice.subtotal_krw else current_live.subtotal_krw end,
    case when current_invoice.id is not null then current_invoice.vat_krw else current_live.vat_krw end,
    case when current_invoice.id is not null then current_invoice.total_krw else current_live.total_krw end,
    -- 해지 조직은 전월 사용량 행이 없을 수 있다(left join)
    case when previous_invoice.id is not null then previous_invoice.total_krw else coalesce(previous_live.total_krw, 0::bigint) end,
    (organization.deleted_at is not null),
    -- 적용 단가: 저장된 청구서 스냅샷 → 없으면 현재 설정(개선3차 41)
    case when current_invoice.id is not null then coalesce(current_invoice.rate_krw_alimtalk, setting.rate_krw_alimtalk) else setting.rate_krw_alimtalk end,
    case when current_invoice.id is not null then coalesce(current_invoice.rate_krw_sms, setting.rate_krw_sms) else setting.rate_krw_sms end,
    case when current_invoice.id is not null then coalesce(current_invoice.rate_krw_lms, setting.rate_krw_lms) else setting.rate_krw_lms end,
    case when current_invoice.id is not null then coalesce(current_invoice.rate_krw_fax, setting.rate_krw_fax) else setting.rate_krw_fax end,
    case when current_invoice.id is not null then coalesce(current_invoice.vat_rate, setting.vat_rate) else setting.vat_rate end
  from public.organizations organization
  cross join setting
  -- 대상: platform_org_usage가 돌려준 조직(운영·정지 전부 + 그 달 발송량·청구서가 있는 해지 조직)
  join live_totals current_live
    on current_live.org_id = organization.id and current_live.billing_month = v_month
  left join live_totals previous_live
    on previous_live.org_id = organization.id and previous_live.billing_month = v_prev_month
  left join public.platform_billing_invoices current_invoice
    on current_invoice.org_id = organization.id and current_invoice.billing_month = v_month
  left join public.platform_billing_invoices previous_invoice
    on previous_invoice.org_id = organization.id and previous_invoice.billing_month = v_prev_month
  left join lateral (
    select auth_user.email::text as email
    from public.org_members membership
    join auth.users auth_user on auth_user.id = membership.user_id
    where membership.org_id = organization.id
      and membership.role = 'org_owner'
      and auth_user.email is not null
    order by membership.created_at, membership.user_id
    limit 1
  ) owner on true
  order by organization.name, organization.id;
end
$function$;

revoke all on function public.platform_list_org_billing(date) from public, anon;
grant execute on function public.platform_list_org_billing(date) to authenticated, service_role;

-- 41·43: platform_mark_org_billing_paid — 진행 중인 달 거절 + 단가 스냅샷 저장
CREATE OR REPLACE FUNCTION public.platform_mark_org_billing_paid(p_org_id bigint, p_month date, p_paid boolean)
 RETURNS platform_billing_invoices
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_month date;
  v_usage record;
  v_rate record;
  v_alimtalk_amount bigint;
  v_sms_amount bigint;
  v_fax_amount bigint;
  v_subtotal bigint;
  v_vat bigint;
  v_total bigint;
  v_before jsonb;
  v_invoice public.platform_billing_invoices%rowtype;
begin
  if not public.current_user_is_platform_admin() then
    raise exception 'forbidden: platform_admin required' using errcode = '42501';
  end if;
  if p_month is null then
    raise exception 'billing month is required' using errcode = '22023';
  end if;
  if p_paid is null then
    raise exception 'paid flag is required' using errcode = '22023';
  end if;

  v_month := date_trunc('month', p_month)::date;

  if not exists (
    select 1 from public.organizations organization where organization.id = p_org_id
  ) then
    raise exception 'organization not found' using errcode = '22023';
  end if;

  if not p_paid then
    delete from public.platform_billing_invoices invoice
    where invoice.org_id = p_org_id and invoice.billing_month = v_month
    returning * into v_invoice;

    insert into public.audit_log(org_id, actor_id, action, table_name, row_pk, before, after)
    values (
      p_org_id,
      (select auth.uid()),
      'PLATFORM_BILLING_REVERT_TO_UNPAID',
      'platform_billing_invoices',
      p_org_id::text || ':' || v_month::text,
      to_jsonb(v_invoice),
      null
    );
    return v_invoice;
  end if;

  -- 개선3차 43: 진행 중인 달(서울 기준 이번 달)·미래 달은 금액이 아직 확정되지 않아 입금 확인 불가
  if v_month >= date_trunc('month', (now() at time zone 'Asia/Seoul'))::date then
    raise exception 'billing month in progress: cannot mark paid before the month ends'
      using errcode = '22023', hint = 'BILLING_MONTH_IN_PROGRESS';
  end if;

  if not exists (select 1 from public.platform_settings setting where setting.id = 1) then
    raise exception 'platform settings singleton is missing' using errcode = '55000';
  end if;

  select * into v_rate from public.platform_settings where id = 1;
  select * into v_usage from public.platform_org_usage(v_month) where org_id = p_org_id;

  v_alimtalk_amount := coalesce(v_usage.alimtalk_count, 0)::bigint * v_rate.rate_krw_alimtalk;
  v_sms_amount := (
    coalesce(v_usage.sms_count, 0)::bigint * v_rate.rate_krw_sms
    + coalesce(v_usage.lms_count, 0)::bigint * v_rate.rate_krw_lms
  )::bigint;
  v_fax_amount := coalesce(v_usage.fax_pages, 0)::bigint * v_rate.rate_krw_fax;
  v_subtotal := v_alimtalk_amount + v_sms_amount + v_fax_amount;
  v_vat := round(v_subtotal * v_rate.vat_rate / 100)::bigint;
  v_total := v_subtotal + v_vat;

  select to_jsonb(invoice) into v_before
  from public.platform_billing_invoices invoice
  where invoice.org_id = p_org_id and invoice.billing_month = v_month;

  insert into public.platform_billing_invoices(
    org_id,
    billing_month,
    status,
    alimtalk_count,
    sms_count,
    lms_count,
    fax_count,
    fax_page_count,
    alimtalk_amount_krw,
    sms_amount_krw,
    fax_amount_krw,
    subtotal_krw,
    vat_krw,
    total_krw,
    rate_krw_alimtalk,
    rate_krw_sms,
    rate_krw_lms,
    rate_krw_fax,
    vat_rate,
    paid_at,
    updated_by,
    updated_at
  ) values (
    p_org_id,
    v_month,
    'paid',
    coalesce(v_usage.alimtalk_count, 0),
    coalesce(v_usage.sms_count, 0),
    coalesce(v_usage.lms_count, 0),
    coalesce(v_usage.fax_sends, 0),
    coalesce(v_usage.fax_pages, 0),
    v_alimtalk_amount,
    v_sms_amount,
    v_fax_amount,
    v_subtotal,
    v_vat,
    v_total,
    v_rate.rate_krw_alimtalk,
    v_rate.rate_krw_sms,
    v_rate.rate_krw_lms,
    v_rate.rate_krw_fax,
    v_rate.vat_rate,
    now(),
    (select auth.uid()),
    now()
  )
  on conflict (org_id, billing_month) do update
  set
    status = 'paid',
    alimtalk_count = excluded.alimtalk_count,
    sms_count = excluded.sms_count,
    lms_count = excluded.lms_count,
    fax_count = excluded.fax_count,
    fax_page_count = excluded.fax_page_count,
    alimtalk_amount_krw = excluded.alimtalk_amount_krw,
    sms_amount_krw = excluded.sms_amount_krw,
    fax_amount_krw = excluded.fax_amount_krw,
    subtotal_krw = excluded.subtotal_krw,
    vat_krw = excluded.vat_krw,
    total_krw = excluded.total_krw,
    rate_krw_alimtalk = excluded.rate_krw_alimtalk,
    rate_krw_sms = excluded.rate_krw_sms,
    rate_krw_lms = excluded.rate_krw_lms,
    rate_krw_fax = excluded.rate_krw_fax,
    vat_rate = excluded.vat_rate,
    paid_at = now(),
    updated_by = (select auth.uid()),
    updated_at = now()
  returning * into v_invoice;

  insert into public.audit_log(org_id, actor_id, action, table_name, row_pk, before, after)
  values (
    p_org_id,
    (select auth.uid()),
    'PLATFORM_BILLING_MARK_PAID',
    'platform_billing_invoices',
    p_org_id::text || ':' || v_month::text,
    v_before,
    to_jsonb(v_invoice)
  );

  return v_invoice;
end
$function$;

commit;
