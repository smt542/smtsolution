-- 0151: list_billing 반환에 세대 평수(units.area_pyeong) 추가
-- 세대별 관리비 표(원본 프로토타입: 성명 / "N평 / 룸타입" / 입주일 3줄)의 평수를 실데이터로 채우기 위함.
-- 반환 컬럼 추가는 반환 타입 변경이라 create or replace가 불가 → drop 후 재생성한다.
-- (drop + create를 한 쿼리로 보내면 단일 암묵적 트랜잭션이라 원자적으로 교체된다.)
-- area_pyeong은 기존 컬럼 순서를 건드리지 않도록 반환 테이블 맨 뒤에 추가한다.
-- 주의: 0104 receipts RPC가 `list_billing(...) br` 를 `br.*`로 확장하므로 billing_items JSON에
--       area_pyeong 키가 항목마다 중복 포함되지만(무해, 소비측은 키 이름으로만 읽음) 동작엔 영향 없음.

drop function if exists list_billing(bigint, date);

create function list_billing(p_building_id bigint, p_period date)
returns table(
  unit_id bigint, unit_no text, dong text, room_type_label text,
  occupancy_id bigint, tenant_name text, move_in_date date, is_vacant boolean,
  fee_item_id bigint, fee_item_name text, carry_over boolean, daily_proration boolean,
  rounding text, is_required boolean, sort_order int,
  charged boolean, amount integer,
  confirmed_at timestamptz, confirmed_by_name text, total_amount integer,
  billing_note text, unit_notice text, is_dirty boolean,
  area_pyeong numeric
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
      o.unit_id, o.id as occupancy_id, o.tenant_name, o.move_in_date, o.status, o.room_type_id
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
    coalesce(fic.amount, case when fi.carry_over then prev.amount else 0 end, 0) as amount,
    bc.confirmed_at, pr.full_name as confirmed_by_name, bc.total_amount,
    bc.billing_note, bc.unit_notice,
    coalesce(bc.confirmed_at is not null and exists (
      select 1 from fee_item_charges x
      where x.unit_id = u.id and x.period = p_period and x.updated_at > bc.confirmed_at
    ), false) as is_dirty,
    u.area_pyeong
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
