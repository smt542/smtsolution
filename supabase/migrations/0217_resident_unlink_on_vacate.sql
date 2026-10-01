-- 0217: 퇴실 시 세입자 앱 연결을 해제하고 퇴실 신청을 정산 완료(done)로 처리한다.
-- 새 입주자 등록은 퇴실 처리된 같은 입주 행을 다시 쓰는데(save_unit_occupancy), 퇴실 처리·이사정산 완료는
-- 세입자 연결(res_claims linked)을 남겨 두었다 → 같은 행에 다른 사람이 들어오면 예전 계정 연결이 되살아나
-- 새 입주자 이름·전화가 보이고(2026-10-01 롤백 시험), 새 입주자는 0132 유니크에 막혀 연결하지 못했다.
-- - 기획 결정(2026-10-01): 퇴실하면 앱 연결을 끊고, 퇴실한 사람이 앱을 열면 세대 연결 화면(가드 → /resident/verify).
-- - 퇴실 신청 최종 상태 = PRD 상태·코드 §2의 done(정산 완료). 우측 패널 [처리 완료](confirmed)와 별개다.
-- - 0216 트리거 함수 본문을 넓히고(이름·트리거·권한 유지), 기존 데이터도 같은 규칙으로 소급한다.
-- - 방어선: resident_linked_unit·resident_my_link는 그 세대 마지막 퇴실(occupancy_history)보다 먼저 맺은 연결을
--   무효로 본다. 인자·반환형이 같아 create or replace(권한은 아래에서 다시 선언).

-- ===== 퇴실 신청 상태에 정산 완료 추가 =====
alter table move_out_requests drop constraint if exists move_out_requests_status_check;
alter table move_out_requests add constraint move_out_requests_status_check
  check (status in ('pending', 'confirmed', 'canceled', 'rejected', 'done'));

-- ===== 공실·삭제 시 퇴실 신청 정산 완료 및 세입자 앱 연결 해제 =====
create or replace function public.close_move_out_requests_on_vacate()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  update move_out_requests
  set status = 'done',
      resolved_at = coalesce(resolved_at, now()),
      resolved_by = coalesce(resolved_by, auth.uid())
  where occupancy_id = new.id
    and status in ('pending', 'confirmed');

  with ended as (
    delete from res_claims rc
    where rc.occupancy_id = new.id
      and rc.status = 'linked'
    returning rc.id, rc.org_id, rc.resident_user_id, rc.building_id, rc.unit_id, rc.occupancy_id,
      coalesce(rc.resolved_at, rc.created_at) as linked_at
  )
  insert into audit_log (org_id, actor_id, action, table_name, row_pk, before)
  select e.org_id, auth.uid(), 'CLAIM_UNLINK_MOVE_OUT', 'res_claims', e.id::text,
    jsonb_build_object(
      'resident_user_id', e.resident_user_id,
      'building_id', e.building_id,
      'unit_id', e.unit_id,
      'occupancy_id', e.occupancy_id,
      'linked_at', e.linked_at
    )
  from ended e;

  return null;
end;
$$;

revoke all on function public.close_move_out_requests_on_vacate() from public, anon, authenticated;

-- ===== 기존 공실·삭제 점유의 퇴실 신청 및 무효 연결 소급 정리 =====
update move_out_requests mor
set status = 'done',
    resolved_at = coalesce(mor.resolved_at, now())
from occupancies o
where mor.occupancy_id = o.id
  and (o.status = 'vacant' or o.deleted_at is not null)
  and mor.status in ('pending', 'confirmed');

with ended as (
  delete from res_claims rc
  where rc.status = 'linked'
    and (
      not exists (
        select 1
        from occupancies o
        where o.id = rc.occupancy_id
      )
      or exists (
        select 1
        from occupancies o
        where o.id = rc.occupancy_id
          and (o.status = 'vacant' or o.deleted_at is not null)
      )
      or coalesce(rc.resolved_at, rc.created_at) < (
        select max(h.created_at)
        from occupancy_history h
        where h.unit_id = rc.unit_id
      )
    )
  returning rc.id, rc.org_id, rc.resident_user_id, rc.building_id, rc.unit_id, rc.occupancy_id,
    coalesce(rc.resolved_at, rc.created_at) as linked_at
)
insert into audit_log (org_id, actor_id, action, table_name, row_pk, before)
select e.org_id, null, 'CLAIM_UNLINK_MOVE_OUT', 'res_claims', e.id::text,
  jsonb_build_object(
    'resident_user_id', e.resident_user_id,
    'building_id', e.building_id,
    'unit_id', e.unit_id,
    'occupancy_id', e.occupancy_id,
    'linked_at', e.linked_at
  )
from ended e;

-- ===== 마지막 퇴실 이전 연결 방어선 =====
create or replace function resident_linked_unit()
returns table (
  org_id bigint,
  building_id bigint,
  unit_id bigint,
  occupancy_id bigint,
  move_in date,
  move_out date,
  tenant_name text
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select
    b.org_id,
    b.id,
    u.id,
    o.id,
    o.move_in_date,
    o.move_out_date,
    o.tenant_name
  from res_claims rc
  join occupancies o on o.id = rc.occupancy_id
    and o.deleted_at is null
    and o.status in ('occupied', 'moving_out')
  join units u on u.id = o.unit_id
  join buildings b on b.id = u.building_id
  where rc.resident_user_id = auth.uid()
    and rc.status = 'linked'
    and coalesce(rc.resolved_at, rc.created_at) > coalesce((select max(h.created_at) from occupancy_history h where h.unit_id = u.id), '-infinity'::timestamptz)
  order by rc.created_at desc, rc.id desc
  limit 1;
$$;

create or replace function resident_my_link()
returns table (
  claim_id bigint,
  org_id bigint,
  building_id bigint,
  building_name text,
  unit_id bigint,
  unit_no text,
  occupancy_id bigint,
  tenant_name text,
  occupancy_phone text,
  linked_at timestamptz
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;

  return query
  select
    rc.id,
    rc.org_id,
    rc.building_id,
    b.name,
    rc.unit_id,
    u.unit_no,
    rc.occupancy_id,
    o.tenant_name,
    o.phone,
    coalesce(rc.resolved_at, rc.created_at)
  from res_claims rc
  left join buildings b on b.id = rc.building_id
  left join units u on u.id = rc.unit_id
  left join occupancies o on o.id = rc.occupancy_id
  where rc.resident_user_id = auth.uid()
    and rc.status = 'linked'
    and coalesce(rc.resolved_at, rc.created_at) > coalesce((select max(h.created_at) from occupancy_history h where h.unit_id = rc.unit_id), '-infinity'::timestamptz)
  order by rc.created_at desc
  limit 1;
end
$$;

revoke execute on function resident_linked_unit() from anon, public;
grant execute on function resident_linked_unit() to authenticated;
revoke execute on function resident_my_link() from anon, public;
grant execute on function resident_my_link() to authenticated;
