-- 필수 공과금 항목(전기·수도료·가스)의 기본 부과액을 그 달 공과금 산정값으로 채운다.
--
-- 0120 이후 모든 건물 유형이 공과금을 관리비 항목으로 갖는데, 저장된 부과액이 없으면
-- 지금까지는 전월 금액이 이월(carry_over)돼 매달 바뀌는 공과금이 지난달 값으로 확정됐다.
-- 이제 저장값(fee_item_charges)이 없으면 meter_readings 의 산정값(manual_charge ?? calc_charge,
-- 관리비 화면 공과금 칸·공과금 관리와 같은 식)을 쓰고, 산정값도 없을 때만 기존처럼 이월한다.
-- 수기로 저장한 값은 그대로 우선한다.
--
-- list_billing(표시)·confirm_billing(확정)·charge_new_occupancies(신규 입주 부과)가 같은
-- 기본값을 쓰도록 세 함수를 함께 교체한다. 시그니처·반환 타입이 그대로라 create or replace
-- (권한 유지·새 오버로드 없음). 본문은 각 최신 정의(0192·0021·0092)와 기본값 식만 다르다.

-- 필수 공과금 항목이면 그 세대·그 달 산정값, 아니면 null.
create or replace function billing_utility_default(
  p_unit_id bigint, p_period date, p_is_required boolean, p_item_name text
) returns integer language sql stable set search_path = public as $$
  select coalesce(mr.manual_charge, mr.calc_charge)
  from meter_readings mr
  where p_is_required
    and mr.unit_id = p_unit_id
    and mr.period = p_period
    and mr.utility = case p_item_name
      when '수도료' then 'water'
      when '전기' then 'elec'
      when '가스' then 'gas'
    end
$$;

-- 내부 계산용 — 호출은 security definer 함수 안에서만 한다.
revoke all on function billing_utility_default(bigint, date, boolean, text) from public, anon, authenticated;

create or replace function list_billing(p_building_id bigint, p_period date)
returns table(
  unit_id bigint, unit_no text, dong text, room_type_label text,
  occupancy_id bigint, tenant_name text, move_in_date date, is_vacant boolean,
  fee_item_id bigint, fee_item_name text, carry_over boolean, daily_proration boolean,
  rounding text, is_required boolean, sort_order int,
  charged boolean, amount integer,
  confirmed_at timestamptz, confirmed_by_name text, total_amount integer,
  billing_note text, unit_notice text, is_dirty boolean,
  area_pyeong numeric,
  mgmt_fee_amount bigint
) language sql stable security definer set search_path = public as $$
  with b as (
    select id, type_id from buildings where id = p_building_id and org_id = current_user_org()
  ),
  fi as (
    select * from fee_items where type_id = (select type_id from b) and deleted_at is null
  ),
  u as (
    select id, unit_no, dong, area_pyeong from units where building_id = p_building_id and deleted_at is null
  ),
  occ as (
    select distinct on (o.unit_id)
      o.unit_id, o.id as occupancy_id, o.tenant_name, o.move_in_date, o.status, o.room_type_id,
      o.mgmt_fee_amount
    from occupancies o join u on u.id = o.unit_id
    where o.deleted_at is null
    order by o.unit_id, o.created_at desc, o.id desc
  )
  select
    u.id, u.unit_no, u.dong, rt.label,
    occ.occupancy_id, occ.tenant_name, occ.move_in_date,
    coalesce(occ.status = 'vacant', true) as is_vacant,
    fi.id, fi.name, fi.carry_over, fi.daily_proration, fi.rounding, fi.is_required, fi.sort_order,
    coalesce(fic.charged, true) as charged,
    coalesce(
      fic.amount,
      billing_utility_default(u.id, p_period, fi.is_required, fi.name),
      case when fi.carry_over then prev.amount else 0 end,
      0
    ) as amount,
    bc.confirmed_at, pr.full_name as confirmed_by_name, bc.total_amount,
    bc.billing_note, bc.unit_notice,
    coalesce(bc.confirmed_at is not null and exists (
      select 1 from fee_item_charges x
      where x.unit_id = u.id and x.period = p_period and x.updated_at > bc.confirmed_at
    ), false) as is_dirty,
    u.area_pyeong,
    occ.mgmt_fee_amount
  from u
  cross join fi
  left join occ on occ.unit_id = u.id
  left join room_types rt on rt.id = occ.room_type_id
  left join fee_item_charges fic on fic.unit_id = u.id and fic.fee_item_id = fi.id and fic.period = p_period
  left join fee_item_charges prev on prev.unit_id = u.id and prev.fee_item_id = fi.id
       and prev.period = (p_period - interval '1 month')::date
  left join billing_confirmations bc on bc.unit_id = u.id and bc.period = p_period
  left join profiles pr on pr.user_id = bc.confirmed_by
  order by u.unit_no, fi.sort_order
$$;

revoke execute on function list_billing(bigint, date) from public, anon;
grant execute on function list_billing(bigint, date) to authenticated;

create or replace function confirm_billing(p_building_id bigint, p_period date)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_org bigint; v_unit record; v_item record;
  v_items jsonb; v_total bigint; v_amt int;
  v_days int; v_occupied int; v_count int := 0; v_grand bigint := 0;
begin
  v_org := current_user_org();
  if v_org is null then raise exception 'no org for caller'; end if;
  if not current_user_has_module('billing') then raise exception 'forbidden: billing required'; end if;
  if not exists (select 1 from buildings where id = p_building_id and org_id = v_org) then
    raise exception 'building not in org'; end if;
  if p_period is null or p_period <> date_trunc('month', p_period)::date then
    raise exception 'period must be first of month'; end if;
  if p_period > date_trunc('month', now() at time zone 'Asia/Seoul')::date then
    raise exception 'future period is not allowed'; end if;

  v_days := extract(day from ((p_period + interval '1 month')::date - 1))::int;

  for v_unit in
    select u.id as unit_id, occ.id as occ_id, occ.tenant_name, occ.move_in_date, occ.status
    from units u
    left join lateral (
      select * from occupancies o where o.unit_id = u.id and o.deleted_at is null
      order by o.created_at desc, o.id desc limit 1
    ) occ on true
    where u.building_id = p_building_id and u.deleted_at is null
  loop
    if coalesce(v_unit.status = 'vacant', true) then continue; end if;  -- 공실 제외

    if v_unit.move_in_date is not null
       and v_unit.move_in_date between p_period and ((p_period + interval '1 month')::date - 1) then
      v_occupied := ((p_period + interval '1 month')::date - v_unit.move_in_date);  -- 입주일 포함
    else
      v_occupied := v_days;
    end if;

    v_items := '[]'::jsonb; v_total := 0;
    for v_item in
      select
        fi.id as fee_item_id,
        fi.name,
        coalesce(
          fic.amount,
          billing_utility_default(v_unit.unit_id, p_period, fi.is_required, fi.name),
          case when fi.carry_over then prev.amount else 0 end,
          0
        ) as amount,
        fi.daily_proration,
        fi.rounding
      from buildings b
      join fee_items fi
        on fi.type_id = b.type_id and fi.org_id = v_org and fi.deleted_at is null
      left join fee_item_charges fic
        on fic.unit_id = v_unit.unit_id and fic.fee_item_id = fi.id and fic.period = p_period
      left join fee_item_charges prev
        on prev.unit_id = v_unit.unit_id and prev.fee_item_id = fi.id
       and prev.period = (p_period - interval '1 month')::date
      where b.id = p_building_id and coalesce(fic.charged, true)
      order by fi.sort_order, fi.id
    loop
      if v_item.daily_proration and v_occupied < v_days then
        -- 계산규칙 1.1: 일할 분모 고정 30일(중간입주 판정은 v_days 유지)
        v_amt := round_charge(v_item.amount::numeric * v_occupied / 30, v_item.rounding);
      else
        v_amt := v_item.amount;
      end if;
      v_items := v_items || jsonb_build_object('fee_item_id', v_item.fee_item_id, 'name', v_item.name, 'charged', true, 'amount', v_amt);
      v_total := v_total + v_amt;
    end loop;

    insert into billing_confirmations(unit_id, period, occupancy_id, total_amount, confirmed_at, confirmed_by)
      values (v_unit.unit_id, p_period, v_unit.occ_id, v_total, now(), auth.uid())
      on conflict (unit_id, period) do update
        set occupancy_id = excluded.occupancy_id, total_amount = excluded.total_amount,
            confirmed_at = excluded.confirmed_at, confirmed_by = excluded.confirmed_by;

    insert into billing_history(unit_id, period, occupancy_id, tenant_name, total_amount, items, confirmed_at, confirmed_by)
      values (v_unit.unit_id, p_period, v_unit.occ_id, v_unit.tenant_name, v_total, v_items, now(), auth.uid());

    v_count := v_count + 1; v_grand := v_grand + v_total;
  end loop;

  insert into audit_log(org_id, actor_id, action, table_name, row_pk, after)
    values (v_org, auth.uid(), 'BILLING_CONFIRM', 'billing_confirmations', p_building_id::text,
      jsonb_build_object('period', p_period, 'unit_count', v_count, 'total', v_grand));

  return jsonb_build_object('unit_count', v_count, 'total', v_grand);
end $$;

revoke execute on function confirm_billing(bigint, date) from public, anon;
grant execute on function confirm_billing(bigint, date) to authenticated;

create or replace function charge_new_occupancies(p_building_id bigint, p_period date, p_unit_ids bigint[])
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_org bigint; v_unit record; v_item record;
  v_items jsonb; v_total bigint; v_amt int;
  v_days int; v_occupied int; v_count int := 0; v_grand bigint := 0;
begin
  v_org := current_user_org();
  if v_org is null then raise exception 'no org for caller'; end if;
  if not current_user_has_module('billing') then raise exception 'forbidden: billing required'; end if;
  if not exists (select 1 from buildings where id = p_building_id and org_id = v_org) then
    raise exception 'building not in org'; end if;
  if p_period is null or p_period <> date_trunc('month', p_period)::date then
    raise exception 'period must be first of month'; end if;
  if p_period > date_trunc('month', now() at time zone 'Asia/Seoul')::date then
    raise exception 'future period is not allowed'; end if;

  v_days := extract(day from ((p_period + interval '1 month')::date - 1))::int;

  -- 감지대상(list_uncharged_new_occupancies와 동일 필터) ∩ p_unit_ids 만 처리(임의 세대 차단)
  for v_unit in
    select u.id as unit_id, occ.id as occ_id, occ.tenant_name, occ.move_in_date, occ.status, occ.created_at
    from units u
    left join lateral (
      select * from occupancies o where o.unit_id = u.id and o.deleted_at is null
      order by o.created_at desc, o.id desc limit 1
    ) occ on true
    where u.building_id = p_building_id and u.deleted_at is null
      and u.id = any(p_unit_ids)
      and coalesce(occ.status, 'vacant') = 'occupied'
      and occ.created_at > (
        select max(bc.confirmed_at) from billing_confirmations bc
        join units u2 on u2.id = bc.unit_id
        where u2.building_id = p_building_id and bc.period = p_period and bc.confirmed_at is not null
      )
      and not exists (
        select 1 from billing_confirmations bc
        where bc.unit_id = u.id and bc.period = p_period and bc.confirmed_at is not null
      )
  loop
    if v_unit.move_in_date is not null
       and v_unit.move_in_date between p_period and ((p_period + interval '1 month')::date - 1) then
      v_occupied := ((p_period + interval '1 month')::date - v_unit.move_in_date);  -- 입주일 포함
    else
      v_occupied := v_days;
    end if;

    v_items := '[]'::jsonb; v_total := 0;
    for v_item in
      select fi.id as fee_item_id, fi.name,
        coalesce(
          fic.amount,
          billing_utility_default(v_unit.unit_id, p_period, fi.is_required, fi.name),
          case when fi.carry_over then prev.amount else 0 end,
          0
        ) as amount,
        fi.daily_proration, fi.rounding
      from buildings b
      join fee_items fi on fi.type_id = b.type_id and fi.org_id = v_org and fi.deleted_at is null
      left join fee_item_charges fic on fic.unit_id = v_unit.unit_id and fic.fee_item_id = fi.id and fic.period = p_period
      left join fee_item_charges prev on prev.unit_id = v_unit.unit_id and prev.fee_item_id = fi.id
           and prev.period = (p_period - interval '1 month')::date
      where b.id = p_building_id and coalesce(fic.charged, true)
      order by fi.sort_order, fi.id
    loop
      if v_item.daily_proration and v_occupied < v_days then
        -- 계산규칙 1.1: 일할 분모 고정 30일 (confirm_billing 0021과 동일)
        v_amt := round_charge(v_item.amount::numeric * v_occupied / 30, v_item.rounding);
      else
        v_amt := v_item.amount;
      end if;
      v_items := v_items || jsonb_build_object('fee_item_id', v_item.fee_item_id, 'name', v_item.name, 'charged', true, 'amount', v_amt);
      v_total := v_total + v_amt;
    end loop;

    insert into billing_confirmations(unit_id, period, occupancy_id, total_amount, confirmed_at, confirmed_by)
      values (v_unit.unit_id, p_period, v_unit.occ_id, v_total, now(), auth.uid())
      on conflict (unit_id, period) do update
        set occupancy_id = excluded.occupancy_id, total_amount = excluded.total_amount,
            confirmed_at = excluded.confirmed_at, confirmed_by = excluded.confirmed_by;

    insert into billing_history(unit_id, period, occupancy_id, tenant_name, total_amount, items, confirmed_at, confirmed_by)
      values (v_unit.unit_id, p_period, v_unit.occ_id, v_unit.tenant_name, v_total, v_items, now(), auth.uid());

    v_count := v_count + 1; v_grand := v_grand + v_total;
  end loop;

  insert into audit_log(org_id, actor_id, action, table_name, row_pk, after)
    values (v_org, auth.uid(), 'BILLING_CHARGE_NEW', 'billing_confirmations', p_building_id::text,
      jsonb_build_object('period', p_period, 'unit_count', v_count, 'total', v_grand));

  return jsonb_build_object('unit_count', v_count, 'total', v_grand);
end $$;

revoke execute on function charge_new_occupancies(bigint, date, bigint[]) from public, anon;
grant execute on function charge_new_occupancies(bigint, date, bigint[]) to authenticated;
