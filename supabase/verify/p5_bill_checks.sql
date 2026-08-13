-- supabase/verify/p5_bill_checks.sql — P5 고지서 검증 (사용자 PC psql). 실패 시 raise.
do $$ begin
  if (select count(*) from information_schema.tables where table_name = 'bill_issues') <> 1
    then raise exception 'bill_issues missing'; end if;
end $$;
do $$ begin
  perform 1 from pg_policies where tablename='bill_issues' and policyname='bi_write' and qual like '%bill_publish%';
  if not found then raise exception 'bi_write must gate by bill_publish'; end if;
  perform 1 from pg_policies where tablename='bill_issues' and cmd='SELECT' and policyname='bi_select';
  if not found then raise exception 'bi_select missing'; end if;
  if (select count(*) from pg_proc where proname in ('list_bill_targets','get_bill_documents','issue_bills')) <> 3
    then raise exception 'bill RPC missing'; end if;
end $$;
-- 수동 점검(사용자 PC):
--  1) bill_publish 미보유 구성원: bill_issues INSERT 거부 / SELECT 가능.
--  2) 미확정(confirmed_at null) 세대 issue_bills → 'not confirmed' 예외.
--  3) 타 org building_id → 'building not in org'.
--  4) issue_bills 재호출 시 (unit,period,'a4') upsert(중복 미생성).
--  5) list_bill_targets가 확정 세대만·타 org 0행.
