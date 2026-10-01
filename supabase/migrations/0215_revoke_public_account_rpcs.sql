-- 0215_revoke_public_account_rpcs.sql
-- 계정 RPC 4개의 PUBLIC 실행권한 회수 — supabase/verify/p2a_checks.sql 실패 해소.
--   admin_set_active · admin_update_member_basic · list_accounts · provision_member
-- 넷 다 security definer인데 ACL에 PUBLIC EXECUTE(=X/postgres)가 남아 있어
-- 로그인하지 않은 anon도 PUBLIC을 통해 실행할 수 있었다. 앞선 마이그가
-- `revoke … from anon`만 하고 `from public`은 하지 않아서다.
-- 함수 안에서 권한을 다시 검사하지만, 최소권한 원칙대로 authenticated·service_role에만 연다.
--   앱 호출: 계정 화면(브라우저 세션) = list_accounts·admin_update_member_basic·admin_set_active,
--   /api/accounts·/api/platform/organizations(서버 세션) = provision_member → 모두 authenticated.
-- 시그니처는 2026-10-01 운영 pg_proc 기준(오버로드 없음). 함수 본문은 바꾸지 않는다.

revoke execute on function public.admin_set_active(uuid, boolean, bigint) from public, anon;
revoke execute on function public.admin_update_member_basic(uuid, text, text, text, public.staff_type, text, bigint[], jsonb) from public, anon;
revoke execute on function public.list_accounts(text, public.staff_type) from public, anon;
revoke execute on function public.provision_member(uuid, text, text, text, text, public.org_member_role, public.staff_type, jsonb, text, bigint[], bigint, jsonb) from public, anon;

grant execute on function public.admin_set_active(uuid, boolean, bigint) to authenticated, service_role;
grant execute on function public.admin_update_member_basic(uuid, text, text, text, public.staff_type, text, bigint[], jsonb) to authenticated, service_role;
grant execute on function public.list_accounts(text, public.staff_type) to authenticated, service_role;
grant execute on function public.provision_member(uuid, text, text, text, text, public.org_member_role, public.staff_type, jsonb, text, bigint[], bigint, jsonb) to authenticated, service_role;
