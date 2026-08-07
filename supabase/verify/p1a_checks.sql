-- 시드 org 사용자 컨텍스트에서: 8개 테이블 rowsecurity=true
select tablename, rowsecurity from pg_tables where schemaname='public'
  and tablename in ('building_types','buildings','units','occupancies','fee_items','vendor_categories','vendors','attachments');
-- 타 org 데이터 접근 0행, with check 위반 insert 거부(anon/authenticated 세션에서 확인)
