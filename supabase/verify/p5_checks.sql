-- supabase/verify/p5_checks.sql — P5 검증 (사용자 PC psql). 실패 시 raise.
do $$ begin
  if (select count(*) from information_schema.tables
      where table_name in ('fee_item_charges','billing_confirmations','billing_history')) <> 3
    then raise exception 'P5 tables missing'; end if;
end $$;
do $$ begin
  perform 1 from pg_policies where tablename='fee_item_charges' and policyname='fic_write' and qual like '%current_user_has_module%';
  if not found then raise exception 'fic_write must gate by billing module'; end if;
  perform 1 from pg_policies where tablename='billing_confirmations' and policyname='bc_write' and qual like '%current_user_has_module%';
  if not found then raise exception 'bc_write must gate by billing module'; end if;
  perform 1 from pg_policies where tablename='billing_history' and cmd <> 'SELECT';
  if found then raise exception 'billing_history must have SELECT-only policies (RPC-only writes)'; end if;
  if (select count(*) from pg_proc where proname in
      ('round_charge','list_billing','list_billing_history','save_billing_charges','confirm_billing')) <> 5
    then raise exception 'P5 RPC missing'; end if;
end $$;
-- 수동 점검(사용자 PC):
--  1) billing 미보유 구성원: fee_item_charges INSERT 거부 / SELECT 가능.
--  2) save_billing_charges → confirm_billing 후 billing_history 1행·billing_confirmations.confirmed_at 세팅.
--  3) 재확정 시 confirmations UPDATE + history 추가 append(2행).
--  4) 중간입주(daily_proration) 세대 일할 반영 total 확인.
--  5) 타 org building_id → 'building not in org'.
--  6) 공실 세대 confirm 제외.
