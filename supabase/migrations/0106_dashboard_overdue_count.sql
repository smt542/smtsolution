-- Dashboard overdue household count without per-building fan-out.

create or replace function public.count_overdue_households(
  p_target_year integer default extract(year from timezone('Asia/Seoul', now()))::integer,
  p_target_month integer default extract(month from timezone('Asia/Seoul', now()))::integer
)
returns bigint
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_target_period date;
  v_count bigint;
begin
  if p_target_year is null or p_target_year not between 1 and 9999 then
    raise exception 'target year must be between 1 and 9999' using errcode = '22023';
  end if;
  if p_target_month is null or p_target_month not between 1 and 12 then
    raise exception 'target month must be between 1 and 12' using errcode = '22023';
  end if;

  v_target_period := make_date(p_target_year, p_target_month, 1);

  with current_occupancies as (
    select occupancy.id as occupancy_id, occupancy.unit_id
    from public.occupancies occupancy
    join public.units unit
      on unit.id = occupancy.unit_id
     and unit.deleted_at is null
    join public.buildings building
      on building.id = unit.building_id
     and building.org_id = public.current_user_org()
     and building.deleted_at is null
    where occupancy.status = 'occupied'
      and occupancy.deleted_at is null
  ),
  period_balances as (
    select
      confirmation.occupancy_id,
      confirmation.unit_id,
      confirmation.period,
      greatest(
        confirmation.total_amount::bigint - coalesce(sum(payment.amount), 0)::bigint,
        0::bigint
      ) as outstanding
    from public.billing_confirmations confirmation
    join current_occupancies current_occupancy
      on current_occupancy.occupancy_id = confirmation.occupancy_id
     and current_occupancy.unit_id = confirmation.unit_id
    left join public.payments payment
      on payment.occupancy_id = confirmation.occupancy_id
     and payment.unit_id = confirmation.unit_id
     and payment.period = confirmation.period
     and payment.status = 'active'
    where confirmation.confirmed_at is not null
      and confirmation.period <= v_target_period
    group by
      confirmation.occupancy_id,
      confirmation.unit_id,
      confirmation.period,
      confirmation.total_amount
  ),
  overdue_occupancies as (
    select period_balance.occupancy_id, period_balance.unit_id
    from period_balances period_balance
    group by period_balance.occupancy_id, period_balance.unit_id
    having sum(period_balance.outstanding) > 0
  )
  select count(*)::bigint
    into v_count
  from overdue_occupancies;

  return coalesce(v_count, 0);
end
$$;

revoke all on function public.count_overdue_households(integer, integer)
  from public, anon;
grant execute on function public.count_overdue_households(integer, integer)
  to authenticated;
