-- P2a 스키마·정책 존재 검증. 적용 후 psql/Supabase SQL editor에서 실행.
-- (권한 동작의 행위 검증은 시드 계정 필요 → E2E, pending-user)

-- 1) 컬럼 추가 확인
select 'org_members.staff_type'          as check, count(*) from information_schema.columns
  where table_name='org_members' and column_name='staff_type';
select 'org_members.feature_permissions' as check, count(*) from information_schema.columns
  where table_name='org_members' and column_name='feature_permissions';
select 'org_members.affiliation'         as check, count(*) from information_schema.columns
  where table_name='org_members' and column_name='affiliation';
select 'profiles.phone_sub'              as check, count(*) from information_schema.columns
  where table_name='profiles' and column_name='phone_sub';

-- 2) 함수 존재(9개)
select proname from pg_proc where proname in (
  'current_user_org','current_user_is_master','current_user_has_module',
  'get_my_context','provision_member','admin_set_member_permissions',
  'admin_update_member_basic','admin_set_active','list_accounts') order by proname;

-- 3) get_my_context 반환에 staff_type/permissions 포함
select p.proname, pg_get_function_result(p.oid) as result
  from pg_proc p where p.proname='get_my_context';

-- 4) 신규 테이블 RLS 정책
select c.relname, pol.polname from pg_policy pol join pg_class c on c.oid=pol.polrelid
  where c.relname in ('staff_roles','org_member_roles') order by 1,2;

-- 5) 담당역할 시드(org별 3개 이상)
select org_id, count(*) as role_count from staff_roles group by org_id order by org_id;

-- 6) anon revoke 확인(정의된 RPC가 anon에 실행권한 없어야 함)
select r.routine_name, has_function_privilege('anon', p.oid, 'execute') as anon_can_exec
  from pg_proc p join information_schema.routines r on r.specific_name = p.proname||'_'||p.oid
  where p.proname in ('provision_member','admin_set_member_permissions','list_accounts');
