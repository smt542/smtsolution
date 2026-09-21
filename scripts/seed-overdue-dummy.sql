-- /staff/미납 관리 dummy seed (org 1 · 그린빌라(1) 기존 세대만)
--
-- 미납 표를 정본(overdue-management.dc.html)처럼 채우는 더미 데이터.
-- 미납액 = billing_confirmations.total_amount − sum(payments.amount) 이므로 둘 다 넣는다.
-- 연체 개월수·연체료는 앱이 계산한다(late_fee_rate_tiers org1: 0~1월 1.0% / 1~3월 1.2% / 3월~ 1.5%,
-- 납기일 fallback = 해당 월분 말일). 2026년 2월 조회 기준으로 연체 0~4개월이 섞이도록 월분을 흩었다.
--
-- 태그 'demo-seed overdue 2026-09-21' 로 넣고 같은 태그로 지운다(파일 끝 rollback 참고).
-- 재실행 안전(멱등): 태그로 먼저 삭제한 뒤 insert 한다.
-- 적용: node --env-file=.env.local scripts/db-query.mjs scripts/seed-overdue-dummy.sql
--
-- 건드리지 않는 것: 건물·세대·입주자 신규 생성 없음. 201호(unit 3)는 2025-09~2026-02 부과·완납
--   실데이터가 이미 있어 대상에서 제외했다(on conflict do nothing 으로도 보호된다).

begin;

-- 0. 재실행 멱등: 같은 태그로 넣었던 것 먼저 제거
delete from payments where memo = 'demo-seed overdue 2026-09-21';
delete from billing_confirmations where billing_note = 'demo-seed overdue 2026-09-21';

-- 1. 확정 부과(미납 원금의 근거) + 부분수납
--    (unit_id, occupancy_id, period, total_amount, paid_amount)
with seed(unit_id, occupancy_id, period, total_amount, paid_amount) as (
  values
    -- 101호 홍길동 — 당월 1건
    (1::bigint,  1::bigint,  date '2026-02-01', 131990, 0),
    -- 102호 김철수 — 2개월 누적
    (2,  2,  date '2026-02-01', 206200, 0),
    (2,  2,  date '2026-01-01', 169080, 0),
    -- 202호 이영희 / 301호 박민수 — 당월 1건
    (4,  3,  date '2026-02-01', 354610, 0),
    (5,  4,  date '2026-02-01', 428820, 0),
    -- 901호 김민준
    (8,  8,  date '2026-02-01', 241970, 0),
    -- 902호 이서연 — 2개월 누적
    (9,  9,  date '2026-02-01', 390390, 0),
    (9,  9,  date '2026-01-01', 320120, 0),
    -- 903호 박도윤 — 소액
    (10, 10, date '2026-02-01',  44600, 0),
    -- 904호 최지우 — 당월 없음, 지난 2개월만
    (11, 11, date '2026-01-01', 287400, 0),
    (11, 11, date '2025-12-01', 252300, 0),
    -- 905호 정하준 — 부분수납
    (12, 12, date '2026-02-01', 198700, 50000),
    -- 906호 강서아 — 3개월 누적 + 중간월 부분수납
    (13, 13, date '2026-02-01', 312450, 0),
    (13, 13, date '2026-01-01', 298000, 100000),
    (13, 13, date '2025-12-01', 275600, 0),
    -- 907호 조은우 — 오래된 2개월(연체 2~3개월)
    (14, 14, date '2025-12-01', 163200, 0),
    (14, 14, date '2025-11-01', 158900, 0),
    -- 908호 윤지아
    (15, 15, date '2026-02-01',  96400, 0),
    -- 909호 장시우 — 전월만
    (16, 16, date '2026-01-01', 412300, 0),
    -- 910호 임하윤 — 3개월 연속 장기(연체 2~4개월)
    (17, 17, date '2025-12-01', 151800, 0),
    (17, 17, date '2025-11-01', 149300, 0),
    (17, 17, date '2025-10-01', 145700, 0),
    -- 911호 한예준 — 부분수납
    (18, 18, date '2026-02-01', 223150, 120000)
),
ins_bc as (
  insert into billing_confirmations (unit_id, occupancy_id, period, total_amount, billing_note, confirmed_at)
  select unit_id, occupancy_id, period, total_amount, 'demo-seed overdue 2026-09-21',
         (period + interval '5 days')::timestamptz
    from seed
  on conflict (unit_id, period) do nothing
  returning unit_id, period
)
insert into payments (org_id, unit_id, occupancy_id, period, amount, method, kind, source, status, paid_at, memo)
select 1, s.unit_id, s.occupancy_id, s.period, s.paid_amount, 'transfer', 'partial', 'manual', 'active',
       (s.period + interval '20 days')::date, 'demo-seed overdue 2026-09-21'
  from seed s
  join ins_bc b on b.unit_id = s.unit_id and b.period = s.period  -- 실제로 들어간 부과분만
 where s.paid_amount > 0;

commit;

-- 검증(조회 조건: 건물 그린빌라 / 2026년 2월 / 전체)
--   select * from list_overdue_periods(1, 2026, 2, 'all');
--   → 세대 15건 · 행 23~24건, unpaid_principal 합계 약 4,60만원대
--
-- rollback (더미 제거)
--   begin;
--   delete from payments where memo = 'demo-seed overdue 2026-09-21';
--   delete from billing_confirmations where billing_note = 'demo-seed overdue 2026-09-21';
--   commit;
