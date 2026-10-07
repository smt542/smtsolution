-- 0229_org_operational_gate.sql
-- 문제점 개선1차 #4: 해지한 테넌트가 계속 접속할 수 있음.
-- 해지는 OrgFormModal에서 organizations.deleted_at만 채우고 status는 'active'로 둔다.
-- 그런데 게이트 함수들은 o.status = 'active'만 확인해, 해지된 테넌트의 직원·파트너가
-- 로그인하고 데이터를 읽고 쓸 수 있었다.
--
-- 조치: 테넌트 활성 게이트 전부에 `deleted_at is null`을 함께 건다.
--  - 공용 판정 org_is_operational(org_id)를 추가한다(새로 만드는 게이트는 이것을 쓴다).
--  - my_org_ids / current_user_org / current_user_is_master / current_user_has_module
--    / partner_org_building_ids: status='active' 조건 옆에
--    deleted_at is null 추가(그 외 본문은 실 DB 정의와 동일).
--  - get_my_context: 해지(deleted_at not null) 테넌트는 org_status를 'suspended'로 보고한다.
--    staff 로그인(api/staff/login)이 org_status !== 'active'면 거절하므로 해지 테넌트 로그인이 막힌다.
--    org_status enum에 'terminated'가 없어 'suspended'로 매핑한다.
-- 변경하지 않은 것: reserve_message_points(서비스 롤 전용 — 발송 API가 로그인·컨텍스트 게이트에서 먼저 막힌다),
--   record_login(감사 로그 org 선택용 정렬일 뿐 게이트 아님),
--   platform_get_overview_metrics(이미 deleted_at 반영).
-- create or replace는 기존 ACL을 유지하므로 grant는 새 함수에만 건다.

create or replace function public.org_is_operational(p_org_id bigint)
returns boolean
language sql
stable
security definer
set search_path to 'public'
as $$
  select exists (
    select 1 from organizations o
    where o.id = p_org_id and o.status = 'active' and o.deleted_at is null
  )
$$;

revoke execute on function public.org_is_operational(bigint) from public, anon;
grant execute on function public.org_is_operational(bigint) to authenticated, service_role;

create or replace function public.my_org_ids()
 returns setof bigint
 language sql
 stable security definer
 set search_path to 'public'
as $function$
  select m.org_id from org_members m
  join organizations o on o.id = m.org_id
  join profiles p on p.user_id = m.user_id
  where m.user_id = (select auth.uid()) and o.status = 'active' and o.deleted_at is null and p.is_active
$function$;

create or replace function public.current_user_org()
 returns bigint
 language sql
 stable security definer
 set search_path to 'public'
as $function$
  select m.org_id from org_members m
    join organizations o on o.id = m.org_id
    join profiles p on p.user_id = m.user_id
  where m.user_id = auth.uid() and o.status = 'active' and o.deleted_at is null and p.is_active
  order by m.created_at limit 1;
$function$;

create or replace function public.current_user_is_master()
 returns boolean
 language sql
 stable security definer
 set search_path to 'public'
as $function$
  select exists (select 1 from org_members m
    join organizations o on o.id = m.org_id
    join profiles p on p.user_id = m.user_id
    where m.user_id = (select auth.uid()) and o.status = 'active' and o.deleted_at is null and p.is_active
      and m.role in ('org_owner','platform_admin'));
$function$;

create or replace function public.current_user_has_module(p_key text)
 returns boolean
 language sql
 stable security definer
 set search_path to 'public'
as $function$
  select exists (select 1 from org_members m
    join organizations o on o.id = m.org_id
    join profiles p on p.user_id = m.user_id
    where m.user_id = (select auth.uid()) and o.status = 'active' and o.deleted_at is null and p.is_active
      and (m.role in ('org_owner','platform_admin') or m.feature_permissions ? p_key));
$function$;

create or replace function public.partner_org_building_ids()
 returns setof bigint
 language sql
 stable security definer
 set search_path to ''
as $function$
  select building.id
  from public.buildings building
  join public.org_members member
    on member.org_id = building.org_id
   and member.user_id = (select auth.uid())
  join public.organizations organization
    on organization.id = member.org_id
   and organization.status = 'active'
   and organization.deleted_at is null
  join public.profiles profile
    on profile.user_id = member.user_id
   and profile.is_active
  where building.deleted_at is null
    and member.staff_capabilities ?| array['field_staff', 'support_staff'];
$function$;

-- 해지 테넌트는 org_status를 'suspended'로 보고하고, 정렬에서도 운영 중인 org를 우선한다.
create or replace function public.get_my_context()
 returns table(org_id bigint, role org_member_role, org_status org_status, username text, full_name text, is_active boolean, must_change_password boolean, staff_type staff_type, permissions jsonb, staff_capabilities jsonb, org_name text)
 language sql
 stable security definer
 set search_path to 'public'
as $function$
  select m.org_id, m.role,
         case when o.deleted_at is not null then 'suspended'::org_status else o.status end,
         p.username, p.full_name, p.is_active, p.must_change_password,
         m.staff_type, coalesce(m.feature_permissions, '[]'::jsonb),
         coalesce(m.staff_capabilities, '[]'::jsonb), o.name
  from org_members m
  join organizations o on o.id = m.org_id
  join profiles p on p.user_id = m.user_id
  where m.user_id = auth.uid()
  order by (o.status = 'active' and o.deleted_at is null) desc, m.created_at
  limit 1
$function$;
