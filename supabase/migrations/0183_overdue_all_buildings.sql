-- 미납 조회를 "건물 필수"에서 "전체 건물(기본)"으로 바꾼다.
--
-- 정본 overdue-management.dc.html 은 년·월만 고르면 org 전체 미납을 보여주고, 건물명 입력칸은
-- 결과를 거르는 검색어일 뿐이다(출력물도 여러 건물이 한 장에 섞여 나온다). 앱은 두 조회 RPC가
-- `p_building_id` 를 필수로 받아 건물을 고르기 전에는 질의 자체가 나가지 않았다.
--
-- 변경은 두 가지뿐이다.
--   1) p_building_id 에 default null → 인자 타입 (bigint,int,int,text) 은 그대로라 오버로드가
--      생기지 않는다(PGRST203 위험 없음 — [[postgrest-function-overload-ambiguity]]).
--   2) 건물 필터를 조건부로: `p_building_id is null or u.building_id = p_building_id`.
-- org 경계는 기존대로 `buildings.org_id = current_user_org()` 조인이 지킨다 — 전체 조회라도
-- 남의 org 건물은 섞이지 않는다.
--
-- ⚠️ list_overdue_periods 의 납기일 조회는 `bps.building_id = p_building_id` 로 파라미터를
--    직접 쓰고 있었다. 전체 조회에서는 세대마다 건물이 다르므로 building_id 를 CTE로 흘려
--    행별로 조인해야 한다(안 하면 전체 조회 시 납기일이 전부 fallback 으로 떨어진다).
--
-- 본문은 0132 최신본에서 위 세 군데만 손댔다.

-- =====================================================================
-- list_overdue_periods
-- =====================================================================
create or replace function list_overdue_periods(
  p_building_id bigint default null,
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
    select bc.occupancy_id, bc.unit_id, co.building_id, bc.period, bc.total_amount
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
      greatest(bc.total_amount::bigint - coalesce(sum(p.amount), 0)::bigint, 0::bigint) as outstanding
    from scoped_confirmations bc
    left join payments p
      on p.occupancy_id = bc.occupancy_id
     and p.unit_id = bc.unit_id
     and p.period = bc.period
     and p.status = 'active'
    group by bc.occupancy_id, bc.unit_id, bc.building_id, bc.period, bc.total_amount
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
    on bps.building_id = pb.building_id
   and bps.period = pb.period
  where pb.outstanding > 0
  order by pb.occupancy_id, pb.unit_id, pb.period;
end;
$$;

revoke execute on function list_overdue_periods(bigint, int, int, text) from public, anon;
grant execute on function list_overdue_periods(bigint, int, int, text) to authenticated;

-- =====================================================================
-- list_overdue_aggregates
-- =====================================================================
create or replace function list_overdue_aggregates(
  p_building_id bigint default null,
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
    coalesce(bs.billing_available, false)
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
$$;

revoke execute on function list_overdue_aggregates(bigint, int, int, text) from public, anon;
grant execute on function list_overdue_aggregates(bigint, int, int, text) to authenticated;

notify pgrst, 'reload schema';
