-- 수동 검증(사용자 PC에서 psql/Management API로 실행)
-- 1) 테이블 존재
select to_regclass('public.late_fee_rate_tiers') is not null as table_ok;
-- 2) seed 존재(org당 3구간)
select org_id, count(*) from late_fee_rate_tiers group by org_id;
-- 3) RPC 존재
select proname from pg_proc where proname = 'list_overdue_periods';
-- 4) RLS 정책 2개
select policyname from pg_policies where tablename = 'late_fee_rate_tiers';
