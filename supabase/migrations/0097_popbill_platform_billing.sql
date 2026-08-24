-- Popbill 전환 3/3: 월 청구를 성공 건·성공 팩스 페이지 기준으로 변경
-- 의존: 0050(platform_settings), 0051(platform_billing_invoices/billing RPC),
--       0095(provider_dispatch_jobs/recipients, bill_issues status), 0096(정산)
--
-- 변경점
--  1) LMS 단가(rate_krw_lms)와 청구서 lms_count·fax_page_count 스냅샷 추가(fax_count는 호환 유지).
--  2) 월 사용량은 provider_dispatch_recipients의 terminal success와 팩스 job success_page_count로 집계.
--  3) provider 작업이 연결되지 않은 전환 월 레거시(message_logs 성공·fax bill_issues sent)만 fallback 합산(중복 방지).

-- ===== 단가·청구서 컬럼 =====
alter table public.platform_settings
  add column if not exists rate_krw_lms integer not null default 0;
-- 시작 LMS 단가를 SMS 단가로 seed한다(관리자가 이후 조정). 이미 값이 있으면 유지.
update public.platform_settings set rate_krw_lms = rate_krw_sms where id = 1 and rate_krw_lms = 0;

alter table public.platform_billing_invoices
  add column if not exists lms_count int not null default 0,
  add column if not exists fax_page_count int not null default 0;

-- ===== 단가 설정 RPC에 LMS 추가 =====
drop function if exists public.platform_update_settings(
  integer, integer, integer, integer, text, text, text, text, text, text, integer, numeric, text
);
create or replace function public.platform_update_settings(
  p_rate_krw_alimtalk integer,
  p_rate_krw_sms integer,
  p_rate_krw_lms integer,
  p_rate_krw_fax integer,
  p_low_balance_threshold integer,
  p_billing_bank text,
  p_billing_account_no text,
  p_billing_account_holder text,
  p_business_reg_no text,
  p_invoice_notice text,
  p_billing_basis text,
  p_payment_due_days integer,
  p_vat_rate numeric,
  p_contact_person text
)
returns public.platform_settings
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_before jsonb;
  v_settings public.platform_settings%rowtype;
begin
  if not public.current_user_is_platform_admin() then
    raise exception 'forbidden: platform_admin required' using errcode = '42501';
  end if;

  select to_jsonb(setting) into v_before from public.platform_settings setting where setting.id = 1;

  update public.platform_settings
    set rate_krw_alimtalk = p_rate_krw_alimtalk,
        rate_krw_sms = p_rate_krw_sms,
        rate_krw_lms = p_rate_krw_lms,
        rate_krw_fax = p_rate_krw_fax,
        low_balance_threshold = p_low_balance_threshold,
        billing_bank = p_billing_bank,
        billing_account_no = p_billing_account_no,
        billing_account_holder = p_billing_account_holder,
        business_reg_no = p_business_reg_no,
        invoice_notice = p_invoice_notice,
        billing_basis = p_billing_basis,
        payment_due_days = p_payment_due_days,
        vat_rate = p_vat_rate,
        contact_person = p_contact_person,
        updated_by = (select auth.uid()),
        updated_at = now()
    where id = 1
    returning * into v_settings;

  insert into public.audit_log(org_id, actor_id, action, table_name, row_pk, before, after)
  values (null, (select auth.uid()), 'PLATFORM_SETTINGS_UPDATE', 'platform_settings', '1', v_before, to_jsonb(v_settings));

  return v_settings;
end
$$;
revoke all on function public.platform_update_settings(
  integer, integer, integer, integer, integer, text, text, text, text, text, text, integer, numeric, text
) from public, anon;
grant execute on function public.platform_update_settings(
  integer, integer, integer, integer, integer, text, text, text, text, text, text, integer, numeric, text
) to authenticated;

-- ===== 월 사용량 집계 헬퍼(내부 전용) =====
-- 신규: provider_dispatch_recipients terminal success + 팩스 job success_page_count.
-- 레거시: provider 작업이 없는 message_logs(sent/partial)·fax bill_issues(sent)만 fallback.
create or replace function public.platform_org_usage(p_month date)
returns table(
  org_id bigint,
  sms_count integer,
  lms_count integer,
  alimtalk_count integer,
  fax_pages integer,
  fax_sends integer
)
language sql
stable
security definer
set search_path = ''
as $$
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
      and bi.issued_at >= bounds.from_ts and bi.issued_at < bounds.to_ts
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
  where organization.deleted_at is null;
$$;
revoke all on function public.platform_org_usage(date) from public, anon, authenticated;

-- ===== 청구 목록: LMS·팩스 페이지 포함 =====
drop function if exists public.platform_list_org_billing(date);
create or replace function public.platform_list_org_billing(p_month date)
returns table (
  org_id bigint,
  org_name text,
  org_email text,
  status text,
  alimtalk_count int,
  sms_count int,
  lms_count int,
  fax_count int,
  fax_page_count int,
  subtotal_krw bigint,
  vat_krw bigint,
  total_krw bigint,
  prev_total_krw bigint
)
language plpgsql
stable
security definer
set search_path = ''
as $$
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
  with setting as (select * from public.platform_settings where id = 1),
  live as (
    select
      usage.org_id,
      usage.billing_month,
      usage.alimtalk_count,
      usage.sms_count,
      usage.lms_count,
      usage.fax_sends as fax_count,
      usage.fax_pages as fax_page_count,
      (
        usage.alimtalk_count::bigint * setting.rate_krw_alimtalk
        + usage.sms_count::bigint * setting.rate_krw_sms
        + usage.lms_count::bigint * setting.rate_krw_lms
        + usage.fax_pages::bigint * setting.rate_krw_fax
      )::bigint as subtotal_krw,
      setting.vat_rate
    from (
      select v_month as billing_month, u.* from public.platform_org_usage(v_month) u
      union all
      select v_prev_month as billing_month, u.* from public.platform_org_usage(v_prev_month) u
    ) usage
    cross join setting
  ),
  live_amounts as (
    select live.*,
      round(live.subtotal_krw * live.vat_rate / 100)::bigint as vat_krw,
      (live.subtotal_krw + round(live.subtotal_krw * live.vat_rate / 100)::bigint)::bigint as total_krw
    from live
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
    case when current_invoice.id is not null then current_invoice.subtotal_krw else current_live.subtotal_krw end,
    case when current_invoice.id is not null then current_invoice.vat_krw else current_live.vat_krw end,
    case when current_invoice.id is not null then current_invoice.total_krw else current_live.total_krw end,
    case when previous_invoice.id is not null then previous_invoice.total_krw else previous_live.total_krw end
  from public.organizations organization
  join live_amounts current_live on current_live.org_id = organization.id and current_live.billing_month = v_month
  join live_amounts previous_live on previous_live.org_id = organization.id and previous_live.billing_month = v_prev_month
  left join public.platform_billing_invoices current_invoice
    on current_invoice.org_id = organization.id and current_invoice.billing_month = v_month
  left join public.platform_billing_invoices previous_invoice
    on previous_invoice.org_id = organization.id and previous_invoice.billing_month = v_prev_month
  left join lateral (
    select auth_user.email::text as email
    from public.org_members membership
    join auth.users auth_user on auth_user.id = membership.user_id
    where membership.org_id = organization.id and membership.role = 'org_owner' and auth_user.email is not null
    order by membership.created_at, membership.user_id
    limit 1
  ) owner on true
  where organization.deleted_at is null
  order by organization.name, organization.id;
end
$$;
revoke all on function public.platform_list_org_billing(date) from public, anon;
grant execute on function public.platform_list_org_billing(date) to authenticated;

-- ===== 개요 지표: 신규 사용량 기준 subtotal =====
create or replace function public.platform_get_overview_metrics(p_month date)
returns table (
  org_active int,
  org_suspended int,
  org_terminated int,
  building_count int,
  building_added_this_month int,
  unit_count int,
  linked_unit_count int,
  send_cost_krw bigint,
  send_cost_prev_krw bigint
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_month date;
  v_prev_month date;
  v_next_month date;
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
  v_next_month := (v_month + interval '1 month')::date;

  return query
  with setting as (select * from public.platform_settings where id = 1),
  subtotal as (
    select month_value.billing_month,
      coalesce(sum(
        case when invoice.id is not null then invoice.subtotal_krw
        else (
          usage.alimtalk_count::bigint * setting.rate_krw_alimtalk
          + usage.sms_count::bigint * setting.rate_krw_sms
          + usage.lms_count::bigint * setting.rate_krw_lms
          + usage.fax_pages::bigint * setting.rate_krw_fax
        ) end
      ), 0)::bigint as subtotal_krw
    from (
      select v_month as billing_month, u.* from public.platform_org_usage(v_month) u
      union all
      select v_prev_month as billing_month, u.* from public.platform_org_usage(v_prev_month) u
    ) usage
    cross join setting
    cross join (values (v_month), (v_prev_month)) as month_value(billing_month)
    left join public.platform_billing_invoices invoice
      on invoice.org_id = usage.org_id and invoice.billing_month = month_value.billing_month
    where usage.billing_month = month_value.billing_month
    group by month_value.billing_month
  )
  select
    (select count(*)::int from public.organizations o where o.status = 'active' and o.deleted_at is null),
    (select count(*)::int from public.organizations o where o.status = 'suspended' and o.deleted_at is null),
    (select count(*)::int from public.organizations o where o.deleted_at is not null),
    (select count(*)::int from public.buildings b where b.deleted_at is null),
    (select count(*)::int from public.buildings b
      where b.created_at >= (v_month::timestamp at time zone 'Asia/Seoul')
        and b.created_at < (v_next_month::timestamp at time zone 'Asia/Seoul')),
    (select count(*)::int from public.units unit join public.buildings b on b.id = unit.building_id and b.deleted_at is null where unit.deleted_at is null),
    (select count(distinct claim.unit_id)::int from public.res_claims claim
      join public.units unit on unit.id = claim.unit_id and unit.deleted_at is null
      join public.buildings b on b.id = unit.building_id and b.deleted_at is null
      where claim.status = 'linked'),
    coalesce((select subtotal_krw from subtotal where billing_month = v_month), 0::bigint),
    coalesce((select subtotal_krw from subtotal where billing_month = v_prev_month), 0::bigint);
end
$$;
revoke all on function public.platform_get_overview_metrics(date) from public, anon;
grant execute on function public.platform_get_overview_metrics(date) to authenticated;

-- ===== 청구 확정(paid): LMS·팩스 페이지 스냅샷 =====
create or replace function public.platform_mark_org_billing_paid(
  p_org_id bigint,
  p_month date,
  p_paid boolean
)
returns public.platform_billing_invoices
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_month date;
  v_usage record;
  v_rate record;
  v_subtotal bigint;
  v_vat bigint;
  v_total bigint;
  v_before jsonb;
  v_invoice public.platform_billing_invoices%rowtype;
begin
  if not public.current_user_is_platform_admin() then
    raise exception 'forbidden: platform_admin required' using errcode = '42501';
  end if;
  if p_month is null then raise exception 'billing month is required' using errcode = '22023'; end if;
  if p_paid is null then raise exception 'paid flag is required' using errcode = '22023'; end if;

  v_month := date_trunc('month', p_month)::date;

  if not exists (select 1 from public.organizations organization where organization.id = p_org_id) then
    raise exception 'organization not found' using errcode = '22023';
  end if;

  if not p_paid then
    delete from public.platform_billing_invoices invoice
    where invoice.org_id = p_org_id and invoice.billing_month = v_month
    returning * into v_invoice;
    insert into public.audit_log(org_id, actor_id, action, table_name, row_pk, before, after)
    values (p_org_id, (select auth.uid()), 'PLATFORM_BILLING_REVERT_TO_UNPAID',
      'platform_billing_invoices', p_org_id::text || ':' || v_month::text, to_jsonb(v_invoice), null);
    return v_invoice;
  end if;

  if not exists (select 1 from public.platform_settings setting where setting.id = 1) then
    raise exception 'platform settings singleton is missing' using errcode = '55000';
  end if;

  select * into v_rate from public.platform_settings where id = 1;
  select * into v_usage from public.platform_org_usage(v_month) where org_id = p_org_id;

  v_subtotal := (
    coalesce(v_usage.alimtalk_count, 0)::bigint * v_rate.rate_krw_alimtalk
    + coalesce(v_usage.sms_count, 0)::bigint * v_rate.rate_krw_sms
    + coalesce(v_usage.lms_count, 0)::bigint * v_rate.rate_krw_lms
    + coalesce(v_usage.fax_pages, 0)::bigint * v_rate.rate_krw_fax
  )::bigint;
  v_vat := round(v_subtotal * v_rate.vat_rate / 100)::bigint;
  v_total := v_subtotal + v_vat;

  select to_jsonb(invoice) into v_before
  from public.platform_billing_invoices invoice
  where invoice.org_id = p_org_id and invoice.billing_month = v_month;

  insert into public.platform_billing_invoices(
    org_id, billing_month, status, alimtalk_count, sms_count, lms_count, fax_count, fax_page_count,
    subtotal_krw, vat_krw, total_krw, paid_at, updated_by, updated_at
  ) values (
    p_org_id, v_month, 'paid',
    coalesce(v_usage.alimtalk_count, 0), coalesce(v_usage.sms_count, 0), coalesce(v_usage.lms_count, 0),
    coalesce(v_usage.fax_sends, 0), coalesce(v_usage.fax_pages, 0),
    v_subtotal, v_vat, v_total, now(), (select auth.uid()), now()
  )
  on conflict (org_id, billing_month) do update
    set status = 'paid',
        alimtalk_count = excluded.alimtalk_count,
        sms_count = excluded.sms_count,
        lms_count = excluded.lms_count,
        fax_count = excluded.fax_count,
        fax_page_count = excluded.fax_page_count,
        subtotal_krw = excluded.subtotal_krw,
        vat_krw = excluded.vat_krw,
        total_krw = excluded.total_krw,
        paid_at = now(),
        updated_by = (select auth.uid()),
        updated_at = now()
  returning * into v_invoice;

  insert into public.audit_log(org_id, actor_id, action, table_name, row_pk, before, after)
  values (p_org_id, (select auth.uid()), 'PLATFORM_BILLING_MARK_PAID',
    'platform_billing_invoices', p_org_id::text || ':' || v_month::text, v_before, to_jsonb(v_invoice));

  return v_invoice;
end
$$;
revoke all on function public.platform_mark_org_billing_paid(bigint, date, boolean) from public, anon;
grant execute on function public.platform_mark_org_billing_paid(bigint, date, boolean) to authenticated;
