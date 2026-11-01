-- QA #56 단전·단수 예고 자동 판정 검증 (0338). 읽기 전용.
-- 기대: mismatch 0행. bill_utility_cutoff_due 가 "셋업 출력 on + 납기 경과한 최근 N개 부과월 모두 미납"과 일치한다.
with targets as (
  select bc.unit_id, bc.occupancy_id, bc.period, b.org_id
  from billing_confirmations bc
  join units u on u.id = bc.unit_id and u.deleted_at is null
  join buildings b on b.id = u.building_id
  where bc.confirmed_at is not null
    and bc.period >= (date_trunc('month', timezone('Asia/Seoul', now())) - interval '2 months')::date
),
recent as (
  select t.unit_id, t.period, sc.print_utility_cutoff, sc.cutoff_months,
         array(
           select pbc.total_amount - coalesce((
             select sum(pay.amount) from payments pay
             where pay.occupancy_id = pbc.occupancy_id and pay.unit_id = pbc.unit_id
               and pay.period = pbc.period and pay.status = 'active' and pay.late_fee_split_id is null
           ), 0)
           from billing_confirmations pbc
           join occupancies po on po.id = pbc.occupancy_id and po.unit_id = pbc.unit_id and po.deleted_at is null
           where pbc.unit_id = t.unit_id and pbc.occupancy_id = t.occupancy_id and pbc.period < t.period
             and pbc.confirmed_at is not null
             and public.billing_effective_due_date(pbc.unit_id, pbc.period) < (timezone('Asia/Seoul', now()))::date
           order by pbc.period desc
         ) as unpaid_desc,
         public.bill_utility_cutoff_due(t.unit_id, t.occupancy_id, t.period) as judged
  from targets t
  left join setup_config sc on sc.org_id = t.org_id
)
select unit_id, period, print_utility_cutoff, cutoff_months, unpaid_desc, judged
from recent
where judged is distinct from (
  coalesce(print_utility_cutoff, false)
  and coalesce(cutoff_months, 0) > 0
  and coalesce(array_length(unpaid_desc, 1), 0) >= cutoff_months
  and (select bool_and(x > 0) from unnest(unpaid_desc[1:cutoff_months]) x)
);
