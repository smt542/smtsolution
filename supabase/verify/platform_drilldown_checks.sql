-- 통합관리자 사무소 드릴다운 검증(0013). 실패 시 raise. (사용자 PC psql / Supabase SQL editor)
do $$ begin
  if (select count(*) from pg_policies where policyname in
      ('building_platform_select','unit_platform_select','occ_platform_select','room_type_platform_select')) <> 4
  then raise exception 'platform drilldown cross-org select policies missing'; end if;
end $$;
-- 수동(세션별):
--  platform_admin 세션: 타 org buildings/units/occupancies/room_types SELECT 가능.
--  일반 staff 세션: 기존대로 자기 org만.
