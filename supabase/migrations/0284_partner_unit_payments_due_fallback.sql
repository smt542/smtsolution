-- 파트너 입주자 정보 > 수납 탭의 월별 '기한'이 대부분 '-'로 나오던 문제.
--
-- 기한을 발행된 고지서(bill_issues.due_date)에서만 가져와, 고지서를 발행하지 않은 달은 비었다.
-- 미납 관리(list_overdue_periods)·이월(bill_carryover)·이사정산 미납(settlement_billing_unpaid)·
-- 파트너 검침 카드(partner_list_meter_cards)와 같은 규칙으로 맞춘다:
--   기한 = coalesce(최신 발행 고지서 납기일, 건물·월 납기일 설정(billing_period_settings), 해당 월 말일)
-- 시안(previous_lhw)의 '매월 5일'은 더미 값이라 정책 근거가 없어 따르지 않는다.

create or replace function public.partner_list_unit_payments(
  p_unit_id bigint,
  p_before_period date default null::date,
  p_limit integer default 24
)
 returns table(period date, due_date date, charged integer, paid integer, unpaid integer, last_paid_at date, methods text, memo text)
 language plpgsql
 stable security definer
 set search_path to ''
as $function$
begin
  if p_limit is null or p_limit not between 1 and 60 then
    raise exception 'limit must be between 1 and 60' using errcode = '22023';
  end if;

  return query
  with authorized_unit as (
    select unit.id, unit.building_id
    from public.units unit
    where unit.id = p_unit_id
      and unit.building_id in (select public.partner_my_building_ids())
  ),
  periods as (
    select confirmation.period
    from public.billing_confirmations confirmation
    join authorized_unit unit on unit.id = confirmation.unit_id
    union
    select payment.period
    from public.payments payment
    join authorized_unit unit on unit.id = payment.unit_id
    where payment.status = 'active'
  ),
  paged_periods as (
    select month.period
    from periods month
    where p_before_period is null or month.period < p_before_period
    order by month.period desc
    limit p_limit
  ),
  billing_by_period as (
    select
      confirmation.period,
      max(confirmation.total_amount)::integer as charged
    from public.billing_confirmations confirmation
    join authorized_unit unit on unit.id = confirmation.unit_id
    join paged_periods month on month.period = confirmation.period
    group by confirmation.period
  ),
  due_by_period as (
    select
      month.period,
      coalesce(
        (select issue.due_date
           from public.bill_issues issue
          where issue.unit_id = unit.id and issue.period = month.period
            and issue.due_date is not null
          order by issue.issued_at desc, issue.id desc
          limit 1),
        (select setting.due_date
           from public.billing_period_settings setting
          where setting.building_id = unit.building_id and setting.period = month.period),
        (date_trunc('month', month.period) + interval '1 month' - interval '1 day')::date
      ) as due_date
    from paged_periods month
    cross join authorized_unit unit
  ),
  payments_by_period as (
    select
      payment.period,
      sum(payment.amount)::integer as paid,
      max(payment.paid_at) as last_paid_at,
      string_agg(distinct payment.method, ',' order by payment.method) as methods,
      string_agg(nullif(payment.memo, ''), ' / ' order by payment.paid_at, payment.id)
        filter (where nullif(payment.memo, '') is not null) as memo
    from public.payments payment
    join authorized_unit unit on unit.id = payment.unit_id
    join paged_periods month on month.period = payment.period
    where payment.status = 'active'
    group by payment.period
  )
  select
    month.period,
    due.due_date,
    coalesce(billing.charged, 0)::integer,
    coalesce(payment.paid, 0)::integer,
    greatest(coalesce(billing.charged, 0) - coalesce(payment.paid, 0), 0)::integer,
    payment.last_paid_at,
    payment.methods,
    payment.memo
  from paged_periods month
  left join billing_by_period billing on billing.period = month.period
  left join due_by_period due on due.period = month.period
  left join payments_by_period payment on payment.period = month.period
  order by month.period desc;
end
$function$;
