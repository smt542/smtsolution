-- QA #22 (2026-11-01): 세입자 홈 대표 금액 = 당월 + 이월 미납. 본인 occupancy 범위의 이월 미납·연체료를
-- 서버에서 계산한다(bill_carryover: 월별 부과 − 수납을 0 클램프해 합산 = 수납관리 미납합계 기준).
-- p_period 생략 시 가장 최근 확정 월 기준.
begin;

create or replace function public.resident_bill_carryover(p_period date default null)
returns table(carryover_unpaid integer, carryover_late_fee integer)
language sql
stable
security definer
set search_path to 'public', 'pg_temp'
as $fn$
  with linked as (
    select * from resident_linked_unit() limit 1
  ), base as (
    select l.unit_id,
           coalesce(p_period, (
             select max(bc.period) from billing_confirmations bc
             where bc.unit_id = l.unit_id and bc.occupancy_id = l.occupancy_id
               and bc.confirmed_at is not null
           )) as period
    from linked l
  )
  select coalesce(co.carryover_unpaid, 0), coalesce(co.carryover_late_fee, 0)
  from base b
  cross join lateral bill_carryover(b.unit_id, b.period) co
  where b.period is not null;
$fn$;

revoke all on function public.resident_bill_carryover(date) from public, anon;
grant execute on function public.resident_bill_carryover(date) to authenticated, service_role;

commit;
