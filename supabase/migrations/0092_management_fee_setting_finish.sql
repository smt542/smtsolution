-- 0092_management_fee_setting_finish.sql
-- 관리비 세팅 §3.3 신규입주 당월부과 + §3.4 건물 셋팅확인 체크박스
-- 의존: 0001(buildings·units·occupancies·fee_items), 0012/0021(fee_item_charges·billing_confirmations·billing_history·round_charge·confirm_billing)
-- confirm_billing / save_building 무수정. 계산은 confirm_billing(0021) 세대루프 미러링(패리티 유지).

-- ===== §3.4 컬럼 =====
alter table buildings add column if not exists setup_confirm_required boolean not null default false;

-- ===== §3.4 전용 토글 RPC (shared save_building 미변경; 0073 receipts_save_building_notes 선례) =====
create or replace function set_building_setup_confirm(p_id bigint, p_required boolean)
returns void language plpgsql security definer set search_path = public as $$
declare v_org bigint;
begin
  v_org := current_user_org();
  if v_org is null then raise exception 'no org for caller'; end if;
  if not exists (select 1 from buildings where id = p_id and org_id = v_org and deleted_at is null) then
    raise exception 'building not in org'; end if;
  update buildings set setup_confirm_required = coalesce(p_required, false) where id = p_id;
end $$;
revoke execute on function set_building_setup_confirm(bigint, boolean) from public, anon;
grant execute on function set_building_setup_confirm(bigint, boolean) to authenticated;

-- ===== §3.3 감지: 부과확정 이후 등록된 미부과 신규 세대 =====
create or replace function list_uncharged_new_occupancies(p_building_id bigint, p_period date)
returns table(unit_id bigint, unit_no text, dong text, tenant_name text, move_in_date date)
language sql stable security definer set search_path = public as $$
  with b as (
    select id from buildings where id = p_building_id and org_id = current_user_org() and deleted_at is null
  ),
  confirmed_at_max as (
    select max(bc.confirmed_at) as v
    from billing_confirmations bc
    join units u on u.id = bc.unit_id
    where u.building_id = p_building_id and bc.period = p_period and bc.confirmed_at is not null
  ),
  latest_occ as (
    select distinct on (o.unit_id)
      o.unit_id, o.tenant_name, o.move_in_date, o.status, o.created_at
    from occupancies o
    join units u on u.id = o.unit_id
    where u.building_id = p_building_id and o.deleted_at is null
    order by o.unit_id, o.created_at desc, o.id desc
  )
  select u.id, u.unit_no, u.dong, lo.tenant_name, lo.move_in_date
  from units u
  join b on true
  join latest_occ lo on lo.unit_id = u.id
  cross join confirmed_at_max cm
  where u.deleted_at is null
    and cm.v is not null                           -- 건물 미확정이면 빈 결과(정상 부과확정 플로우)
    and lo.status = 'occupied'
    and lo.created_at > cm.v                        -- 확정 이후 등록
    and not exists (                                -- 당월 확정 안 됨
      select 1 from billing_confirmations bc
      where bc.unit_id = u.id and bc.period = p_period and bc.confirmed_at is not null
    )
  order by u.unit_no;
$$;
revoke execute on function list_uncharged_new_occupancies(bigint, date) from public, anon;
grant execute on function list_uncharged_new_occupancies(bigint, date) to authenticated;

-- ===== §3.3 부과: 감지 대상 세대만 당월 부과 (confirm_billing(0021) 세대루프 미러링) =====
create or replace function charge_new_occupancies(p_building_id bigint, p_period date, p_unit_ids bigint[])
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_org bigint; v_unit record; v_item record;
  v_items jsonb; v_total bigint; v_amt int;
  v_days int; v_occupied int; v_count int := 0; v_grand bigint := 0;
begin
  v_org := current_user_org();
  if v_org is null then raise exception 'no org for caller'; end if;
  if not current_user_has_module('billing') then raise exception 'forbidden: billing required'; end if;
  if not exists (select 1 from buildings where id = p_building_id and org_id = v_org) then
    raise exception 'building not in org'; end if;
  if p_period is null or p_period <> date_trunc('month', p_period)::date then
    raise exception 'period must be first of month'; end if;
  if p_period > date_trunc('month', now() at time zone 'Asia/Seoul')::date then
    raise exception 'future period is not allowed'; end if;

  v_days := extract(day from ((p_period + interval '1 month')::date - 1))::int;

  -- 감지대상(list_uncharged_new_occupancies와 동일 필터) ∩ p_unit_ids 만 처리(임의 세대 차단)
  for v_unit in
    select u.id as unit_id, occ.id as occ_id, occ.tenant_name, occ.move_in_date, occ.status, occ.created_at
    from units u
    left join lateral (
      select * from occupancies o where o.unit_id = u.id and o.deleted_at is null
      order by o.created_at desc, o.id desc limit 1
    ) occ on true
    where u.building_id = p_building_id and u.deleted_at is null
      and u.id = any(p_unit_ids)
      and coalesce(occ.status, 'vacant') = 'occupied'
      and occ.created_at > (
        select max(bc.confirmed_at) from billing_confirmations bc
        join units u2 on u2.id = bc.unit_id
        where u2.building_id = p_building_id and bc.period = p_period and bc.confirmed_at is not null
      )
      and not exists (
        select 1 from billing_confirmations bc
        where bc.unit_id = u.id and bc.period = p_period and bc.confirmed_at is not null
      )
  loop
    if v_unit.move_in_date is not null
       and v_unit.move_in_date between p_period and ((p_period + interval '1 month')::date - 1) then
      v_occupied := ((p_period + interval '1 month')::date - v_unit.move_in_date);  -- 입주일 포함
    else
      v_occupied := v_days;
    end if;

    v_items := '[]'::jsonb; v_total := 0;
    for v_item in
      select fi.id as fee_item_id, fi.name,
        coalesce(fic.amount, case when fi.carry_over then prev.amount else 0 end, 0) as amount,
        fi.daily_proration, fi.rounding
      from buildings b
      join fee_items fi on fi.type_id = b.type_id and fi.org_id = v_org and fi.deleted_at is null
      left join fee_item_charges fic on fic.unit_id = v_unit.unit_id and fic.fee_item_id = fi.id and fic.period = p_period
      left join fee_item_charges prev on prev.unit_id = v_unit.unit_id and prev.fee_item_id = fi.id
           and prev.period = (p_period - interval '1 month')::date
      where b.id = p_building_id and coalesce(fic.charged, true)
      order by fi.sort_order, fi.id
    loop
      if v_item.daily_proration and v_occupied < v_days then
        -- 계산규칙 1.1: 일할 분모 고정 30일 (confirm_billing 0021과 동일)
        v_amt := round_charge(v_item.amount::numeric * v_occupied / 30, v_item.rounding);
      else
        v_amt := v_item.amount;
      end if;
      v_items := v_items || jsonb_build_object('fee_item_id', v_item.fee_item_id, 'name', v_item.name, 'charged', true, 'amount', v_amt);
      v_total := v_total + v_amt;
    end loop;

    insert into billing_confirmations(unit_id, period, occupancy_id, total_amount, confirmed_at, confirmed_by)
      values (v_unit.unit_id, p_period, v_unit.occ_id, v_total, now(), auth.uid())
      on conflict (unit_id, period) do update
        set occupancy_id = excluded.occupancy_id, total_amount = excluded.total_amount,
            confirmed_at = excluded.confirmed_at, confirmed_by = excluded.confirmed_by;

    insert into billing_history(unit_id, period, occupancy_id, tenant_name, total_amount, items, confirmed_at, confirmed_by)
      values (v_unit.unit_id, p_period, v_unit.occ_id, v_unit.tenant_name, v_total, v_items, now(), auth.uid());

    v_count := v_count + 1; v_grand := v_grand + v_total;
  end loop;

  insert into audit_log(org_id, actor_id, action, table_name, row_pk, after)
    values (v_org, auth.uid(), 'BILLING_CHARGE_NEW', 'billing_confirmations', p_building_id::text,
      jsonb_build_object('period', p_period, 'unit_count', v_count, 'total', v_grand));

  return jsonb_build_object('unit_count', v_count, 'total', v_grand);
end $$;
revoke execute on function charge_new_occupancies(bigint, date, bigint[]) from public, anon;
grant execute on function charge_new_occupancies(bigint, date, bigint[]) to authenticated;
