-- 0130_late_fee_org_scope.sql
-- 정합성/보안: late_fee_rate_tiers RLS를 current_user_org()(첫 org만)에서 my_org_ids()
-- (호출자의 모든 org)로 표준화한다. 다른 org 스코프 테이블과 동일 기준. 현재의 단일 org
-- 계정에는 동작 동일하며, 향후 다중 org 사용자가 비(非)주 org의 요율표를 못 보는 회귀를 예방한다.
-- 멱등: drop policy if exists 후 재생성.

drop policy if exists lfrt_select on late_fee_rate_tiers;
create policy lfrt_select on late_fee_rate_tiers
  for select using (org_id in (select my_org_ids()));

drop policy if exists lfrt_write on late_fee_rate_tiers;
create policy lfrt_write on late_fee_rate_tiers
  for all
  using (org_id in (select my_org_ids()) and current_user_has_module('billing'))
  with check (org_id in (select my_org_ids()) and current_user_has_module('billing'));
