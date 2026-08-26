-- 0103_rls_hardening.sql
-- RLS/권한 하드닝 — 2026-08-26 스키마·RLS 프로덕션 검증 후속(docs/audit/rls-verification-2026-08-26.md).
-- 성격: 전부 심층방어(defense-in-depth). 현재도 RLS로 anon은 차단되나 GRANT/역할 계층에서
--       한 번 더 막아, 향후 정책식 실수가 인터넷(anon)으로 새지 않도록 한다. 정상 기능 영향 없음.
-- 롤백: L1은 재-grant, L3은 정책을 다시 `to public`으로 alter 하면 원복.

-- L1. anon 역할의 쓰기/TRUNCATE 권한 회수.
--   anon-facing 경로는 전부 SECURITY DEFINER RPC(public_*_by_token)이며 테이블 직접 접근이 아니다.
revoke insert, update, delete, truncate on all tables in schema public from anon;
-- (선택·더 엄격, 미적용) revoke select, references on all tables in schema public from anon;

-- L3. staff 정책의 역할을 {public} → {authenticated} 로 통일.
--   현재 {public} 정책은 전부 my_org_ids()/current_user_is_platform_admin()/auth.uid() 술어라
--   anon엔 이미 빈 결과지만, 역할을 authenticated로 좁혀 역할 계층에서도 차단한다.
do $$
declare
  r record;
begin
  for r in
    select schemaname, tablename, policyname
    from pg_policies
    where schemaname = 'public'
      and array_to_string(roles, ',') = 'public'
  loop
    execute format(
      'alter policy %I on %I.%I to authenticated',
      r.policyname, r.schemaname, r.tablename
    );
  end loop;
end $$;
