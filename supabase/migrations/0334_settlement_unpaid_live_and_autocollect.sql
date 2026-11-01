-- 0334 (QA #48 후속):
--  1) 입력 중인 퇴실일 기준으로 미납 소계를 다시 계산하는 경량 RPC(staff / partner).
--  2) complete_moving_settlement 자동수납 범위를 ③ 미납 규칙(납기 경과분만·퇴실월 제외)과 일치시킨다.
begin;

create or replace function public.get_settlement_billing_unpaid(
  p_unit_id bigint, p_occupancy_id bigint, p_move_out date default null)
returns bigint
language plpgsql
stable security definer
set search_path to 'public'
as $f$
declare v_org bigint;
begin
  v_org := current_user_org();
  if v_org is null then raise exception 'no org for caller'; end if;
  perform 1 from units u join buildings b on b.id = u.building_id and b.org_id = v_org
    where u.id = p_unit_id and u.deleted_at is null;
  if not found then raise exception 'unit not in org'; end if;
  perform 1 from occupancies o where o.id = p_occupancy_id and o.unit_id = p_unit_id;
  if not found then raise exception 'occupancy not in unit'; end if;
  return settlement_billing_unpaid(p_unit_id, p_occupancy_id, p_move_out);
end $f$;

create or replace function public.partner_get_settlement_billing_unpaid(
  p_unit_id bigint, p_occupancy_id bigint, p_move_out date default null)
returns bigint
language plpgsql
stable security definer
set search_path to 'public'
as $f$
begin
  perform 1 from units u join buildings b on b.id = u.building_id
    where u.id = p_unit_id and u.deleted_at is null
      and b.id in (select partner_my_building_ids());
  if not found then raise exception 'unit not assigned to caller'; end if;
  perform 1 from occupancies o where o.id = p_occupancy_id and o.unit_id = p_unit_id;
  if not found then raise exception 'occupancy not in unit'; end if;
  return settlement_billing_unpaid(p_unit_id, p_occupancy_id, p_move_out);
end $f$;

revoke all on function public.get_settlement_billing_unpaid(bigint, bigint, date) from public, anon;
revoke all on function public.partner_get_settlement_billing_unpaid(bigint, bigint, date) from public, anon;
grant execute on function public.get_settlement_billing_unpaid(bigint, bigint, date) to authenticated, service_role;
grant execute on function public.partner_get_settlement_billing_unpaid(bigint, bigint, date) to authenticated, service_role;

-- 자동수납 루프: ③ 과 같은 범위(납기 < KST 오늘, 퇴실월 제외)만 수납한다. 라이브 정의를 치환.
do $do$
declare
  v_def text;
  v_old text := $q$        and (v_move_in_date is null or bc.period >= date_trunc('month', v_move_in_date)::date)
      group by bc.period, bc.occupancy_id, bc.total_amount$q$;
  v_new text := $q$        and (v_move_in_date is null or bc.period >= date_trunc('month', v_move_in_date)::date)
        and bc.period <> date_trunc('month', v_move_out_date)::date
        and coalesce(
              (select bi.due_date from bill_issues bi
                where bi.unit_id = bc.unit_id and bi.period = bc.period
                order by bi.issued_at desc, bi.id desc limit 1),
              (select bps.due_date from billing_period_settings bps
                join units uu on uu.building_id = bps.building_id
                where uu.id = bc.unit_id and bps.period = bc.period),
              public.billing_default_due_date(bc.unit_id, bc.period)
            ) < (timezone('Asia/Seoul', now()))::date
      group by bc.period, bc.occupancy_id, bc.total_amount$q$;
begin
  v_def := pg_get_functiondef('public.complete_moving_settlement(bigint)'::regprocedure);
  if position(v_old in v_def) = 0 then raise exception 'autocollect patch target not found'; end if;
  execute replace(v_def, v_old, v_new);
end
$do$;

commit;
