-- 0147_persona_predicates.sql
-- persona 서버 인가용 술어. current_user_is_platform_admin()(0133)과 동일 스타일(EXISTS-any + profile active).
-- 가산 semantics: 유저가 해당 staff_type 멤버십을 "보유"하면 true(다중 멤버십 정확 판정).

create or replace function current_user_is_manager_staff() returns boolean
  language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from org_members m
    where m.user_id = (select auth.uid()) and m.staff_type = 'manager_staff'
  )
  and exists (
    select 1 from profiles p
    where p.user_id = (select auth.uid()) and p.is_active
  )
$$;
revoke execute on function current_user_is_manager_staff() from public, anon;
grant execute on function current_user_is_manager_staff() to authenticated;

create or replace function current_user_is_field_partner() returns boolean
  language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from org_members m
    where m.user_id = (select auth.uid()) and m.staff_type in ('field_staff','support_staff')
  )
  and exists (
    select 1 from profiles p
    where p.user_id = (select auth.uid()) and p.is_active
  )
$$;
revoke execute on function current_user_is_field_partner() from public, anon;
grant execute on function current_user_is_field_partner() to authenticated;
