-- 0072_partner_meter.sql
-- 파트너 모바일 검침: 담당 건물 세대의 수도/전기/가스 지침 조회·저장. period = 월1일(0007 규약).
-- 의존: 0062(partner_my_building_ids), 0007(meter_readings), P1a(units/occupancies).
-- 기존 staff 객체·RLS 불변, 신규 함수만.

-- 건물·월 지침 조회(세대 × 유틸리티). 전월값은 전월 current_reading으로 자동 채움.
create or replace function partner_list_meter_readings(p_building_id bigint, p_period date)
returns table (
  unit_id bigint, unit_no text, dong text, tenant_name text,
  utility text, previous_reading numeric, current_reading numeric, usage numeric
)
language sql stable security definer set search_path = public as $$
  with u as (
    select un.id, un.unit_no, un.dong, o.tenant_name
    from units un
    left join occupancies o on o.unit_id = un.id and o.deleted_at is null and o.status = 'occupied'
    where un.building_id = p_building_id and un.deleted_at is null
      and un.building_id in (select partner_my_building_ids())
  ),
  kinds(utility, ord) as (values ('water', 1), ('elec', 2), ('gas', 3))
  select u.id, u.unit_no, u.dong, u.tenant_name, k.utility,
    coalesce(cur.previous_reading, prev.current_reading),
    cur.current_reading, cur.usage
  from u
  cross join kinds k
  left join meter_readings cur
    on cur.unit_id = u.id and cur.utility = k.utility and cur.period = p_period
  left join meter_readings prev
    on prev.unit_id = u.id and prev.utility = k.utility
   and prev.period = (p_period - interval '1 month')::date
  order by nullif(regexp_replace(u.unit_no, '\D', '', 'g'), '')::int nulls last, u.unit_no, k.ord;
$$;
revoke execute on function partner_list_meter_readings(bigint, date) from anon;

-- 지침 저장(담당 건물만). p_readings = [{unit_id, utility, previous_reading, current_reading}]
create or replace function partner_save_meter_readings(p_building_id bigint, p_period date, p_readings jsonb)
returns void language plpgsql security definer set search_path = public as $$
declare v_item jsonb; v_unit bigint; v_util text; v_prev numeric; v_cur numeric; v_use numeric;
begin
  if p_building_id not in (select partner_my_building_ids()) then
    raise exception 'forbidden: not your building';
  end if;
  for v_item in select value from jsonb_array_elements(coalesce(p_readings, '[]'::jsonb)) loop
    v_unit := (v_item->>'unit_id')::bigint;
    v_util := v_item->>'utility';
    if v_util not in ('water', 'elec', 'gas') then continue; end if;
    if not exists (
      select 1 from units where id = v_unit and building_id = p_building_id and deleted_at is null
    ) then
      continue;
    end if;
    v_prev := nullif(v_item->>'previous_reading', '')::numeric;
    v_cur := nullif(v_item->>'current_reading', '')::numeric;
    v_use := case when v_cur is not null and v_prev is not null then greatest(0, v_cur - v_prev) else null end;
    update meter_readings set previous_reading = v_prev, current_reading = v_cur, usage = v_use
      where unit_id = v_unit and utility = v_util and period = p_period;
    if not found then
      insert into meter_readings(unit_id, utility, period, previous_reading, current_reading, usage)
        values (v_unit, v_util, p_period, v_prev, v_cur, v_use);
    end if;
  end loop;
end $$;
revoke execute on function partner_save_meter_readings(bigint, date, jsonb) from anon;
