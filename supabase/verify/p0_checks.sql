-- Supabase SQL 에디터에서 실행. 시드(Task 13) 이후 검증.
-- 1) 테이블/정책 존재
select tablename, rowsecurity from pg_tables where schemaname='public'
  and tablename in ('organizations','profiles','org_members','audit_log');
-- 기대: 4행, rowsecurity=true

-- 2) audit_log append-only(정책상 update/delete 불가) — anon/authenticated 롤에서 실패해야 정상
--    (SQL 에디터는 service_role이라 우회됨. 앱 anon 세션으로 확인 권장.)

-- 3) get_my_context 스모크(로그인 사용자 컨텍스트에서)
select * from get_my_context();
-- 기대: 시드 사용자의 org/role/active 1행
