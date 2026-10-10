-- 미납관리(연체 현황)에 수.연 연체료 미수금 반영 (0292 후속)
--
-- 수.연으로 원금만 받고 연체료를 「연체료 이전」 미수금(payment_late_fee_splits)으로 나눈 달은, 원금이 0이 되어
-- 미납관리에서 사라졌다. 또 연체료 이전 행에서 받은 수납(payments.late_fee_split_id)이 원금 수납으로 합산됐다.
--
-- 수납 이력(paymentHistoryRows)과 같은 규칙으로 맞춘다.
--   미납 원금        = 당월계 − (연체료 수납을 뺀) 수납 합계
--   연체료 미수금    = 그 달 활성 split 금액 − 그 split 에 연결된 수납
--   split 합계       = 그 달 활성 split 금액 합(원 행 자동 연체료에서 뺀다 — 화면 계산)
-- 미납 원금 또는 연체료 미수금이 남은 달을 미납 달로 본다.
--
-- 1) list_overdue_periods: 반환에 late_fee_split_total · late_fee_split_unpaid 추가
-- 2) list_overdue_aggregates: 반환에 late_fee_split_unpaid 추가, 미납 개월에 연체료 미수금 달 포함

drop function if exists public.list_overdue_periods(bigint, integer, integer, text);
create function public.list_overdue_periods(
  p_building_id bigint default null::bigint,
  p_target_year integer default (extract(year from timezone('Asia/Seoul'::text, now())))::integer,
  p_target_month integer default (extract(month from timezone('Asia/Seoul'::text, now())))::integer,
  p_scope text default 'all'::text
)
 returns table(occupancy_id bigint, unit_id bigint, period date, unpaid_principal bigint, due_date date,
               late_fee_override integer, late_fee_split_total bigint, late_fee_split_unpaid bigint)
 language plpgsql
 stable security definer
 set search_path to 'public'
as $function$
declare
  v_target_period date;
begin
  if p_target_year is null or p_target_year not between 1 and 9999 then
    raise exception 'target year must be between 1 and 9999';
  end if;
  if p_target_month is null or p_target_month not between 1 and 12 then
    raise exception 'target month must be between 1 and 12';
  end if;
  if p_scope is null or p_scope not in ('all', 'current') then
    raise exception 'scope must be all or current';
  end if;

  v_target_period := make_date(p_target_year, p_target_month, 1);

  return query
  with scoped_occupancies as (
    -- 최근 점유상태와 무관하게 이 org(+선택 시 건물)에 속한 (귀속) occupancy를 모두 포함한다.
    -- 미납이 있으면 공실/중도퇴실 세대도 노출되어야 하므로 status 게이트를 두지 않는다.
    select o.id as occupancy_id, o.unit_id, u.building_id
    from occupancies o
    join units u on u.id = o.unit_id and u.deleted_at is null
    join buildings b on b.id = u.building_id and b.org_id = current_user_org()
    where (p_building_id is null or u.building_id = p_building_id)
      and o.deleted_at is null
  ),
  scoped_confirmations as (
    select bc.occupancy_id, bc.unit_id, co.building_id, bc.period, bc.total_amount, bc.late_fee_override
    from billing_confirmations bc
    join scoped_occupancies co
      on co.occupancy_id = bc.occupancy_id
     and co.unit_id = bc.unit_id
    where bc.confirmed_at is not null
      and (
        (p_scope = 'current' and bc.period = v_target_period)
        or (p_scope = 'all' and bc.period <= v_target_period)
      )
  ),
  period_balances as (
    select
      bc.occupancy_id,
      bc.unit_id,
      bc.building_id,
      bc.period,
      bc.late_fee_override,
      greatest(bc.total_amount::bigint - coalesce((
        select sum(p.amount) from payments p
         where p.occupancy_id = bc.occupancy_id
           and p.unit_id = bc.unit_id
           and p.period = bc.period
           and p.status = 'active'
           and p.late_fee_split_id is null
      ), 0)::bigint, 0::bigint) as outstanding,
      coalesce((
        select sum(s.amount) from payment_late_fee_splits s
         where s.unit_id = bc.unit_id and s.period = bc.period and s.status = 'active'
      ), 0)::bigint as split_total,
      coalesce((
        select sum(greatest(s.amount - coalesce((
          select sum(p.amount) from payments p
           where p.late_fee_split_id = s.id and p.status = 'active'
        ), 0), 0))
          from payment_late_fee_splits s
         where s.unit_id = bc.unit_id and s.period = bc.period and s.status = 'active'
      ), 0)::bigint as split_unpaid
    from scoped_confirmations bc
  )
  select
    pb.occupancy_id,
    pb.unit_id,
    pb.period,
    pb.outstanding as unpaid_principal,
    coalesce(
      bps.due_date,
      public.billing_default_due_date(pb.unit_id, pb.period)
    ) as due_date,
    pb.late_fee_override,
    pb.split_total as late_fee_split_total,
    pb.split_unpaid as late_fee_split_unpaid
  from period_balances pb
  left join billing_period_settings bps
    on bps.building_id = pb.building_id
   and bps.period = pb.period
  where pb.outstanding > 0 or pb.split_unpaid > 0
  order by pb.occupancy_id, pb.unit_id, pb.period;
end;
$function$;
revoke all on function public.list_overdue_periods(bigint, integer, integer, text) from public, anon;
grant execute on function public.list_overdue_periods(bigint, integer, integer, text) to authenticated, service_role;

drop function if exists public.list_overdue_aggregates(bigint, integer, integer, text);
create function public.list_overdue_aggregates(
  p_building_id bigint default null::bigint,
  p_target_year integer default (extract(year from timezone('Asia/Seoul'::text, now())))::integer,
  p_target_month integer default (extract(month from timezone('Asia/Seoul'::text, now())))::integer,
  p_scope text default 'all'::text
)
 returns table(occupancy_id bigint, unit_id bigint, overdue_amount bigint, overdue_months integer,
               last_payment_date date, billing_available boolean, late_fee_split_unpaid bigint)
 language plpgsql
 stable security definer
 set search_path to 'public'
as $function$
declare
  v_target_period date;
begin
  if p_target_year is null or p_target_year not between 1 and 9999 then
    raise exception 'target year must be between 1 and 9999';
  end if;
  if p_target_month is null or p_target_month not between 1 and 12 then
    raise exception 'target month must be between 1 and 12';
  end if;
  if p_scope is null or p_scope not in ('all', 'current') then
    raise exception 'scope must be all or current';
  end if;

  v_target_period := make_date(p_target_year, p_target_month, 1);

  return query
  with scoped_occupancies as (
    -- list_overdue_periods와 동일 규칙: status 게이트 없이 org(+선택 시 건물) 귀속만 판정.
    select o.id as occupancy_id, o.unit_id
    from occupancies o
    join units u on u.id = o.unit_id and u.deleted_at is null
    join buildings b on b.id = u.building_id and b.org_id = current_user_org()
    where (p_building_id is null or u.building_id = p_building_id)
      and o.deleted_at is null
  ),
  scoped_confirmations as (
    select bc.occupancy_id, bc.unit_id, bc.period, bc.total_amount
    from billing_confirmations bc
    join scoped_occupancies co
      on co.occupancy_id = bc.occupancy_id
     and co.unit_id = bc.unit_id
    where bc.confirmed_at is not null
      and (
        (p_scope = 'current' and bc.period = v_target_period)
        or (p_scope = 'all' and bc.period <= v_target_period)
      )
  ),
  period_balances as (
    select
      bc.occupancy_id,
      bc.unit_id,
      bc.period,
      greatest(bc.total_amount::bigint - coalesce((
        select sum(p.amount) from payments p
         where p.occupancy_id = bc.occupancy_id
           and p.unit_id = bc.unit_id
           and p.period = bc.period
           and p.status = 'active'
           and p.late_fee_split_id is null
      ), 0)::bigint, 0::bigint) as outstanding,
      coalesce((
        select sum(greatest(s.amount - coalesce((
          select sum(p.amount) from payments p
           where p.late_fee_split_id = s.id and p.status = 'active'
        ), 0), 0))
          from payment_late_fee_splits s
         where s.unit_id = bc.unit_id and s.period = bc.period and s.status = 'active'
      ), 0)::bigint as split_unpaid
    from scoped_confirmations bc
  ),
  balances as (
    select
      pb.occupancy_id,
      pb.unit_id,
      coalesce(sum(pb.outstanding), 0)::bigint as overdue_amount,
      count(distinct pb.period) filter (where pb.outstanding > 0 or pb.split_unpaid > 0)::int as overdue_months,
      coalesce(sum(pb.split_unpaid), 0)::bigint as split_unpaid
    from period_balances pb
    group by pb.occupancy_id, pb.unit_id
  ),
  payment_dates as (
    select p.occupancy_id, p.unit_id, max(p.paid_at) as last_payment_date
    from payments p
    join scoped_occupancies co
      on co.occupancy_id = p.occupancy_id
     and co.unit_id = p.unit_id
    where p.status = 'active'
    group by p.occupancy_id, p.unit_id
  ),
  billing_status as (
    select bc.occupancy_id, bc.unit_id, true as billing_available
    from billing_confirmations bc
    join scoped_occupancies co
      on co.occupancy_id = bc.occupancy_id
     and co.unit_id = bc.unit_id
    where bc.confirmed_at is not null
    group by bc.occupancy_id, bc.unit_id
  )
  select
    co.occupancy_id,
    co.unit_id,
    coalesce(bal.overdue_amount, 0)::bigint,
    coalesce(bal.overdue_months, 0)::int,
    pd.last_payment_date,
    coalesce(bs.billing_available, false),
    coalesce(bal.split_unpaid, 0)::bigint
  from scoped_occupancies co
  left join balances bal
    on bal.occupancy_id = co.occupancy_id
   and bal.unit_id = co.unit_id
  left join payment_dates pd
    on pd.occupancy_id = co.occupancy_id
   and pd.unit_id = co.unit_id
  left join billing_status bs
    on bs.occupancy_id = co.occupancy_id
   and bs.unit_id = co.unit_id
  order by co.unit_id, co.occupancy_id;
end;
$function$;
revoke all on function public.list_overdue_aggregates(bigint, integer, integer, text) from public, anon;
grant execute on function public.list_overdue_aggregates(bigint, integer, integer, text) to authenticated, service_role;
