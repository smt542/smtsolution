-- 3-1) partner_list_unit_payments: 월별 연체료 미수금(late_fee_split_unpaid) 함께 반환.
--   원금은 다 냈어도 수.연 연체료 미수금이 남은 달은 미납 달(부과·정산 계산 규칙, 현장 관리자_모바일 입주자 정보 3.3).
--   반환 타입이 바뀌므로 drop 후 create. 의존 객체 없음, grant 는 authenticated/service_role 복원(anon 없음).
drop function if exists public.partner_list_unit_payments(bigint, date, integer);

create function public.partner_list_unit_payments(
  p_unit_id bigint,
  p_before_period date default null::date,
  p_limit integer default 24
)
returns table(
  period date, due_date date, charged integer, paid integer, unpaid integer,
  last_paid_at date, methods text, memo text, late_fee_split_unpaid integer
)
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
        public.billing_default_due_date(unit.id, month.period)
      ) as due_date
    from paged_periods month
    cross join authorized_unit unit
  ),
  payments_by_period as (
    select
      payment.period,
      (sum(payment.amount) filter (where payment.late_fee_split_id is null))::integer as paid,
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
    payment.memo,
    coalesce((select lfs.split_unpaid
                from authorized_unit au
               cross join lateral public.late_fee_split_balance(au.id, month.period) lfs), 0)::integer
  from paged_periods month
  left join billing_by_period billing on billing.period = month.period
  left join due_by_period due on due.period = month.period
  left join payments_by_period payment on payment.period = month.period
  order by month.period desc;
end
$function$;

revoke execute on function public.partner_list_unit_payments(bigint, date, integer) from public, anon;
grant execute on function public.partner_list_unit_payments(bigint, date, integer) to authenticated, service_role;
