-- 세입자 퇴실 신청: 확정(직원 [처리 완료]) 뒤에도 희망 퇴실일 변경·신청 취소를 받는다.
-- 원본 resident-home 바텀시트는 신청이 있으면 상태와 상관없이 '퇴실 신청 현황'과 [희망 퇴실일 변경][신청 취소]를
-- 보여 준다(2026-09-30 사용자 결정, QA W26).
-- - 변경·취소 대상 = 연결 세대의 최신 신청 한 건(resident_get_move_out이 보여 주는 것)이고, 상태가 pending·confirmed일 때만.
-- - 확정된 신청의 날짜를 바꾸면 처리 전(pending)으로 되돌린다(resolved_at·resolved_by 비움) → 직원 우측 패널에
--   새 날짜로 다시 뜬다(패널은 status pending·confirmed + resolved_at null만 보여 준다).
-- 인자·반환형이 0041과 같아 create or replace로 교체한다(권한 유지, 아래에서 다시 선언).

create or replace function resident_update_move_out(p_desired_date date)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_request_id bigint;
begin
  if p_desired_date is null then
    raise exception 'desired date required' using errcode = '22023';
  end if;

  select mor.id into v_request_id
  from resident_linked_unit() l
  join move_out_requests mor
    on mor.resident_user_id = auth.uid()
   and mor.org_id = l.org_id
   and mor.occupancy_id = l.occupancy_id
   and mor.unit_id = l.unit_id
   and mor.building_id = l.building_id
  order by mor.created_at desc, mor.id desc
  limit 1;

  update move_out_requests mor
  set desired_date = p_desired_date,
      status = 'pending',
      resolved_at = null,
      resolved_by = null
  where mor.id = v_request_id
    and mor.status in ('pending', 'confirmed');
  if not found then
    raise exception 'pending move-out request not found';
  end if;
end;
$$;

create or replace function resident_cancel_move_out()
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_request_id bigint;
begin
  select mor.id into v_request_id
  from resident_linked_unit() l
  join move_out_requests mor
    on mor.resident_user_id = auth.uid()
   and mor.org_id = l.org_id
   and mor.occupancy_id = l.occupancy_id
   and mor.unit_id = l.unit_id
   and mor.building_id = l.building_id
  order by mor.created_at desc, mor.id desc
  limit 1;

  update move_out_requests mor
  set status = 'canceled',
      canceled_at = now()
  where mor.id = v_request_id
    and mor.status in ('pending', 'confirmed');
  if not found then
    raise exception 'pending move-out request not found';
  end if;
end;
$$;

revoke execute on function resident_update_move_out(date) from anon, public;
grant execute on function resident_update_move_out(date) to authenticated;
revoke execute on function resident_cancel_move_out() from anon, public;
grant execute on function resident_cancel_move_out() to authenticated;
