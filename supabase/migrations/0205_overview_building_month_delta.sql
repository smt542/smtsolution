-- 0205: 통합관리자 대시보드 KPI '관리 건물' 부제 = 전월 대비 순증감(정본 admin/overview '전월 대비 +N곳').
-- 0097까지 building_added_this_month는 '이번 달 created_at 건수'(이후 삭제된 건물 포함)였다.
-- 이제 '이 달 끝(이번 달이면 지금) 시점 건물 수 − 이 달 1일 시점 건물 수'를 돌려준다(삭제 반영, 음수 가능).
-- 반환 형식·컬럼 이름은 그대로 두어 create or replace로 본문만 교체한다(오버로드·PostgREST 캐시 영향 없음).

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
  v_start_ts timestamptz;
  v_end_ts timestamptz;
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
  -- 전월 대비 기준 시점: 이 달 1일 0시(서울) ~ 이 달 끝(이번 달이면 지금)
  v_start_ts := v_month::timestamp at time zone 'Asia/Seoul';
  v_end_ts := least(now(), v_next_month::timestamp at time zone 'Asia/Seoul');

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
    -- 전월 대비 순증감(컬럼 이름은 호환 때문에 그대로)
    (select count(*)::int from public.buildings b
      where b.created_at < v_end_ts
        and (b.deleted_at is null or b.deleted_at >= v_end_ts))
    - (select count(*)::int from public.buildings b
      where b.created_at < v_start_ts
        and (b.deleted_at is null or b.deleted_at >= v_start_ts)),
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
