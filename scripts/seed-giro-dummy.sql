-- /staff/receipts 지로처리일자 확인 모달 확인용 지로 더미 수납 (org 1)
--
-- 달력 날짜 동그라미 = 그날 금융결재(= 지로 수납) 금액이 있을 때(정본 `.gw-d.on`).
-- DB에 지로 수납(method='giro')이 0건이라 동그라미가 한 번도 안 찍혀서, 2026년 9월분 미납 세대 12곳을
-- 9월 영업일 8일(주말·추석 9/24~26 제외)에 지로로 완납한 것처럼 넣는다.
-- 모양은 지로수납처리(GiroUploadModal → record_payment)와 같다:
--   method 'giro' · kind 'full' · fee 0 · source 'manual' · occupancy = 그 달 확정 부과의 입주자(없으면 최근 입주자).
-- 대상 = 9월분 미납 세대 중 unit id 가 큰 쪽 12곳(자주 보는 101호·블루타워 같은 앞번호 세대는 건드리지 않게).
--
-- 태그 memo 'demo-seed giro 2026-09-29' 로 넣고 같은 태그로 지운다(파일 끝 rollback).
-- 재실행 안전(멱등): 태그로 먼저 지운 뒤 넣는다.
-- 적용: node --env-file=.env.local scripts/db-query.mjs scripts/seed-giro-dummy.sql
-- 영향: 넣은 세대는 9월분이 완납으로 바뀌고, 9월 지로수납원장에도 나온다.

delete from payments where memo = 'demo-seed giro 2026-09-29';

with days(n, paid_at) as (
  values (1, date '2026-09-08'), (2, date '2026-09-10'), (3, date '2026-09-10'),
         (4, date '2026-09-14'), (5, date '2026-09-16'), (6, date '2026-09-16'),
         (7, date '2026-09-18'), (8, date '2026-09-21'), (9, date '2026-09-21'),
         (10, date '2026-09-23'), (11, date '2026-09-23'), (12, date '2026-09-28')
),
targets as (
  select bc.unit_id, bc.period, bc.occupancy_id,
         bc.total_amount - coalesce(paid.amount, 0) as unpaid,
         row_number() over (order by u.id desc) as n
    from billing_confirmations bc
    join units u on u.id = bc.unit_id and u.deleted_at is null
    join buildings b on b.id = u.building_id and b.deleted_at is null and b.org_id = 1
    left join lateral (
      select sum(p.amount)::int as amount from payments p
       where p.unit_id = bc.unit_id and p.period = bc.period and p.status = 'active'
    ) paid on true
   where bc.period = date '2026-09-01'
     and bc.total_amount - coalesce(paid.amount, 0) > 0
)
insert into payments (org_id, unit_id, period, occupancy_id, amount, fee, method, kind, memo, paid_at, source, status)
select 1, t.unit_id, t.period,
       coalesce(t.occupancy_id,
                (select o.id from occupancies o
                  where o.unit_id = t.unit_id and o.deleted_at is null
                  order by o.created_at desc, o.id desc limit 1)),
       t.unpaid, 0, 'giro', 'full', 'demo-seed giro 2026-09-29', d.paid_at, 'manual', 'active'
  from targets t
  join days d on d.n = t.n;

-- 결과 요약(비민감): 넣은 건수·입금일 수·합계·입금일 목록
select count(*) as inserted,
       count(distinct paid_at) as days,
       sum(amount) as total,
       string_agg(distinct to_char(paid_at, 'MM-DD'), ',' order by to_char(paid_at, 'MM-DD')) as dates
  from payments
 where memo = 'demo-seed giro 2026-09-29';

-- 검증(2026-09-29 적용 결과)
--   inserted 12 · days 8 · total 1,807,800 · dates 09-08,09-10,09-14,09-16,09-18,09-21,09-23,09-28
--   → 지로처리일자 확인 2026년 9월 달력에서 위 8일에 동그라미
--
-- rollback (더미 제거)
--   delete from payments where memo = 'demo-seed giro 2026-09-29';
