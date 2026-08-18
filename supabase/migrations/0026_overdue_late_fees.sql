-- 0026_overdue_late_fees.sql
-- 연체료 요율표(org 단위) + 세대×월분별 미납/납기 조회 RPC
-- 의존: P1a(units, occupancies), buildings(org_id), P5(billing_confirmations),
--       P6(payments), 0024(billing_period_settings)

-- 1) 요율표 (org 단위, 연체개월 구간별 월요율)
create table if not exists late_fee_rate_tiers (
  id bigint generated always as identity primary key,
  org_id bigint not null references organizations(id) on delete cascade,
  tier_order int not null,
  from_month int not null,           -- 구간 시작(연체 개월차, exclusive)
  to_month int,                      -- 구간 끝(연체 개월차, inclusive), null = 무한대
  monthly_rate numeric(6,4) not null, -- 월요율(%) 예: 1.2000
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (from_month >= 0),
  check (to_month is null or to_month > from_month),
  check (monthly_rate >= 0)
);

create index if not exists idx_late_fee_rate_tiers_org
  on late_fee_rate_tiers(org_id, tier_order);

alter table late_fee_rate_tiers enable row level security;

create policy lfrt_select on late_fee_rate_tiers
  for select using (org_id = current_user_org());

create policy lfrt_write on late_fee_rate_tiers
  for all
  using (org_id = current_user_org() and current_user_has_module('billing'))
  with check (org_id = current_user_org() and current_user_has_module('billing'));

-- 2) 기존 org에 기본 요율표 seed (0~1:1.0% / 1~3:1.2% / 3~:1.5%)
insert into late_fee_rate_tiers (org_id, tier_order, from_month, to_month, monthly_rate)
select o.id, v.tier_order, v.from_month, v.to_month, v.monthly_rate
from organizations o
cross join (values
  (1, 0, 1, 1.0),
  (2, 1, 3, 1.2),
  (3, 3, null::int, 1.5)
) as v(tier_order, from_month, to_month, monthly_rate)
where not exists (
  select 1 from late_fee_rate_tiers t where t.org_id = o.id
);

-- 3) 세대×월분별 미납원금·납기일 (0022 period_balances를 그대로 노출)
create or replace function list_overdue_periods(
  p_building_id bigint,
  p_target_year int default extract(year from timezone('Asia/Seoul', now()))::int,
  p_target_month int default extract(month from timezone('Asia/Seoul', now()))::int,
  p_scope text default 'all'
)
returns table(
  occupancy_id bigint,
  unit_id bigint,
  period date,
  unpaid_principal bigint,
  due_date date
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
  )
  select
    pb.occupancy_id,
    pb.unit_id,
    pb.period,
    pb.outstanding as unpaid_principal,
    coalesce(
      bps.due_date,
      (date_trunc('month', pb.period) + interval '1 month' - interval '1 day')::date
    ) as due_date
  from period_balances pb
  left join billing_period_settings bps
    on bps.building_id = p_building_id
   and bps.period = pb.period
  where pb.outstanding > 0
  order by pb.occupancy_id, pb.unit_id, pb.period;
end;
$$;

revoke execute on function list_overdue_periods(bigint, int, int, text) from public, anon;
grant execute on function list_overdue_periods(bigint, int, int, text) to authenticated;
