-- 0062_partner_field_app.sql
-- 현장(field) 파트너 모바일 앱 백엔드.
-- 기존 staff 테이블(buildings/complaints/units/as_categories)을 재사용하고,
-- 현장 계정이 "담당 건물"만 접근하는 SECURITY DEFINER RPC만 추가한다.
-- 담당 건물 = buildings.manager_user_id | meter_user_id | cleaning_user_id 중 caller.
-- 의존: P0(org_members/my_org_ids), P1a(buildings/units), P2b(as_categories), P3(complaints).
-- 기존 staff RLS/정책/화면은 변경하지 않는다(신규 함수만 추가).

-- 담당 건물 id 집합 (org 격리 + 담당자 매핑)
create or replace function partner_my_building_ids()
returns setof bigint
language sql stable security definer set search_path = public as $$
  select b.id
  from buildings b
  where b.deleted_at is null
    and b.org_id in (select my_org_ids())
    and (select auth.uid()) in (b.manager_user_id, b.meter_user_id, b.cleaning_user_id);
$$;
revoke execute on function partner_my_building_ids() from anon;

-- 담당 건물의 AS/민원 목록 (홈 = A/S현황 조회)
create or replace function partner_list_complaints()
returns table (
  id bigint,
  building_id bigint,
  building_name text,
  unit_label text,
  category_label text,
  title text,
  content text,
  status text,
  received_at timestamptz,
  completed_at timestamptz,
  assigned_to uuid,
  assigned_name text,
  is_mine boolean
)
language sql stable security definer set search_path = public as $$
  select
    c.id,
    c.building_id,
    b.name,
    nullif(trim(coalesce(u.dong, '') || ' ' || coalesce(u.unit_no, '')), ''),
    cat.label,
    c.title,
    c.content,
    c.status,
    c.received_at,
    c.completed_at,
    c.assigned_to,
    p.full_name,
    (c.assigned_to = (select auth.uid()))
  from complaints c
  join buildings b on b.id = c.building_id
  left join units u on u.id = c.unit_id
  left join as_categories cat on cat.id = c.category_id
  left join profiles p on p.user_id = c.assigned_to
  where c.deleted_at is null
    and c.building_id in (select partner_my_building_ids())
  order by c.received_at desc;
$$;
revoke execute on function partner_list_complaints() from anon;
