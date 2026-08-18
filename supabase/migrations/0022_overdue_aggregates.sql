-- 0022_overdue_aggregates.sql
-- 확정 부과액에서 유효 수납액을 차감한 세대별 미납 집계
-- 의존: P1a(units, occupancies), P2a(current_user_org), P5(billing_confirmations), P6(payments)

create or replace function list_overdue_aggregates(
  p_building_id bigint,
  p_target_year int default extract(year from timezone('Asia/Seoul', now()))::int,
  p_target_month int default extract(month from timezone('Asia/Seoul', now()))::int,
  p_scope text default 'all'
)
returns table(
  occupancy_id bigint,
  unit_id bigint,
  overdue_amount bigint,
  overdue_months int,
  last_payment_date date,
  billing_available boolean
)
language plpgsql
stable
security definer
set search_path = public
as $$
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
  with current_occupancies as (
    select o.id as occupancy_id, o.unit_id
    from occupancies o
    join units u on u.id = o.unit_id and u.deleted_at is null
    join buildings b on b.id = u.building_id and b.org_id = current_user_org()
    where u.building_id = p_building_id
      and o.status = 'occupied'
      and o.deleted_at is null
  ),
  scoped_confirmations as (
    select bc.occupancy_id, bc.unit_id, bc.period, bc.total_amount
    from billing_confirmations bc
    join current_occupancies co
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
      greatest(bc.total_amount::bigint - coalesce(sum(p.amount), 0)::bigint, 0::bigint) as outstanding
    from scoped_confirmations bc
    left join payments p
      on p.occupancy_id = bc.occupancy_id
     and p.unit_id = bc.unit_id
     and p.period = bc.period
     and p.status = 'active'
    group by bc.occupancy_id, bc.unit_id, bc.period, bc.total_amount
  ),
  balances as (
    select
      pb.occupancy_id,
      pb.unit_id,
      coalesce(sum(pb.outstanding), 0)::bigint as overdue_amount,
      count(distinct pb.period) filter (where pb.outstanding > 0)::int as overdue_months
    from period_balances pb
    group by pb.occupancy_id, pb.unit_id
  ),
  payment_dates as (
    select p.occupancy_id, p.unit_id, max(p.paid_at) as last_payment_date
    from payments p
    join current_occupancies co
      on co.occupancy_id = p.occupancy_id
     and co.unit_id = p.unit_id
    where p.status = 'active'
    group by p.occupancy_id, p.unit_id
  ),
  billing_status as (
    select bc.occupancy_id, bc.unit_id, true as billing_available
    from billing_confirmations bc
    join current_occupancies co
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
    coalesce(bs.billing_available, false)
  from current_occupancies co
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
$$;

revoke execute on function list_overdue_aggregates(bigint, int, int, text) from public, anon;
grant execute on function list_overdue_aggregates(bigint, int, int, text) to authenticated;
