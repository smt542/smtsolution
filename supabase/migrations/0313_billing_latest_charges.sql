-- 0313: 빌라자료추가·전체자료추가(전월 자료 반영)의 금액 출처 — 세대·항목별 「저장된 값이 있는 가장 최근 달」.
-- 지금까지는 list_billing(전월)을 읽어 전월(없으면 그 전달) 값만 가져왔고, 둘 다 없으면 0을 돌려줘
-- 이번 달 입력값을 0으로 덮어썼다(2026-10-14 사용자 요청으로 변경).
-- 이월 대상(carry_over)·필수 공과금 제외 판단은 앱이 list_billing 의 fee_item 속성으로 한다.
-- 스코프는 list_billing 과 같다: current_user_org() 의 건물만.
create or replace function public.billing_latest_charges(p_building_id bigint, p_period date)
returns table(unit_id bigint, fee_item_id bigint, period date, charged boolean, amount integer)
language sql
stable
security definer
set search_path = public
as $$
  select distinct on (f.unit_id, f.fee_item_id)
    f.unit_id, f.fee_item_id, f.period, f.charged, f.amount
  from fee_item_charges f
  join units u on u.id = f.unit_id and u.building_id = p_building_id and u.deleted_at is null
  join buildings b on b.id = u.building_id and b.org_id = current_user_org()
  where f.period < date_trunc('month', p_period)::date
  order by f.unit_id, f.fee_item_id, f.period desc;
$$;

revoke all on function public.billing_latest_charges(bigint, date) from public, anon;
grant execute on function public.billing_latest_charges(bigint, date) to authenticated;
