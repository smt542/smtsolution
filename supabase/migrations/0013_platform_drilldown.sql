-- 0013_platform_drilldown.sql
-- 통합관리자(platform_admin) 사무소 드릴다운 — 건물/세대/입주/룸타입 크로스-org 읽기 개방.
-- 의존: 0011_platform_admin(current_user_is_platform_admin), P3a(buildings), P3b(units·occupancies), P2b(room_types).
-- 기존 org-scoped select 정책 유지 + platform_admin permissive select 추가(0007 org_platform_select 패턴).

create policy building_platform_select on buildings for select
  using (current_user_is_platform_admin());
create policy unit_platform_select on units for select
  using (current_user_is_platform_admin());
create policy occ_platform_select on occupancies for select
  using (current_user_is_platform_admin());
create policy room_type_platform_select on room_types for select
  using (current_user_is_platform_admin());
