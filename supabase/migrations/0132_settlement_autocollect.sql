-- 0132_settlement_autocollect.sql
-- 퇴실정산(정산완료+공실) 자동수납 + 미납관리 공실 미표시 버그 수정
-- 의존:
--   C2a  complete_moving_settlement  ← 0008(원정의, moving 게이트 유지) 위에 재정의
--                                       payments(0015) INSERT + billing_confirmations(0012) 기준 미납 계산
--                                       occupancy 귀속 = billing_confirmations.occupancy_id(0131 규약과 동일)
--   C2c  list_overdue_periods        ← 0031(최신본) 위에 재정의 — 점유상태 게이트만 완화
--        list_overdue_aggregates     ← 0022 위에 재정의 — 동일하게 점유상태 게이트만 완화
-- 모듈 게이트: moving(정산완료) / billing(미납조회). payments INSERT는 definer(RLS bypass)로 수행하므로
--             정산 완료자가 payment 모듈을 갖지 않아도 자동수납이 성립한다(도메인 분리 유지).
-- ※ 라이브 미적용. Claude/사용자가 Management API로 적용한다.

-- =====================================================================
-- C2a) 정산완료 + 공실 + 미납 관리비 자동수납(원자적)
--   PRD moving-settlement.md §3.4 "정산완료+공실 — 미납 관리비 전부 수납 처리",
--        §6 결정로그 [2026-07-03] "정산완료+공실 — 미납 관리비 자동 수납".
--   · 서버측 미수금>0 하드블록은 존재하지 않았음(0008). UI 게이트만 PRD 확인팝업으로 교체.
--   · 세대의 미확정/미납 period마다 (확정부과액 − 유효수납합) 잔액을 payments에 1건씩 기록해 미납=0.
--     - 귀속 occupancy = 부과 당시 occupancy(billing_confirmations.occupancy_id) — 0131 귀속 규약과 동일.
--       (billing_confirmations는 (unit_id, period) 유니크)
--     - method='other', source='manual', kind='full', memo='퇴실정산 자동수납'로 출처 표시
--       (payments enum에 'settlement'가 없어 'other'로 마킹).
--   · 멱등: 1회 실행 후 잔액=0 → 재실행 시 per-period 루프가 아무 것도 INSERT하지 않음.
--     추가로 settlement.status='completed' 단축반환 + FOR UPDATE 락으로 동시 중복 방지.
-- =====================================================================
create or replace function complete_moving_settlement(p_settlement_id bigint)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_org bigint;
  v_unit_id bigint;
  v_occupancy_id bigint;
  v_move_out_date date;
  v_status text;
  v_row record;
  v_pay_id bigint;
  v_collected_count int := 0;
  v_collected_total bigint := 0;
begin
  v_org := current_user_org();
  if v_org is null then raise exception 'no org for caller'; end if;
  if not current_user_has_module('moving') then raise exception 'forbidden: moving required'; end if;

  select s.unit_id, s.occupancy_id, s.move_out_date, s.status
    into v_unit_id, v_occupancy_id, v_move_out_date, v_status
    from moving_settlements s
    join units u on u.id = s.unit_id
    join buildings b on b.id = u.building_id and b.org_id = v_org
    where s.id = p_settlement_id
    for update of s;
  if not found then raise exception 'settlement not in org'; end if;
  if v_status = 'completed' then return jsonb_build_object('ok', true); end if;
  if v_occupancy_id is null then raise exception 'settlement has no occupancy'; end if;
  if v_move_out_date is null then raise exception 'move out date required'; end if;

  update moving_settlements
    set status = 'completed', processed_at = now()
    where id = p_settlement_id;

  update occupancies
    set status = 'vacant', move_out_date = v_move_out_date, settlement_note = null
    where id = v_occupancy_id and unit_id = v_unit_id and deleted_at is null;
  if not found then raise exception 'occupancy not in unit'; end if;

  insert into occupancy_history(unit_id, tenant_name, move_in_date, move_out_date, room_type_label)
    select o.unit_id, o.tenant_name, o.move_in_date, v_move_out_date, rt.label
    from occupancies o
    left join room_types rt on rt.id = o.room_type_id
    where o.id = v_occupancy_id and o.unit_id = v_unit_id;

  -- 미납 관리비 자동수납: 확정 부과된 period마다 잔여 미납을 수납 기록.
  -- 귀속 occupancy는 부과 당시 값(bc.occupancy_id)을 사용한다(0131 규약).
  for v_row in
    select bc.period,
           bc.occupancy_id as charged_occupancy_id,
           (bc.total_amount - coalesce(sum(p.amount) filter (where p.status = 'active'), 0))::int as unpaid
    from billing_confirmations bc
    left join payments p
      on p.unit_id = bc.unit_id
     and p.period = bc.period
     and p.occupancy_id = bc.occupancy_id   -- reader(list_overdue)와 동일 귀속 합산 → 실행 후 미납=0 보장
    where bc.unit_id = v_unit_id
      and bc.confirmed_at is not null
    group by bc.period, bc.occupancy_id, bc.total_amount
    having (bc.total_amount - coalesce(sum(p.amount) filter (where p.status = 'active'), 0)) > 0
    order by bc.period
  loop
    insert into payments(
      org_id, unit_id, period, occupancy_id, amount, method, kind, memo, paid_at, source, created_by
    ) values (
      v_org, v_unit_id, v_row.period, v_row.charged_occupancy_id, v_row.unpaid,
      'other', 'full', '퇴실정산 자동수납', v_move_out_date, 'manual', auth.uid()
    ) returning id into v_pay_id;

    v_collected_count := v_collected_count + 1;
    v_collected_total := v_collected_total + v_row.unpaid;
  end loop;

  if v_collected_count > 0 then
    insert into audit_log(org_id, actor_id, action, table_name, row_pk, after)
      values (v_org, auth.uid(), 'SETTLEMENT_AUTOCOLLECT', 'moving_settlements', p_settlement_id::text,
        jsonb_build_object(
          'unit_id', v_unit_id,
          'occupancy_id', v_occupancy_id,
          'move_out_date', v_move_out_date,
          'collected_count', v_collected_count,
          'collected_total', v_collected_total));
  end if;

  -- 수도지침은 다음 월 list_utility_rows가 전월 current를 previous로 읽으므로 별도 이월 write가 없다.
  return jsonb_build_object(
    'ok', true,
    'collected_count', v_collected_count,
    'collected_total', v_collected_total);
end $$;
revoke execute on function complete_moving_settlement(bigint) from public, anon;
grant execute on function complete_moving_settlement(bigint) to authenticated;

-- =====================================================================
-- C2c) 미납관리 — 퇴실(공실/중도퇴실) 세대의 미납이 사라지는 버그 수정
--   0031/0022는 current_occupancies를 o.status='occupied'로 제한해, 정산 없이 퇴실한 세대의
--   미해소 미납이 미납관리에서 증발했다. 미납(outstanding>0)이 남아 있으면 최근 점유상태가
--   vacant/moving_out이어도 노출되도록 점유상태 게이트만 완화한다(집계 로직은 불변).
--   · 자동수납으로 숨기는 방식에 의존하지 않는다 — 미정산 퇴실은 여전히 채무를 보여야 한다.
--   · scoped_confirmations는 부과 당시 occupancy(bc.occupancy_id)를 기준으로 하므로,
--     current_occupancies는 "부과 귀속 occupancy가 이 건물/org에 속하는지"만 판정하면 된다.
-- =====================================================================

-- --- list_overdue_periods (0031 최신본에서 상태 게이트만 완화) ---
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
  with scoped_occupancies as (
    -- 최근 점유상태와 무관하게 이 건물/org에 속한 (귀속) occupancy를 모두 포함한다.
    -- 미납이 있으면 공실/중도퇴실 세대도 노출되어야 하므로 status 게이트를 두지 않는다.
    select o.id as occupancy_id, o.unit_id
    from occupancies o
    join units u on u.id = o.unit_id and u.deleted_at is null
    join buildings b on b.id = u.building_id and b.org_id = current_user_org()
    where u.building_id = p_building_id
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

-- --- list_overdue_aggregates (0022에서 상태 게이트만 완화 — periods와 정합 유지) ---
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
  with scoped_occupancies as (
    -- list_overdue_periods와 동일 규칙: status 게이트 없이 건물/org 귀속만 판정.
    select o.id as occupancy_id, o.unit_id
    from occupancies o
    join units u on u.id = o.unit_id and u.deleted_at is null
    join buildings b on b.id = u.building_id and b.org_id = current_user_org()
    where u.building_id = p_building_id
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
