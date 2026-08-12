-- P3a 검증 (사용자 PC에서 psql로 실행). 실패 시 raise.
-- 1) buildings 담당자 FK 컬럼 존재 + 레거시명 제거
do $$ begin
  perform 1 from information_schema.columns where table_name='buildings' and column_name='manager_user_id';
  if not found then raise exception 'buildings.manager_user_id missing'; end if;
  perform 1 from information_schema.columns where table_name='buildings' and column_name='manager_name';
  if found then raise exception 'legacy buildings.manager_name must be dropped'; end if;
  perform 1 from information_schema.columns where table_name='buildings' and column_name='facilities';
  if not found then raise exception 'buildings.facilities missing'; end if;
end $$;

-- 2) 신규 자식 테이블 + check 제약
do $$ begin
  perform 1 from information_schema.columns where table_name='building_customer_numbers' and column_name='billing_basis';
  if not found then raise exception 'building_customer_numbers.billing_basis missing'; end if;
  perform 1 from information_schema.columns where table_name='building_vendors' and column_name='vendor_type';
  if not found then raise exception 'building_vendors.vendor_type missing'; end if;
end $$;

-- 3) buildings 쓰기 정책이 module 게이트, select는 개방
do $$ begin
  perform 1 from pg_policies where tablename='buildings' and policyname='bld_write' and qual like '%current_user_has_module%';
  if not found then raise exception 'bld_write must gate by current_user_has_module'; end if;
  perform 1 from pg_policies where tablename='buildings' and policyname='bld_select' and coalesce(qual,'') not like '%current_user_has_module%';
  if not found then raise exception 'bld_select must be open (no module gate)'; end if;
end $$;

-- 4) RPC 존재
do $$ begin
  perform 1 from pg_proc where proname='save_building';
  if not found then raise exception 'save_building missing'; end if;
  perform 1 from pg_proc where proname='list_buildings';
  if not found then raise exception 'list_buildings missing'; end if;
end $$;

-- 5) 수동 확인(주석): save_building 신규 insert 시 code 자동생성(B0001..),
--    현장직원(buildings 미보유)은 save_building 호출 시 'forbidden' 예외,
--    타 org uuid 담당자는 null 저장, 타 org building_customer_numbers select 0행.
