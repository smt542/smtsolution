-- 0216: 세입자 퇴실 신청의 범위를 계정 단위에서 연결 세대(점유) 단위로 맞춘다.
-- 2026-10-01 운영: 세대를 옮긴 세입자 계정이 퇴실 신청 때 'pending move-out request already exists'로 막혔다.
-- 생성 검사·유니크 인덱스(0041)는 계정 전체의 pending을 보는데 조회·변경·취소(0041·0211)는 연결 세대만 봐서,
-- 예전 세대에 남은 신청이 화면엔 안 보이면서 새 신청을 막았다. 퇴실 처리(execute_move_out)·이사정산 완료는
-- 점유를 공실로 바꿔도 신청을 닫지 않아 그런 신청이 남는다.
-- - 점유가 공실·소프트 삭제되면 그 점유의 열린 신청을 처리 완료(우측 패널 [처리 완료]와 같은 값)로 닫는 트리거 + 기존 데이터 소급.
-- - pending 유니크 범위를 (계정, 점유)로 바꾸고, resident_create_move_out 중복 검사를 연결 세대 기준으로.
--   인자·반환형이 0041과 같아 create or replace로 교체한다(권한은 아래에서 다시 선언).

-- ===== 공실·삭제 시 열린 퇴실 신청 처리 =====
create or replace function public.close_move_out_requests_on_vacate()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  update move_out_requests
  set status = 'confirmed',
      resolved_at = now(),
      resolved_by = auth.uid()
  where occupancy_id = new.id
    and status in ('pending', 'confirmed')
    and resolved_at is null;

  return null;
end;
$$;

revoke all on function public.close_move_out_requests_on_vacate() from public, anon, authenticated;

drop trigger if exists trg_occupancies_close_move_out_requests on occupancies;
create trigger trg_occupancies_close_move_out_requests
  after update of status, deleted_at on occupancies
  for each row
  when (
    (new.status = 'vacant' and old.status is distinct from new.status)
    or (new.deleted_at is not null and old.deleted_at is null)
  )
  execute function public.close_move_out_requests_on_vacate();

-- ===== 기존 공실·삭제 점유의 열린 신청 소급 정리 =====
update move_out_requests mor
set status = 'confirmed',
    resolved_at = now()
from occupancies o
where mor.occupancy_id = o.id
  and (o.status = 'vacant' or o.deleted_at is not null)
  and mor.status in ('pending', 'confirmed')
  and mor.resolved_at is null;

-- ===== 처리 전 퇴실 신청 유니크 범위 변경 =====
drop index if exists move_out_one_pending_per_resident;
create unique index if not exists move_out_one_pending_per_occupancy
  on move_out_requests (resident_user_id, occupancy_id)
  where status = 'pending';

-- ===== 연결 세대 기준 resident_create_move_out 교체 =====
create or replace function resident_create_move_out(
  p_desired_date date,
  p_reason text default null
)
returns bigint
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_link record;
  v_request_id bigint;
begin
  select * into v_link
  from resident_linked_unit();
  if not found then
    raise exception 'linked occupancy not found';
  end if;
  if p_desired_date is null then
    raise exception 'desired date required' using errcode = '22023';
  end if;
  if exists (
    select 1
    from move_out_requests mor
    where mor.resident_user_id = auth.uid()
      and mor.status = 'pending'
      and mor.occupancy_id = v_link.occupancy_id
  ) then
    raise exception 'pending move-out request already exists';
  end if;

  insert into move_out_requests (
    org_id,
    resident_user_id,
    occupancy_id,
    unit_id,
    building_id,
    desired_date,
    reason
  ) values (
    v_link.org_id,
    auth.uid(),
    v_link.occupancy_id,
    v_link.unit_id,
    v_link.building_id,
    p_desired_date,
    p_reason
  )
  returning id into v_request_id;

  return v_request_id;
end;
$$;

revoke execute on function resident_create_move_out(date, text) from anon, public;
grant execute on function resident_create_move_out(date, text) to authenticated;
