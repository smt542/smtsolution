-- QA #22 fix: resident_bill_carryover(p_period) 로 이전 입주자의 이월 미납을 조회할 수 있었다.
-- 인자를 없애고 본인 occupancy 의 가장 최근 확정 월 기준으로만 계산한다.
begin;

drop function if exists public.resident_bill_carryover(date);

create function public.resident_bill_carryover()
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
           (select max(bc.period) from billing_confirmations bc
             where bc.unit_id = l.unit_id and bc.occupancy_id = l.occupancy_id
               and bc.confirmed_at is not null) as period
    from linked l
  )
  select coalesce(co.carryover_unpaid, 0), coalesce(co.carryover_late_fee, 0)
  from base b
  cross join lateral bill_carryover(b.unit_id, b.period) co
  where b.period is not null;
$fn$;

revoke all on function public.resident_bill_carryover() from public, anon;
grant execute on function public.resident_bill_carryover() to authenticated;

commit;
